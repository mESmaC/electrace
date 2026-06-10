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
