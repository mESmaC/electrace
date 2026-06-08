import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/index.js";
import type { Block, Design, Terminal } from "../src/index.js";

const B = (id: string, terminals: Terminal[], extra: Partial<Block> = {}): Block =>
  ({ id, name: id, version: "1.0.0", terminals, ...extra });
const key = (b: Block) => `${b.id}@${b.version}`;
const lib = (...bs: Block[]) => new Map(bs.map((b) => [key(b), b]));
const has = (fs: { rule: string }[], rule: string) => fs.some((f) => f.rule === rule);

test("multiple-drivers fires when two outputs share a net", () => {
  const s = B("@t/s", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const t = B("@t/t", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(s) }, { ref: "T", block: key(t) }], connections: [{ from: "S.o", to: "T.o" }] };
  assert.ok(has(analyze(d, lib(s, t)).findings, "connectivity/multiple-drivers"));
});

test("undriven-rail fires when a rail feeds loads with no source", () => {
  const a = B("@t/a", [{ id: "i", role: "in", type: "rail", v: { value: 5 }, i: { max: 1 } }]);
  const b = B("@t/b", [{ id: "i", role: "in", type: "rail", v: { value: 5 }, i: { max: 1 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "A", block: key(a) }, { ref: "B", block: key(b) }], connections: [{ from: "A.i", to: "B.i" }] };
  assert.ok(has(analyze(d, lib(a, b)).findings, "connectivity/undriven-rail"));
});

test("undriven-rail does NOT fire with a source, nor for grounds", () => {
  const src = B("@t/src", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }, { id: "g", role: "out", type: "gnd" }]);
  const load = B("@t/load", [{ id: "i", role: "in", type: "rail", v: { value: 5 }, i: { max: 1 } }, { id: "g", role: "in", type: "gnd" }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }], connections: [{ from: "S.o", to: "L.i" }, { from: "S.g", to: "L.g" }] };
  const f = analyze(d, lib(src, load)).findings;
  assert.ok(!has(f, "connectivity/undriven-rail"));
  assert.ok(!has(f, "connectivity/multiple-drivers"));
});

test("empty-block fires for an interface shell, not for a populated block", () => {
  const shell = B("@user/q1", [{ id: "g", role: "in", type: "signal" }]); // no schematic.parts
  const real = B("@t/real", [{ id: "i", role: "in", type: "signal" }], { schematic: { parts: [{ ref: "R1", type: "res", value: "10k" }], nets: [] } });
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "Q1", block: key(shell) }, { ref: "R", block: key(real) }], connections: [{ from: "Q1.g", to: "R.i" }] };
  const f = analyze(d, lib(shell, real)).findings.filter((x) => x.rule === "completeness/empty-block");
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].at, ["Q1"]);
});

test("undriven-rail is suppressed when the terminal is off-board", () => {
  const load = B("@t/load", [{ id: "i", role: "in", type: "power", external: true }]);
  const sink = B("@t/sink", [{ id: "i", role: "in", type: "power" }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "L", block: key(load) }, { ref: "K", block: key(sink) }], connections: [{ from: "L.i", to: "K.i" }] };
  assert.ok(!has(analyze(d, lib(load, sink)).findings, "connectivity/undriven-rail"));
});

test("an acknowledged finding is muted (flagged + not counted as a warning), keyed to its subject", () => {
  const s = B("@t/s", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const t = B("@t/t", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const base: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(s) }, { ref: "T", block: key(t) }], connections: [{ from: "S.o", to: "T.o" }] };
  // the net id the two drivers share (what the finding points at)
  const net = analyze(base, lib(s, t)).findings.find((f) => f.rule === "connectivity/multiple-drivers")!.at;

  const acked: Design = { ...base, acks: [{ rule: "connectivity/multiple-drivers", at: net, note: "intentional diode-OR" }] };
  const f = analyze(acked, lib(s, t)).findings.find((x) => x.rule === "connectivity/multiple-drivers")!;
  assert.ok(f.acknowledged, "the finding is flagged acknowledged");
  assert.equal(f.acknowledged!.note, "intentional diode-OR");
  // it must NOT count among active warnings anymore
  assert.equal(analyze(acked, lib(s, t)).findings.filter((x) => x.severity === "warn" && !x.acknowledged).length, 0);
});

test("a grouped ack (many pins in one entry) mutes each per-pin open-net finding", () => {
  // three blocks, each with an unconnected output → three separate open-net findings (one pin each)
  const drv = (n: string) => B(`@t/${n}`, [
    { id: "vin", role: "in", type: "power", v: { value: 5 } },
    { id: "spi", role: "out", type: "signal" }, // left unconnected on purpose
  ]);
  const a = drv("a"), b = drv("b"), c = drv("c");
  const src = B("@t/src", [{ id: "o", role: "out", type: "power", v: { value: 5 }, i: { max: 1 } }]);
  const base: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S", block: key(src) }, { ref: "A", block: key(a) }, { ref: "B", block: key(b) }, { ref: "C", block: key(c) }],
    connections: [{ from: "S.o", to: "A.vin" }, { from: "A.vin", to: "B.vin" }, { from: "B.vin", to: "C.vin" }],
  };
  const opens = analyze(base, lib(src, a, b, c)).findings.filter((f) => f.rule === "connectivity/open-net");
  assert.ok(opens.length >= 3, "each unconnected spi pin is its own open-net finding");
  const at = opens.flatMap((f) => f.at); // the net ids/subjects the findings point at

  // ONE grouped ack listing all three pins should mute ALL of them (subset match, not exact)
  const acked: Design = { ...base, acks: [{ rule: "connectivity/open-net", at, note: "intentional — strap config" }] };
  const after = analyze(acked, lib(src, a, b, c)).findings.filter((f) => f.rule === "connectivity/open-net");
  assert.ok(after.every((f) => f.acknowledged), "every per-pin open-net finding is muted by the one grouped ack");
  assert.equal(after.filter((f) => !f.acknowledged).length, 0);
});
