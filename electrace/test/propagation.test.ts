import test from "node:test";
import assert from "node:assert/strict";
import { resolve, analyze, railBudgets } from "../src/index.js";
import type { Block, Design } from "../src/index.js";

// Minimal blocks reproducing walkthrough #1's P1 gaps: an 18V source, a chip whose OUT
// swings at its supply (v.follows), and a 5.5V-max load drawing 15mA from that output.
const SRC: Block = {
  id: "@t/src", name: "Source", version: "1", category: "power",
  terminals: [
    { id: "vout", role: "out", type: "power", v: { min: 9, max: 18, unit: "V" }, i: { max: 2, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ], schematic: { parts: [], nets: [] },
};
const CHIP: Block = {
  id: "@t/chip", name: "Chip", version: "1", category: "signal",
  terminals: [
    { id: "vcc", role: "in", type: "power", v: { min: 4.5, max: 15, unit: "V" }, i: { max: 0.015, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
    { id: "out", role: "out", type: "signal", v: { follows: "vcc" } },
  ], schematic: { parts: [], nets: [] },
};
const LOAD: Block = {
  id: "@t/load", name: "Load", version: "1", category: "signal",
  terminals: [
    { id: "vin", role: "in", type: "signal", v: { max: 5.5, unit: "V" }, i: { max: 0.015, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
  ], schematic: { parts: [], nets: [] },
};
const blocks = new Map<string, Block>([["@t/src@1", SRC], ["@t/chip@1", CHIP], ["@t/load@1", LOAD]]);
const design: Design = {
  id: "d", name: "d", blocks: [
    { ref: "S1", block: "@t/src@1" }, { ref: "C1", block: "@t/chip@1" }, { ref: "L1", block: "@t/load@1" },
  ],
  connections: [
    { from: "S1.vout", to: "C1.vcc" }, { from: "S1.gnd", to: "C1.gnd" },
    { from: "C1.out", to: "L1.vin" }, { from: "C1.gnd", to: "L1.gnd" },
  ],
};

test("v.follows propagates supply voltage onto signal nets", () => {
  const rd = resolve(design, blocks);
  const outNet = rd.nets.find((n) => n.members.some((m) => m.node === "C1.out"))!;
  assert.equal(outNet.voltage?.max, 18);
});

test("over-voltage fires on the SIGNAL chain (18V out into 5.5V-max input)", () => {
  const a = analyze(design, blocks);
  const hit = a.findings.find((f) => f.rule === "voltage/over-input" && f.at?.includes("L1.vin"));
  assert.ok(hit, "expected over-input finding at L1.vin; got: " + a.findings.map((f) => `${f.rule}@${f.at?.join("/")}`).join(", "));
});

test("load current charges back through the chip to the supply rail", () => {
  const a = analyze(design, blocks);
  const rail = railBudgets(a.resolved).find((b) => b.voltage === 18)!;
  // chip's own 15mA + load's 15mA through the chip's output = 30mA on the rail
  assert.ok(rail.drawA >= 0.03 - 1e-9, `rail draw ${rail.drawA} A, expected >= 0.03`);
});

test("rail capacity SUMS paralleled sources — no phantom over-budget (budget audit fix)", () => {
  // two 2A supplies feeding one 5V rail = 4A capacity; a 3A load is FINE. Taking only the first
  // source rated the rail at 2A and fired a confident over-budget ERROR on a legitimate topology.
  const PSU: Block = {
    id: "@t/psu", name: "PSU", version: "1", category: "power",
    terminals: [
      { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 2, unit: "A" } },
      { id: "gnd", role: "out", type: "gnd" },
    ], schematic: { parts: [], nets: [] },
  };
  const HOG: Block = {
    id: "@t/hog", name: "Hog", version: "1", category: "signal",
    terminals: [
      { id: "vin", role: "in", type: "power", v: { min: 4.5, max: 5.5, unit: "V" }, i: { max: 3, unit: "A" } },
      { id: "gnd", role: "in", type: "gnd" },
    ], schematic: { parts: [], nets: [] },
  };
  const bl = new Map<string, Block>([["@t/psu@1", PSU], ["@t/hog@1", HOG]]);
  const d: Design = {
    id: "par", name: "par",
    blocks: [{ ref: "P1", block: "@t/psu@1" }, { ref: "P2", block: "@t/psu@1" }, { ref: "H1", block: "@t/hog@1" }],
    connections: [
      { from: "P1.vout", to: "H1.vin" }, { from: "P2.vout", to: "H1.vin" },
      { from: "P1.gnd", to: "H1.gnd" }, { from: "P2.gnd", to: "H1.gnd" },
    ],
  };
  const a = analyze(d, bl);
  assert.ok(!a.findings.some((f) => f.rule === "current/over-budget" && f.severity === "error"),
    "two 2A sources (4A) feeding a 3A load must NOT over-budget; got " + a.findings.filter((f) => f.rule === "current/over-budget").map((f) => f.message).join("|"));
  const rail = railBudgets(a.resolved).find((x) => x.voltage === 5)!;
  assert.equal(rail.capacityA, 4, "capacity must sum both paralleled sources");
});

// ---- lint wave on top of propagation ----
test("signal-source over-current: 3 heavy loads on a 20mA-rated output", () => {
  const GPIO: Block = {
    id: "@t/gpio", name: "G", version: "1", category: "signal",
    terminals: [
      { id: "vcc", role: "in", type: "power", v: { min: 3, max: 5.5, unit: "V" } },
      { id: "out", role: "out", type: "signal", i: { max: 0.02, unit: "A" } },
      { id: "gnd", role: "in", type: "gnd" },
    ], schematic: { parts: [], nets: [] },
  };
  const blocks2 = new Map<string, Block>([["@t/src@1", SRC], ["@t/gpio@1", GPIO], ["@t/load@1", LOAD]]);
  const d: Design = {
    id: "d2", name: "d2",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "G1", block: "@t/gpio@1" },
      { ref: "L1", block: "@t/load@1" }, { ref: "L2", block: "@t/load@1" }, { ref: "L3", block: "@t/load@1" }],
    connections: [
      { from: "S1.vout", to: "G1.vcc" }, { from: "S1.gnd", to: "G1.gnd" },
      { from: "G1.out", to: "L1.vin" }, { from: "G1.out", to: "L2.vin" }, { from: "G1.out", to: "L3.vin" },
      { from: "G1.gnd", to: "L1.gnd" }, { from: "G1.gnd", to: "L2.gnd" }, { from: "G1.gnd", to: "L3.gnd" },
    ],
  };
  const a = analyze(d, blocks2);
  const hit = a.findings.find((f) => f.rule === "current/signal-over-source");
  assert.ok(hit, "expected signal-over-source (45mA on a 20mA pin); got " + a.findings.map((f) => f.rule).join(","));
});

test("short circuit: power source wired to ground", () => {
  const d: Design = {
    id: "d3", name: "d3",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "C1", block: "@t/chip@1" }],
    connections: [{ from: "S1.vout", to: "C1.gnd" }, { from: "S1.gnd", to: "C1.gnd" }],
  };
  const a = analyze(d, blocks);
  assert.ok(a.findings.some((f) => f.rule === "connectivity/short-circuit"),
    "expected short-circuit; got " + a.findings.map((f) => f.rule).join(","));
});

test("under-voltage: rail sags below an input's declared minimum", () => {
  const HUNGRY: Block = {
    id: "@t/hungry", name: "H", version: "1", category: "signal",
    terminals: [
      { id: "vcc", role: "in", type: "power", v: { min: 12, max: 24, unit: "V" } },
      { id: "gnd", role: "in", type: "gnd" },
    ], schematic: { parts: [], nets: [] },
  };
  const blocks3 = new Map<string, Block>([["@t/src@1", SRC], ["@t/hungry@1", HUNGRY]]);
  const d: Design = {
    id: "d4", name: "d4",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "H1", block: "@t/hungry@1" }],
    connections: [{ from: "S1.vout", to: "H1.vcc" }, { from: "S1.gnd", to: "H1.gnd" }],
  };
  const a = analyze(d, blocks3); // source 9-18V, input needs >=12V → sags below
  assert.ok(a.findings.some((f) => f.rule === "voltage/under-input"),
    "expected under-input; got " + a.findings.map((f) => f.rule).join(","));
});

test("regulator dissipation at ACTUAL load", () => {
  const LDO: Block = {
    id: "@t/ldo", name: "LDO", version: "1", category: "power", topology: "linear",
    transform: { kind: "regulator", efficiency: 0.3 },
    terminals: [
      { id: "vin", role: "in", type: "power", v: { min: 9, max: 18, unit: "V" } },
      { id: "vout", role: "out", type: "rail", v: { value: 3.3, unit: "V" }, i: { max: 1, unit: "A" } },
      { id: "gnd", role: "in", type: "gnd" },
    ], schematic: { parts: [], nets: [] },
  };
  const BIGLOAD: Block = {
    id: "@t/big", name: "B", version: "1", category: "signal",
    terminals: [
      { id: "vin", role: "in", type: "rail", v: { min: 3, max: 5.5, unit: "V" }, i: { max: 0.2, unit: "A" } },
      { id: "gnd", role: "in", type: "gnd" },
    ], schematic: { parts: [], nets: [] },
  };
  const blocks4 = new Map<string, Block>([["@t/src@1", SRC], ["@t/ldo@1", LDO], ["@t/big@1", BIGLOAD]]);
  const d: Design = {
    id: "d5", name: "d5",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "R1", block: "@t/ldo@1" }, { ref: "B1", block: "@t/big@1" }],
    connections: [
      { from: "S1.vout", to: "R1.vin" }, { from: "S1.gnd", to: "R1.gnd" },
      { from: "R1.vout", to: "B1.vin" }, { from: "R1.gnd", to: "B1.gnd" },
    ],
  };
  const a = analyze(d, blocks4); // (18-3.3)V × 0.2A = 2.94W → error tier
  const hit = a.findings.find((f) => f.rule === "thermal/regulator-dissipation");
  assert.ok(hit && hit.severity === "error", "expected error-tier dissipation; got " + JSON.stringify(hit ?? a.findings.map((f) => f.rule)));
});

// ---- galvanic isolation constraints ----
const OPTO: Block = {
  id: "@t/opto", name: "Opto", version: "1", category: "interface",
  isolation: [["a", "k"], ["c", "e"]],
  terminals: [
    { id: "a", role: "in", type: "signal" }, { id: "k", role: "in", type: "signal" },
    { id: "c", role: "out", type: "signal" }, { id: "e", role: "in", type: "gnd" },
  ], schematic: { parts: [], nets: [] },
};

test("isolation holds when only light crosses (opto in the middle)", () => {
  const blocks5 = new Map<string, Block>([["@t/src@1", SRC], ["@t/opto@1", OPTO], ["@t/load@1", LOAD]]);
  const d: Design = {
    id: "i1", name: "i1",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "O1", block: "@t/opto@1" }, { ref: "L1", block: "@t/load@1" }],
    connections: [
      { from: "S1.vout", to: "O1.a" }, { from: "S1.gnd", to: "O1.k" },     // dirty side
      { from: "O1.c", to: "L1.vin" }, { from: "O1.e", to: "L1.gnd" },     // clean side
    ],
    isolation: [{ a: "S1", b: "L1" }],
  };
  const a = analyze(d, blocks5);
  assert.ok(!a.findings.some((f) => f.rule === "isolation/bridged"),
    "no bridge expected; got " + a.findings.filter((f) => f.rule === "isolation/bridged").map((f) => f.message).join(" | "));
});

test("isolation bridged via a shared ground names the bridging net", () => {
  const blocks5 = new Map<string, Block>([["@t/src@1", SRC], ["@t/opto@1", OPTO], ["@t/load@1", LOAD]]);
  const d: Design = {
    id: "i2", name: "i2",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "O1", block: "@t/opto@1" }, { ref: "L1", block: "@t/load@1" }],
    connections: [
      { from: "S1.vout", to: "O1.a" }, { from: "S1.gnd", to: "O1.k" },
      { from: "O1.c", to: "L1.vin" }, { from: "O1.e", to: "L1.gnd" },
      { from: "S1.gnd", to: "L1.gnd" }, // the mistake: grounds tied across the barrier
    ],
    isolation: [{ a: "S1", b: "L1" }],
  };
  const a = analyze(d, blocks5);
  const hit = a.findings.find((f) => f.rule === "isolation/bridged");
  assert.ok(hit, "expected bridge finding");
  assert.match(hit!.message, /net /, "message should name the bridging net: " + hit!.message);
});

test("isolate-against-all checks every other block", () => {
  const blocks6 = new Map<string, Block>([["@t/src@1", SRC], ["@t/chip@1", CHIP]]);
  const d: Design = {
    id: "i3", name: "i3",
    blocks: [{ ref: "S1", block: "@t/src@1" }, { ref: "C1", block: "@t/chip@1" }],
    connections: [{ from: "S1.vout", to: "C1.vcc" }, { from: "S1.gnd", to: "C1.gnd" }],
    isolation: [{ a: "S1", b: "*" }],
  };
  const a = analyze(d, blocks6);
  assert.ok(a.findings.some((f) => f.rule === "isolation/bridged" && f.at.includes("C1")));
});

// ---- SI net classes ----
import { drcCheck, NET_CLASSES, criticalLengthMm } from "../src/index.js";

const XCVR: Block = {
  id: "@t/485", name: "RS485", version: "1", category: "interface",
  terminals: [
    { id: "a", role: "out", type: "signal" }, { id: "b", role: "out", type: "signal" },
    { id: "vcc", role: "in", type: "power", v: { min: 3, max: 5.5, unit: "V" } }, { id: "gnd", role: "in", type: "gnd" },
  ],
  schematic: { parts: [], nets: [] },
};
const TERM: Block = {
  id: "@t/term", name: "Term", version: "1", category: "interface",
  terminals: [{ id: "a", role: "in", type: "signal" }, { id: "b", role: "in", type: "signal" }],
  schematic: {
    parts: [{ ref: "RT", type: "res", value: "120" }],
    nets: [{ name: "A", connect: ["RT.1", "@a"] }, { name: "B", connect: ["RT.2", "@b"] }],
  },
};

test("SI: unterminated RS-485 pair warns; adding the 120R termination clears it", () => {
  const blocks7 = new Map<string, Block>([["@t/485@1", XCVR], ["@t/term@1", TERM]]);
  const bare: Design = {
    id: "s1", name: "s1",
    blocks: [{ ref: "X1", block: "@t/485@1" }, { ref: "X2", block: "@t/485@1" }],
    connections: [{ from: "X1.a", to: "X2.a" }, { from: "X1.b", to: "X2.b" }],
    signals: [{ pin: "X1.a", pairPin: "X1.b", cls: "rs485" }],
  };
  const a1 = analyze(bare, blocks7);
  assert.ok(a1.findings.some((f) => f.rule === "si/termination-missing"), "expected termination warning");
  const terminated: Design = {
    ...bare, id: "s2",
    blocks: [...bare.blocks, { ref: "T1", block: "@t/term@1" }],
    connections: [...bare.connections, { from: "X1.a", to: "T1.a" }, { from: "X1.b", to: "T1.b" }],
  };
  const a2 = analyze(terminated, blocks7);
  assert.ok(!a2.findings.some((f) => f.rule === "si/termination-missing"),
    "termination present should clear it; got " + a2.findings.filter((f) => f.rule.startsWith("si/")).map((f) => f.message).join("|"));
});

test("SI: RS-485 declared on CONNECTOR pins still warns; terminating it clears it (F13)", () => {
  // F13 regression: an unspec'd connector pin (bare hdr-2 contact) lives only in net.connectorPins,
  // not net.members, so the rule's netOf used to miss it → silent no-fire on a real off-board bus.
  const blocks7 = new Map<string, Block>([["@t/485@1", XCVR], ["@t/term@1", TERM]]);
  const bare: Design = {
    id: "f13a", name: "f13a",
    blocks: [{ ref: "X1", block: "@t/485@1" }],
    connectors: [{ ref: "J2", connector: "hdr-2" }, { ref: "J3", connector: "hdr-2" }],
    connections: [{ from: "J2.1", to: "X1.a" }, { from: "J3.1", to: "X1.b" }],
    signals: [{ pin: "J2.1", pairPin: "J3.1", cls: "rs485" }], // class anchored ON the connector pins
  };
  const a1 = analyze(bare, blocks7);
  assert.ok(a1.findings.some((f) => f.rule === "si/termination-missing"),
    "connector-anchored RS-485 with no termination must warn (F13 silent no-fire)");
  // adding the 120R terminator across the same connector pins must clear it — guards against trading
  // the no-fire for a false-fire (the worse sin)
  const terminated: Design = {
    ...bare, id: "f13b",
    blocks: [...bare.blocks, { ref: "T1", block: "@t/term@1" }],
    connections: [...bare.connections, { from: "J2.1", to: "T1.a" }, { from: "J3.1", to: "T1.b" }],
  };
  const a2 = analyze(terminated, blocks7);
  assert.ok(!a2.findings.some((f) => f.rule === "si/termination-missing"),
    "termination across the connector pair must stay silent; got " + a2.findings.filter((f) => f.rule.startsWith("si/")).map((f) => f.message).join("|"));
});

test("SI: I2C 400k with weak pull-ups warns with the fix in the message", () => {
  const d: Design = {
    id: "s3", name: "s3",
    blocks: [{ ref: "C1", block: "@t/chip@1" }, { ref: "C2", block: "@t/chip@1" }],
    connections: [{ from: "C1.out", to: "C2.vcc" }],
    signals: [{ pin: "C1.out", cls: "i2c-400k", pullupOhms: 10000 }],
  };
  const a = analyze(d, blocks);
  const hit = a.findings.find((f) => f.rule === "si/i2c-rise-time");
  assert.ok(hit, "expected rise-time warning");
  assert.match(hit!.message, /Drop the pull-ups/);
});

test("SI: I2C rise-time declared on a CONNECTOR pin still fires + counts connector pins (F14)", () => {
  // F14 regression (parallels F13): an I2C class anchored on a bare connector pin lives only in
  // net.connectorPins, not net.members — so the rule's net lookup missed it (silent no-fire) and the
  // device count (→ C_bus → the rise number) ignored connector pins (a WRONG, hand-checkable number).
  const blocks8 = new Map<string, Block>([["@t/chip@1", CHIP]]);
  const d: Design = {
    id: "f14", name: "f14",
    blocks: [{ ref: "C1", block: "@t/chip@1" }],
    connectors: [{ ref: "J1", connector: "hdr-2" }],
    connections: [{ from: "J1.1", to: "C1.out" }],
    signals: [{ pin: "J1.1", cls: "i2c-400k", pullupOhms: 10000 }], // class anchored ON the connector pin
  };
  const a = analyze(d, blocks8);
  const hit = a.findings.find((f) => f.rule === "si/i2c-rise-time");
  assert.ok(hit, "connector-anchored I2C must resolve its net and fire (F14 silent no-fire)");
  assert.match(hit!.message, /Drop the pull-ups/);
  // the connector pin must be counted as a device — the net spans J1.1 (connector) + C1.out (member)
  assert.match(hit!.derivation ?? "", /40 pF/, "C_bus must include the connector pin: " + hit!.derivation);
});

test("SI: DRC flags electrically-long traces and pair skew", () => {
  const edge = NET_CLASSES["fast-edge"].edgeNs!;
  const lim = criticalLengthMm(edge); // 2ns -> 50mm
  const v = drcCheck({
    traces: [
      { id: "t1", net: "CLK", layer: "F.Cu", width: 0.3, path: [{ x: 0, y: 0 }, { x: lim + 30, y: 0 }] },
      { id: "t2", net: "DP", layer: "F.Cu", width: 0.3, path: [{ x: 0, y: 5 }, { x: 40, y: 5 }] },
      { id: "t3", net: "DN", layer: "F.Cu", width: 0.3, path: [{ x: 0, y: 6 }, { x: 52, y: 6 }] },
    ],
    pads: [], vias: [], comps: [], unrouted: [], clearance: 0.2,
    signals: [
      { net: "CLK", clsName: "Fast edge", maxLenMm: lim },
      { net: "DP", clsName: "USB FS", pairNet: "DN", skewMm: 4 },
    ],
  });
  assert.ok(v.some((x) => x.kind === "si-long" && x.net === "CLK"), "expected si-long");
  assert.ok(v.some((x) => x.kind === "si-skew"), "expected si-skew (12mm mismatch > 4mm)");
});
