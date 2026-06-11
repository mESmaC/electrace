import test from "node:test";
import assert from "node:assert/strict";
import { resolve, solveDc, lint } from "../src/index.js";
import type { Block, Design, Terminal } from "../src/index.js";

// Stage 1 of the analysis ladder: MNA over the flattened design. These tests pin the
// arithmetic exactly — a solver that's almost right is worse than no solver.

const B = (id: string, terminals: Terminal[], schematic?: Block["schematic"]): Block =>
  ({ id, name: id, version: "1.0.0", terminals, schematic: schematic ?? { parts: [], nets: [] } });
const key = (b: Block) => `${b.id}@${b.version}`;
const lib = (...bs: Block[]) => new Map(bs.map((b) => [key(b), b]));

const SRC12 = B("@s/src12", [
  { id: "vout", role: "out", type: "power", v: { value: 12, unit: "V" }, i: { max: 2, unit: "A" } },
  { id: "gnd", role: "out", type: "gnd" },
]);

test("voltage divider solves exactly: 12 V over 10k+10k → 6 V at the midpoint", () => {
  const div = B("@s/div", [
    { id: "vin", role: "in", type: "power" },
    { id: "mid", role: "out", type: "signal" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "10k", footprint: "R0603" },
      { ref: "R2", type: "res", value: "10k", footprint: "R0603" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "MID", connect: ["R1.2", "R2.1", "@mid"] },
      { name: "GND", connect: ["R2.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "D1", block: key(div) }],
    connections: [{ from: "S1.vout", to: "D1.vin" }, { from: "S1.gnd", to: "D1.gnd" }],
  };
  const sol = solveDc(resolve(d, lib(SRC12, div)));
  assert.equal(sol.solvedComponents, 1);
  const mid = Object.entries(sol.netVolts).find(([k]) => k.includes("MID"));
  assert.ok(mid, "midpoint net solved: " + JSON.stringify(sol.netVolts));
  assert.ok(Math.abs(mid![1] - 6) < 1e-9, `expected 6 V, got ${mid![1]}`);
  // each 10k carries 0.6 mA → 3.6 mW
  const r1 = sol.parts.find((p) => p.ref === "D1/R1")!;
  assert.ok(Math.abs(r1.amps - 0.0006) < 1e-12 && Math.abs(r1.watts - 0.0036) < 1e-12);
});

test("declared load draw becomes a current sink: 5 V → 10 Ω series → 0.1 A load lands at 4 V", () => {
  const src5 = B("@s/src5", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 1, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const series = B("@s/series", [
    { id: "a", role: "in", type: "power" },
    { id: "b", role: "out", type: "power" },
  ], {
    parts: [{ ref: "R1", type: "res", value: "10", footprint: "R1206" }],
    nets: [
      { name: "A", connect: ["R1.1", "@a"] },
      { name: "B", connect: ["R1.2", "@b"] },
    ],
  });
  const load = B("@s/load", [
    { id: "vin", role: "in", type: "power", i: { max: 0.1, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
  ]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src5) }, { ref: "X1", block: key(series) }, { ref: "L1", block: key(load) }],
    connections: [
      { from: "S1.vout", to: "X1.a" }, { from: "X1.b", to: "L1.vin" }, { from: "S1.gnd", to: "L1.gnd" },
    ],
  };
  const sol = solveDc(resolve(d, lib(src5, series, load)));
  const b = Object.entries(sol.netVolts).find(([k]) => k.includes("B") && !k.includes("A"));
  assert.ok(b, JSON.stringify(sol.netVolts));
  assert.ok(Math.abs(b![1] - 4) < 1e-9, `expected 4 V after the drop, got ${b![1]}`);
});

test("dissipation rule fires from the REAL operating point: 12 V across 100 Ω 0603 = 1.44 W error", () => {
  const heater = B("@s/heater", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [{ ref: "R1", type: "res", value: "100", footprint: "R0603" }],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "GND", connect: ["R1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "H1", block: key(heater) }],
    connections: [{ from: "S1.vout", to: "H1.vin" }, { from: "S1.gnd", to: "H1.gnd" }],
  };
  const findings = lint(resolve(d, lib(SRC12, heater)));
  const hit = findings.find((f) => f.rule === "thermal/resistor-dissipation" && f.severity === "error");
  assert.ok(hit, "expected dissipation error; got: " + findings.map((f) => f.rule).join(", "));
  assert.match(hit!.message, /1\.44 W/);
  assert.match(hit!.message, /H1\/R1/);
});

test("a valueless resistor emits declaration/missing-value and doesn't poison the rest", () => {
  const div = B("@s/div2", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "10k" },
      { ref: "R2", type: "res" }, // no value
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "R2.1", "@vin"] },
      { name: "GND", connect: ["R1.2", "R2.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "D1", block: key(div) }],
    connections: [{ from: "S1.vout", to: "D1.vin" }, { from: "S1.gnd", to: "D1.gnd" }],
  };
  const sol = solveDc(resolve(d, lib(SRC12, div)));
  assert.ok(sol.findings.some((f) => f.rule === "declaration/missing-value" && f.at.includes("D1/R2")));
  assert.equal(sol.solvedComponents, 1); // R1 still solved
  assert.ok(sol.parts.some((p) => p.ref === "D1/R1"));
});

test("semiconductors are left open with a note; the bias network around them still solves", () => {
  const biased = B("@s/biased", [
    { id: "vin", role: "in", type: "power" },
    { id: "out", role: "out", type: "signal" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "10k", footprint: "R0603" }, // pull-up
      { ref: "Q1", type: "npn" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "OUT", connect: ["R1.2", "Q1.C", "@out"] },
      { name: "GND", connect: ["Q1.E", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "B1", block: key(biased) }],
    connections: [{ from: "S1.vout", to: "B1.vin" }, { from: "S1.gnd", to: "B1.gnd" }],
  };
  const sol = solveDc(resolve(d, lib(SRC12, biased)));
  assert.ok(sol.findings.some((f) => f.rule === "solve/nonlinear-open" && f.message.includes("B1/Q1")));
  // with Q1 open, the pull-up carries no current → OUT sits at 12 V (open-state correct)
  const out = Object.entries(sol.netVolts).find(([k]) => k.includes("OUT"));
  assert.ok(out && Math.abs(out[1] - 12) < 1e-9, JSON.stringify(sol.netVolts));
});

test("an inductor is a DC short: voltage carries straight across it", () => {
  const lc = B("@s/lc", [
    { id: "vin", role: "in", type: "power" },
    { id: "out", role: "out", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "L1", type: "inductor", value: "10uH" },
      { ref: "R1", type: "res", value: "1k", footprint: "R0603" }, // load so the net isn't floating
    ],
    nets: [
      { name: "VIN", connect: ["L1.1", "@vin"] },
      { name: "OUT", connect: ["L1.2", "R1.1", "@out"] },
      { name: "GND", connect: ["R1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "F1", block: key(lc) }],
    connections: [{ from: "S1.vout", to: "F1.vin" }, { from: "S1.gnd", to: "F1.gnd" }],
  };
  const sol = solveDc(resolve(d, lib(SRC12, lc)));
  const r1 = sol.parts.find((p) => p.ref === "F1/R1");
  assert.ok(r1 && Math.abs(r1.volts - 12) < 1e-9, "12 V should reach the load through the inductor");
});

test("a dangling declared load (unwired vin with i draw) must not poison the solve", () => {
  // regression: this exact shape made the whole component singular — KCL can't pull
  // 0.1 A from a node with no conductive path. The open-net rule owns the complaint.
  const load = B("@s/dangler", [
    { id: "vin", role: "in", type: "power", i: { max: 0.1, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
  ]);
  const div = B("@s/div3", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [{ ref: "R1", type: "res", value: "1k", footprint: "R0603" }],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "GND", connect: ["R1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "D1", block: key(div) }, { ref: "L1", block: key(load) }],
    connections: [
      { from: "S1.vout", to: "D1.vin" }, { from: "S1.gnd", to: "D1.gnd" },
      { from: "S1.gnd", to: "L1.gnd" }, // gnd wired, vin NOT — the declared draw dangles
    ],
  };
  const sol = solveDc(resolve(d, lib(SRC12, div, load)));
  assert.equal(sol.solvedComponents, 1);
  assert.ok(!sol.findings.some((f) => f.rule === "solve/unsolvable"));
  assert.ok(sol.parts.some((p) => p.ref === "D1/R1" && Math.abs(p.volts - 12) < 1e-9));
});
