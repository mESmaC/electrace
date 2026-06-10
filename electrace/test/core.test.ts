import test from "node:test";
import assert from "node:assert/strict";
import { resolve, analyze, flatten, toKicadNetlist } from "../src/index.js";
import type { Block, Design, Terminal } from "../src/index.js";

// ── tiny builders (pure objects — no files) ────────────────────────────────
const B = (id: string, terminals: Terminal[], extra: Partial<Block> = {}): Block =>
  ({ id, name: id, version: "1.0.0", terminals, ...extra });
const key = (b: Block) => `${b.id}@${b.version}`;
const lib = (...bs: Block[]) => new Map(bs.map((b) => [key(b), b]));

// ── resolve / net stitching ─────────────────────────────────────────────────
test("intra-block equivalence merges grounds into one net", () => {
  const src = B("@t/src", [
    { id: "vout", role: "out", type: "power", v: { min: 9, max: 18 } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const reg = B("@t/reg", [
    { id: "vin", role: "in", type: "power", v: { min: 9, max: 18 } },
    { id: "gnd_in", role: "in", type: "gnd" },
    { id: "vout", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } },
    { id: "gnd_out", role: "out", type: "gnd" },
  ], { schematic: { parts: [], nets: [{ name: "GND", connect: ["@gnd_in", "@gnd_out"] }] } });
  const load = B("@t/load", [
    { id: "vdd", role: "in", type: "rail", v: { value: 5 }, i: { max: 1 } },
    { id: "gnd", role: "in", type: "gnd" },
  ]);
  const design: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S", block: key(src) }, { ref: "R", block: key(reg) }, { ref: "L", block: key(load) }],
    connections: [
      { from: "S.vout", to: "R.vin" }, { from: "S.gnd", to: "R.gnd_in" },
      { from: "R.vout", to: "L.vdd" }, { from: "R.gnd_out", to: "L.gnd" },
    ],
  };
  const rd = resolve(design, lib(src, reg, load));
  const gnds = rd.nets.filter((n) => n.type === "gnd");
  assert.equal(gnds.length, 1, "grounds should merge to one net");
  assert.equal(gnds[0].members.length, 4);
});

// ── current ──────────────────────────────────────────────────────────────────
test("over-current fires when load exceeds source", () => {
  const src = B("@t/src", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const load = B("@t/load", [{ id: "i", role: "in", type: "rail", v: { value: 5 }, i: { max: 4 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }], connections: [{ from: "S.o", to: "L.i" }] };
  const { findings } = analyze(d, lib(src, load));
  assert.ok(findings.some((f) => f.rule === "current/over-budget" && f.severity === "error"));
});

test("no over-current when within budget", () => {
  const src = B("@t/src", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const load = B("@t/load", [{ id: "i", role: "in", type: "rail", v: { value: 5 }, i: { max: 1 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }], connections: [{ from: "S.o", to: "L.i" }] };
  const { findings } = analyze(d, lib(src, load));
  assert.ok(!findings.some((f) => f.rule === "current/over-budget"));
});

// ── voltage ────────────────────────────────────────────────────────────────
test("over-voltage fires when net exceeds an input's max", () => {
  const src = B("@t/s", [{ id: "o", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } }]);
  const load = B("@t/l", [{ id: "i", role: "in", type: "rail", v: { max: 3.3 }, i: { max: 0.1 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }], connections: [{ from: "S.o", to: "L.i" }] };
  const { findings } = analyze(d, lib(src, load));
  assert.ok(findings.some((f) => f.rule === "voltage/over-input"));
});

// ── power propagation ────────────────────────────────────────────────────────
test("power propagates backward through a regulator", () => {
  const reg = B("@t/buck", [
    { id: "vin", role: "in", type: "power", v: { min: 9, max: 18 } },
    { id: "vout", role: "out", type: "rail", v: { value: 5 }, i: { max: 3 } },
  ], { transform: { kind: "regulator", efficiency: 0.85 } });
  const load = B("@t/load", [{ id: "vdd", role: "in", type: "rail", v: { value: 5 }, i: { max: 1.8 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "R", block: key(reg) }, { ref: "L", block: key(load) }], connections: [{ from: "R.vout", to: "L.vdd" }] };
  const { power } = analyze(d, lib(reg, load));
  const p = power.transforms["R"];
  assert.ok(p, "regulator power should be computed");
  // 1.8 A × 5 V = 9 W out → 9/0.85 ≈ 10.59 W in → /9 V ≈ 1.18 A
  assert.ok(Math.abs(p.iIn - 1.18) < 0.02, `expected ~1.18 A in, got ${p.iIn}`);
});

// ── polarity ──────────────────────────────────────────────────────────────────
test("polarity conflict fires when power meets ground", () => {
  const a = B("@t/a", [{ id: "o", role: "out", type: "power", v: { value: 5 } }]);
  const b = B("@t/b", [{ id: "g", role: "in", type: "gnd" }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "A", block: key(a) }, { ref: "B", block: key(b) }], connections: [{ from: "A.o", to: "B.g" }] };
  const { findings } = analyze(d, lib(a, b));
  assert.ok(findings.some((f) => f.rule === "polarity/conflict"));
});

// ── flat schematic (export correctness) ────────────────────────────────────
test("flatten stitches nets across block boundaries", () => {
  const src = B("@t/s", [{ id: "vout", role: "out", type: "power", v: { value: 5 } }],
    { schematic: { parts: [{ ref: "P1", type: "x" }], nets: [{ name: "OUT", connect: ["P1.a", "@vout"] }] } });
  const load = B("@t/l", [{ id: "vin", role: "in", type: "power", v: { max: 6 } }],
    { schematic: { parts: [{ ref: "P2", type: "y" }], nets: [{ name: "IN", connect: ["P2.b", "@vin"] }] } });
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }], connections: [{ from: "S.vout", to: "L.vin", net: "V5" }] };
  const flat = flatten(resolve(d, lib(src, load)));
  const merged = flat.nets.find((n) => n.pins.includes("S/P1.a"));
  assert.ok(merged, "a net containing S/P1.a should exist");
  assert.ok(merged!.pins.includes("L/P2.b"), "it should also include L/P2.b (merged across the boundary)");
  assert.equal(flat.parts.length, 2);
});

test("kicad netlist export is well-formed", () => {
  const src = B("@t/s", [{ id: "vout", role: "out", type: "power", v: { value: 5 } }],
    { schematic: { parts: [{ ref: "R1", type: "res", value: "1k" }], nets: [{ name: "OUT", connect: ["R1.1", "@vout"] }] } });
  const load = B("@t/l", [{ id: "vin", role: "in", type: "power", v: { max: 6 } }],
    { schematic: { parts: [{ ref: "C1", type: "cap", value: "1u" }], nets: [{ name: "IN", connect: ["C1.1", "@vin"] }] } });
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }], connections: [{ from: "S.vout", to: "L.vin", net: "V5" }] };
  const netlist = toKicadNetlist(flatten(resolve(d, lib(src, load))), { date: "" });

  // parens must balance, or KiCad won't parse it
  const opens = (netlist.match(/\(/g) ?? []).length;
  const closes = (netlist.match(/\)/g) ?? []).length;
  assert.equal(opens, closes, "parentheses must balance");
  // re-annotated refs + the merged net are present
  assert.match(netlist, /\(ref "R1"\)/);
  assert.match(netlist, /\(ref "C1"\)/);
  assert.match(netlist, /\(name "V5"\)/);
});

// ── connectivity ──────────────────────────────────────────────────────────────
test("open-net flags an unconnected terminal", () => {
  const a = B("@t/a", [
    { id: "o", role: "out", type: "signal" },
    { id: "p", role: "out", type: "power", v: { value: 5 } },
  ]);
  const b = B("@t/b", [{ id: "i", role: "in", type: "power", v: { max: 6 } }]);
  const d: Design = { id: "d", name: "d", blocks: [{ ref: "A", block: key(a) }, { ref: "B", block: key(b) }], connections: [{ from: "A.p", to: "B.i" }] };
  const { findings } = analyze(d, lib(a, b));
  assert.ok(findings.some((f) => f.rule === "connectivity/open-net" && f.at[0] === "A.o"));
});

test("a stale wire doesn't kill the analysis — it becomes a dangling-wire finding with the fix", () => {
  const src = B("@t/src", [{ id: "out", role: "out", type: "rail", v: { value: 5, unit: "V" } }]);
  const load = B("@t/load", [{ id: "vin", role: "in", type: "rail" }]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S", block: key(src) }, { ref: "L", block: key(load) }],
    connections: [
      { from: "S.out", to: "L.vin" },          // healthy
      { from: "S.out", to: "L.GATE" },         // stale — L has no GATE
    ],
  };
  const a = analyze(d, lib(src, load));
  // the healthy wire still resolves into a real net
  assert.ok(a.resolved.nets.some((n) => n.members.length === 2));
  // and the stale one is a precise, actionable error — not a thrown analysis
  const f = a.findings.find((x) => x.rule === "connectivity/dangling-wire");
  assert.ok(f, "dangling-wire finding emitted");
  assert.ok(f!.message.includes("L's terminals are: vin"), f!.message);
});
