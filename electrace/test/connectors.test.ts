import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, resolve } from "../src/index.js";
import type { Block, Design, Terminal } from "../src/index.js";

const B = (id: string, terminals: Terminal[]): Block => ({ id, name: id, version: "1.0.0", terminals });
const key = (b: Block) => `${b.id}@${b.version}`;
const lib = (...bs: Block[]) => new Map(bs.map((b) => [key(b), b]));
const has = (fs: { rule: string }[], r: string) => fs.some((f) => f.rule === r);

test("a terminal docked to a connector pin is off-board → not flagged open", () => {
  const mcu = B("@t/mcu", [{ id: "tx", role: "out", type: "signal" }]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "U1", block: key(mcu) }],
    connectors: [{ ref: "J1", connector: "hdr-4" }],
    connections: [{ from: "U1.tx", to: "J1.2" }],
  };
  const { findings } = analyze(d, lib(mcu));
  assert.ok(!has(findings, "connectivity/open-net"));
  const net = resolve(d, lib(mcu)).nets.find((n) => n.members.some((m) => m.terminal === "tx"));
  assert.equal(net?.external, true);
});

test("undriven rail with no source is OK once it reaches a connector", () => {
  const load = B("@t/l", [{ id: "v", role: "in", type: "power" }]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "L", block: key(load) }],
    connectors: [{ ref: "J1", connector: "barrel" }],
    connections: [{ from: "L.v", to: "J1.+" }],
  };
  assert.ok(!has(analyze(d, lib(load)).findings, "connectivity/undriven-rail"));
});

test("unknown connector type throws", () => {
  const load = B("@t/l", [{ id: "v", role: "in", type: "power" }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "L", block: key(load) }], connectors: [{ ref: "J1", connector: "nope" }], connections: [] };
  assert.throws(() => resolve(d, lib(load)), /Unknown connector/);
});

test("connector pins appear as net MEMBERS (connectorPins) — the graph must not hide board I/O", () => {
  const mcu = B("@t/mcu", [{ id: "tx", role: "out", type: "signal" }]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "U1", block: key(mcu) }],
    connectors: [{ ref: "J1", connector: "hdr-4" }],
    connections: [{ from: "U1.tx", to: "J1.2" }],
  };
  const net = resolve(d, lib(mcu)).nets.find((n) => n.members.some((m) => m.terminal === "tx"));
  assert.deepEqual(net?.connectorPins, ["J1.2"]);
});

// ── Declared pins (catalog defaults + per-instance specs) ──────────────────
// A declared connector pin is a REAL pin at the board edge: it types and names nets, drives
// voltage into the rule stack, counts in budgets, and carries contact-rating checks.

const LOAD55 = B("@t/load55", [
  { id: "vin", role: "in", type: "power", v: { max: 5.5, unit: "V" }, i: { max: 0.4, unit: "A" } },
  { id: "gnd", role: "in", type: "gnd" },
]);
const BIGLOAD = B("@t/bigload", [
  { id: "vin", role: "in", type: "power", v: { max: 30, unit: "V" }, i: { max: 4, unit: "A" } },
  { id: "gnd", role: "in", type: "gnd" },
]);

test("USB-C catalog defaults: VBUS names + types the net and declares 5 V", () => {
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "L1", block: key(LOAD55) }],
    connections: [{ from: "J1.VBUS", to: "L1.vin" }, { from: "J1.GND", to: "L1.gnd" }],
    connectors: [{ ref: "J1", connector: "usb-c" }],
  };
  const rd = resolve(d, lib(LOAD55));
  const vbus = rd.nets.find((n) => n.members.some((m) => m.node === "L1.vin"))!;
  assert.equal(vbus.id, "VBUS");
  assert.equal(vbus.type, "power");
  assert.equal(vbus.voltage?.value, 5);
  const gnd = rd.nets.find((n) => n.members.some((m) => m.node === "L1.gnd"))!;
  assert.equal(gnd.type, "gnd");
});

test("user pin spec: 12 V declared on a header pin over-volts a 5.5 V-max input", () => {
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "L1", block: key(LOAD55) }],
    connections: [{ from: "J1.1", to: "L1.vin" }, { from: "J1.2", to: "L1.gnd" }],
    connectors: [{ ref: "J1", connector: "hdr-2", pins: {
      "1": { name: "VIN", type: "power", role: "out", v: { max: 12, unit: "V" } },
      "2": { name: "GND", type: "gnd" },
    } }],
  };
  const { findings } = analyze(d, lib(LOAD55));
  const hit = findings.find((f) => f.rule === "voltage/over-input" && f.at?.includes("L1.vin"));
  assert.ok(hit, "expected over-input at L1.vin; got: " + findings.map((f) => `${f.rule}@${f.at?.join("/")}`).join(", "));
  assert.match(hit!.message, /VIN/);
});

test("contact rating: 4 A through a 2 A-rated JST PH feed pin errors", () => {
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "L1", block: key(BIGLOAD) }],
    connections: [{ from: "J1.1", to: "L1.vin" }, { from: "J1.2", to: "L1.gnd" }],
    connectors: [{ ref: "J1", connector: "jst-ph-2" }], // BAT+ default: role out → carries net draw
  };
  const { findings } = analyze(d, lib(BIGLOAD));
  const hit = findings.find((f) => f.rule === "current/connector-pin" && f.severity === "error");
  assert.ok(hit, "expected connector-pin over-current; got: " + findings.map((f) => f.rule).join(", "));
  assert.match(hit!.message, /rated 2 A/);
});

test("contact rating: an off-board load's declared draw is checked against its own pin", () => {
  const src = B("@t/src5", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 3, unit: "A" } },
  ]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src) }],
    connections: [{ from: "S1.vout", to: "J1.VBUS" }],
    connectors: [{ ref: "J1", connector: "usb-a", pins: {
      VBUS: { role: "in", i: { max: 2, unit: "A" } }, // board feeds 2 A out a 1.5 A-rated USB-A contact
    } }],
  };
  const { findings } = analyze(d, lib(src));
  const hit = findings.find((f) => f.rule === "current/connector-pin" && f.at?.includes("J1.VBUS"));
  assert.ok(hit, "expected rating finding at J1.VBUS; got: " + findings.map((f) => `${f.rule}@${f.at?.join("/")}`).join(", "));
});

test("a freshly placed connector with nothing docked spawns no nets and no findings", () => {
  const d: Design = {
    id: "d", name: "d", blocks: [], connections: [],
    connectors: [{ ref: "J1", connector: "usb-c" }],
  };
  assert.equal(resolve(d, lib()).nets.length, 0);
  const { findings } = analyze(d, lib());
  assert.equal(findings.filter((f) => f.at?.some((s) => s.startsWith("J1"))).length, 0);
});

test("reverse polarity at the boundary: hot output wired into a gnd-typed connector pin", () => {
  const src = B("@t/srcrev", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 1, unit: "A" } },
  ]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src) }],
    connections: [{ from: "S1.vout", to: "J1.2" }], // pin 2 of a LiPo JST is BAT− (gnd by default)
    connectors: [{ ref: "J1", connector: "jst-ph-2" }],
  };
  const { findings } = analyze(d, lib(src));
  const hit = findings.find((f) => f.rule.includes("short") || f.rule.includes("polarity"));
  assert.ok(hit, "expected a short/polarity finding; got: " + findings.map((f) => f.rule).join(", "));
});

// ── USB inrush (declared-value, not simulation) ─────────────────────────────
const bulkBlock = (id: string, capVal: string): Block => ({
  id, name: id, version: "1.0.0",
  terminals: [
    { id: "vin", role: "in", type: "power", i: { max: 0.1, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
  ],
  schematic: {
    parts: [{ ref: "C1", type: "cap", value: capVal }],
    nets: [
      { name: "VIN", connect: ["C1.1", "@vin"] },
      { name: "GND", connect: ["C1.2", "@gnd"] },
    ],
  },
});

test("USB inrush: 22µF + 10µF of bulk on VBUS fires; names the caps", () => {
  const a = bulkBlock("@t/bulk-a", "22uF"), b2 = bulkBlock("@t/bulk-b", "10uF");
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "A1", block: key(a) }, { ref: "B1", block: key(b2) }],
    connections: [
      { from: "J1.VBUS", to: "A1.vin" }, { from: "J1.VBUS", to: "B1.vin" },
      { from: "J1.GND", to: "A1.gnd" }, { from: "J1.GND", to: "B1.gnd" },
    ],
    connectors: [{ ref: "J1", connector: "usb-c" }],
  };
  const { findings } = analyze(d, lib(a, b2));
  const hit = findings.find((f) => f.rule === "current/usb-inrush");
  assert.ok(hit, "expected usb-inrush; got: " + findings.map((f) => f.rule).join(", "));
  assert.match(hit!.message, /32 µF/);
  assert.match(hit!.message, /C1 22uF in A1/);
});

test("USB inrush: the canonical single 10µF input cap stays quiet", () => {
  const a = bulkBlock("@t/bulk-c", "10uF");
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "A1", block: key(a) }],
    connections: [{ from: "J1.VBUS", to: "A1.vin" }, { from: "J1.GND", to: "A1.gnd" }],
    connectors: [{ ref: "J1", connector: "usb-c" }],
  };
  assert.ok(!has(analyze(d, lib(a)).findings, "current/usb-inrush"));
});

test("USB inrush: 470µF on a BARREL jack is not a USB problem", () => {
  const a = bulkBlock("@t/bulk-d", "470uF");
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "A1", block: key(a) }],
    connections: [{ from: "J1.+", to: "A1.vin" }, { from: "J1.-", to: "A1.gnd" }],
    connectors: [{ ref: "J1", connector: "barrel" }],
  };
  assert.ok(!has(analyze(d, lib(a)).findings, "current/usb-inrush"));
});
