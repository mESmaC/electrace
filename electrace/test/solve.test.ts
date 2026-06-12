import test from "node:test";
import assert from "node:assert/strict";
import { resolve, solveDc, theveninAt, standbyDraw, lint } from "../src/index.js";
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

test("terminal aliases: wiring REF.gnd reaches a gnd_in terminal end-to-end (resolve + flatten + solve)", () => {
  const reg = B("@s/reg", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd_in", aliases: ["gnd"], role: "in", type: "gnd" },
  ], {
    parts: [{ ref: "R1", type: "res", value: "1k", footprint: "R0603" }],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "GND", connect: ["R1.2", "@gnd_in"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "X1", block: key(reg) }],
    connections: [{ from: "S1.vout", to: "X1.vin" }, { from: "S1.gnd", to: "X1.gnd" }], // alias!
  };
  const rd = resolve(d, lib(SRC12, reg));
  assert.equal(rd.invalid, undefined, "alias connection must be valid");
  const sol = solveDc(rd);
  const r1 = sol.parts.find((p) => p.ref === "X1/R1");
  assert.ok(r1 && Math.abs(r1.volts - 12) < 1e-9, "12 V across R1 proves the alias carried the return path");
});

test("self-assert verifies: a divider block claiming 6 V at MID passes; claiming 9 V fails loudly", () => {
  const mk = (id: string, claim: number): Block => ({
    ...B(id, [
      { id: "vin", role: "in", type: "power" },
      { id: "gnd", role: "in", type: "gnd" },
    ], {
      parts: [
        { ref: "R1", type: "res", value: "10k", footprint: "R0603" },
        { ref: "R2", type: "res", value: "10k", footprint: "R0603" },
      ],
      nets: [
        { name: "VIN", connect: ["R1.1", "@vin"] },
        { name: "MID", connect: ["R1.2", "R2.1"] },
        { name: "GND", connect: ["R2.2", "@gnd"] },
      ],
    }),
    asserts: [{ pin: "R2.1", volts: claim }],
  });
  const good = mk("@s/agood", 6), bad = mk("@s/abad", 9);
  const d = (blk: Block): Design => ({
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "A1", block: key(blk) }],
    connections: [{ from: "S1.vout", to: "A1.vin" }, { from: "S1.gnd", to: "A1.gnd" }],
  });
  const okF = lint(resolve(d(good), lib(SRC12, good)));
  assert.ok(!okF.some((f) => f.rule.startsWith("assert/")), "true claim stays silent");
  const badF = lint(resolve(d(bad), lib(SRC12, bad)));
  const hit = badF.find((f) => f.rule === "assert/failed");
  assert.ok(hit, "false claim must fail: " + badF.map((f) => f.rule).join(","));
  assert.match(hit!.message, /9 V/);
  assert.match(hit!.message, /6 V/);
});

test("declared part ratings beat inference: cap over its working voltage errors; resistor rating.watts respected", () => {
  const blk = B("@s/rated", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "C1", type: "cap", value: "10uF", rating: { volts: 10 } },     // 12 V across a 10 V cap
      { ref: "R1", type: "res", value: "100", rating: { watts: 2 } },       // 1.44 W but rated 2 W → only warn (>70%)
    ],
    nets: [
      { name: "VIN", connect: ["C1.1", "R1.1", "@vin"] },
      { name: "GND", connect: ["C1.2", "R1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "P1", block: key(blk) }],
    connections: [{ from: "S1.vout", to: "P1.vin" }, { from: "S1.gnd", to: "P1.gnd" }],
  };
  const findings = lint(resolve(d, lib(SRC12, blk)));
  const cap = findings.find((f) => f.rule === "voltage/cap-rating" && f.severity === "error");
  assert.ok(cap, "10 V cap at 12 V must error: " + findings.map((f) => f.rule).join(","));
  const res = findings.filter((f) => f.rule === "thermal/resistor-dissipation");
  assert.equal(res.length, 1);
  assert.equal(res[0].severity, "warn", "2 W rating means 1.44 W is hot, not fatal");
});

test("two distinct nets sharing a derived name must NOT merge (flat names dedupe)", () => {
  // regression: power-entry's derived output and the buck's derived output were both named
  // "VOUT" — the name-keyed solver fused them (18 V vs 5 V → singular), and a KiCad netlist
  // export would physically short them on import.
  const stage = (id: string, volts: number): Block => B(id, [
    { id: "vin", role: "in", type: "power", ...(volts ? {} : {}) },
    { id: "vout", role: "out", type: "rail", v: { value: volts, unit: "V" }, i: { max: 1, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [{ ref: "R1", type: "res", value: "1k", footprint: "R0603" }],
    nets: [
      { name: "VOUT", connect: ["R1.1", "@vout"] },   // both stages name their output net VOUT
      { name: "GND", connect: ["R1.2", "@gnd"] },
      { name: "VIN", connect: ["@vin"] },
    ],
  });
  const a = stage("@s/stageA", 12), b2 = stage("@s/stageB", 5);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(SRC12) }, { ref: "A1", block: key(a) }, { ref: "B1", block: key(b2) }],
    connections: [
      { from: "S1.vout", to: "A1.vin" }, { from: "S1.gnd", to: "A1.gnd" },
      { from: "A1.vout", to: "B1.vin" }, { from: "S1.gnd", to: "B1.gnd" },
    ],
  };
  const sol = solveDc(resolve(d, lib(SRC12, a, b2)));
  assert.ok(!sol.findings.some((f) => f.rule === "solve/unsolvable"), "name collision must not produce a singular merge");
  // both rails solved at their own voltage
  const volts = Object.entries(sol.netVolts).filter(([k]) => k.includes("VOUT")).map(([, v]) => Math.round(v));
  assert.deepEqual(volts.sort((x, y) => x - y), [5, 12], JSON.stringify(sol.netVolts));
});

test("LED fixed-drop: 5 V → 330 Ω → LED(2 V) solves to exactly (5−2)/330 ≈ 9.09 mA", () => {
  const src5 = B("@s/led-src", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 1, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const led = B("@s/led-blk", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "330", footprint: "R0603" },
      { ref: "D1", type: "led", value: "2V" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "A", connect: ["R1.2", "D1.1"] },
      { name: "GND", connect: ["D1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src5) }, { ref: "L1", block: key(led) }],
    connections: [{ from: "S1.vout", to: "L1.vin" }, { from: "S1.gnd", to: "L1.gnd" }],
  };
  const sol = solveDc(resolve(d, lib(src5, led)));
  const diode = sol.diodes.find((x) => x.ref === "L1/D1");
  assert.ok(diode?.on, "LED must conduct: " + JSON.stringify(sol.diodes) + JSON.stringify(sol.findings.map(f=>f.rule)));
  assert.ok(Math.abs(diode!.amps - 3 / 330) < 1e-9, `expected ${(3000 / 330).toFixed(2)} mA, got ${(diode!.amps * 1000).toFixed(2)} mA`);
  // and the series resistor's dissipation is the real number: I²R = (9.09mA)² × 330 ≈ 27.3 mW
  const r = sol.parts.find((p) => p.ref === "L1/R1");
  assert.ok(r && Math.abs(r.watts - (3 / 330) ** 2 * 330) < 1e-9);
});

test("a reverse-biased diode settles OFF and blocks", () => {
  const src5 = B("@s/rev-src", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 1, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const blk = B("@s/rev-blk", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "1k", footprint: "R0603" },
      { ref: "D1", type: "diode" }, // cathode toward the supply: reverse-biased
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "K", connect: ["R1.2", "D1.2"] },   // pin2 = cathode faces the rail
      { name: "GND", connect: ["D1.1", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src5) }, { ref: "X1", block: key(blk) }],
    connections: [{ from: "S1.vout", to: "X1.vin" }, { from: "S1.gnd", to: "X1.gnd" }],
  };
  const sol = solveDc(resolve(d, lib(src5, blk)));
  const diode = sol.diodes.find((x) => x.ref === "X1/D1");
  assert.ok(diode && !diode.on, "reverse diode must settle OFF: " + JSON.stringify(sol.diodes));
  assert.ok(Math.abs(diode!.amps) < 1e-12);
  // no current → no drop across R1
  const r = sol.parts.find((p) => p.ref === "X1/R1");
  assert.ok(r && Math.abs(r.volts) < 1e-9, "R1 must carry nothing");
});

test("Thévenin from the divider midpoint: Voc = 6 V, Rth = 10k∥10k = 5k", () => {
  const div = B("@s/thev-div", [
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
  const th = theveninAt(resolve(d, lib(SRC12, div)), "D1.mid");
  assert.ok(th, "thevenin must solve");
  assert.ok(Math.abs(th!.voc - 6) < 1e-9, `Voc ${th!.voc}`);
  assert.ok(Math.abs(th!.rth - 5000) < 1e-6, `Rth ${th!.rth}`);
  assert.ok(Math.abs(th!.isc - 6 / 5000) < 1e-12);
});

test("diode backflow: PIV violation errors; declared leakage quantifies the drain", () => {
  const src12 = SRC12;
  const blk = B("@s/backflow", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "1k", footprint: "R0603" },
      // cathode toward the rail: permanently reverse-biased, blocking 12 V
      { ref: "D1", type: "diode", rating: { volts: 10, leak: { ua: 1, atVolts: 20 } } },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "K", connect: ["R1.2", "D1.2"] },
      { name: "GND", connect: ["D1.1", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src12) }, { ref: "X1", block: key(blk) }],
    connections: [{ from: "S1.vout", to: "X1.vin" }, { from: "S1.gnd", to: "X1.gnd" }],
  };
  const rd = resolve(d, lib(src12, blk));
  const sol = solveDc(rd);
  const diode = sol.diodes.find((x) => x.ref === "X1/D1")!;
  assert.ok(!diode.on);
  // leakage model: R_rev = 20 V / 1 µA = 20 MΩ; reverse ≈ 12 V (1k drop negligible) → ~0.6 µA
  assert.ok(Math.abs(diode.amps - 12 / 20e6) < 1e-8, `leak ${diode.amps}`);
  const findings = lint(rd);
  const piv = findings.find((f) => f.rule === "voltage/diode-piv" && f.severity === "error");
  assert.ok(piv, "12 V reverse on a 10 V-PIV diode must error: " + findings.map((f) => f.rule).join(","));
  assert.ok(findings.some((f) => f.rule === "current/diode-leakage"), "leakage backflow surfaced");
});

test("standby draw: the always-on floor — divider never sleeps, MCU sleeps at its declared 10 µA", () => {
  const bat = B("@s/bat", [
    { id: "vout", role: "out", type: "power", v: { value: 3.7, unit: "V" }, i: { max: 2, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  (bat as Block & { spec: Record<string, number> }).spec = { capacity_mah: 2000 };
  const sense = B("@s/sense", [
    { id: "vin", role: "in", type: "power" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "100k", footprint: "R0603" },
      { ref: "R2", type: "res", value: "100k", footprint: "R0603" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "MID", connect: ["R1.2", "R2.1"] },
      { name: "GND", connect: ["R2.2", "@gnd"] },
    ],
  });
  const mcu = B("@s/sleepy-mcu", [
    { id: "vdd", role: "in", type: "power", i: { max: 0.08, unit: "A" }, iStandby: { value: 0.00001, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
  ]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "B1", block: key(bat) }, { ref: "S1", block: key(sense) }, { ref: "M1", block: key(mcu) }],
    connections: [
      { from: "B1.vout", to: "S1.vin" }, { from: "B1.gnd", to: "S1.gnd" },
      { from: "B1.vout", to: "M1.vdd" }, { from: "B1.gnd", to: "M1.gnd" },
    ],
  };
  const rep = standbyDraw(resolve(d, lib(bat, sense, mcu)));
  assert.equal(rep.perSource.length, 1);
  const src = rep.perSource[0];
  // divider: 3.7 V / 200 kΩ = 18.5 µA · MCU sleep: 10 µA → floor = 28.5 µA
  assert.ok(Math.abs(src.amps - 28.5e-6) < 1e-9, `floor ${src.amps * 1e6} µA`);
  assert.ok(src.contributors.some((c) => c.kind === "resistive" && c.label.includes("S1/R1")));
  assert.ok(src.contributors.some((c) => c.kind === "standby" && c.label.includes("M1.vdd")));
  // 2000 mAh / 28.5 µA ≈ 70175 h ≈ 2924 days
  assert.ok(src.lifeDays && Math.abs(src.lifeDays - 2000 / 1000 / 28.5e-6 / 24) < 0.5, `life ${src.lifeDays}`);
});

test("standby draw: a supply input with active draw but no iStandby is flagged, not guessed", () => {
  const bat = B("@s/bat2", [
    { id: "vout", role: "out", type: "power", v: { value: 3.7, unit: "V" }, i: { max: 2, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const hungry = B("@s/no-sleep-decl", [
    { id: "vdd", role: "in", type: "power", i: { max: 0.1, unit: "A" } }, // no iStandby
    { id: "gnd", role: "in", type: "gnd" },
  ]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "B1", block: key(bat) }, { ref: "H1", block: key(hungry) }],
    connections: [{ from: "B1.vout", to: "H1.vdd" }, { from: "B1.gnd", to: "H1.gnd" }],
  };
  const rep = standbyDraw(resolve(d, lib(bat, hungry)));
  assert.ok(rep.undeclared.includes("H1.vdd"), JSON.stringify(rep.undeclared));
});

test("a declared draw whose internals conduct is NOT double-counted: LED behind a 10k pull-up", () => {
  // Regression: led-indicator declares i: 15 mA at vin AND models its R+LED internally. The
  // solver used to inject the declaration as a phantom sink on top of solving the real parts —
  // invisible behind a stiff source, but through a 10 k pull-up it dragged the net to ~-145 V
  // ("R4 dissipates 2.21 W"). The internals are the load; the declaration is budget metadata.
  const src5 = B("@s/src5b", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 1, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const pullup = B("@s/pullup", [
    { id: "vcc", role: "in", type: "power" },
    { id: "out", role: "out", type: "signal" },
  ], {
    parts: [{ ref: "R1", type: "res", value: "10k", footprint: "R0603" }],
    nets: [
      { name: "VCC", connect: ["R1.1", "@vcc"] },
      { name: "OUT", connect: ["R1.2", "@out"] },
    ],
  });
  const led = B("@s/led", [
    { id: "vin", role: "in", type: "signal", i: { max: 0.015, unit: "A" } }, // the declaration
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "330", footprint: "R0603" },
      { ref: "D1", type: "led", value: "2.0" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "A", connect: ["R1.2", "D1.1"] },
      { name: "GND", connect: ["D1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src5) }, { ref: "P1", block: key(pullup) }, { ref: "L1", block: key(led) }],
    connections: [
      { from: "S1.vout", to: "P1.vcc" },
      { from: "P1.out", to: "L1.vin", net: "OUT" },
      { from: "S1.gnd", to: "L1.gnd" },
    ],
  };
  const sol = solveDc(resolve(d, lib(src5, pullup, led)));
  const out = Object.entries(sol.netVolts).find(([k]) => k.includes("OUT"));
  assert.ok(out, "OUT net solved: " + JSON.stringify(sol.netVolts));
  // 5 V through 10k + 330 to a 2 V drop: I = 3/10330 ≈ 0.29 mA → OUT ≈ 5 − 2.904 = 2.096 V
  const i = 3 / 10330;
  assert.ok(Math.abs(out![1] - (5 - 10000 * i)) < 1e-9, `expected ~2.096 V, got ${out![1]}`);
  // and the LED's vin must NOT appear as an injected sink (the old bug's signature)
  const r1 = sol.parts.find((p) => p.ref === "P1/R1")!;
  assert.ok(Math.abs(r1.amps - i) < 1e-12, `pull-up carries the LED current only, got ${r1.amps} A`);
});

test("a block author's internal passthrough is not an internal-short: USB-C vbus≡vout places clean", () => {
  // Regression (VERIFICATION F11): usb-c-power's own schematic ties vbus (5.25 V max, in)
  // through to vout (5 V, out) — TVS and caps are shunts, the rail passes straight through.
  // The internal-short rule fired on EVERY placement. Author ties are deliberate; only
  // user-wired same-instance shorts should fire.
  const usb = B("@s/usbc", [
    { id: "vbus", role: "in", type: "power", v: { min: 4.75, max: 5.25, unit: "V" } },
    { id: "vout", role: "out", type: "rail", v: { value: 5, unit: "V" } },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [{ ref: "C1", type: "capacitor", value: "22µ", footprint: "C0805" }],
    nets: [
      { name: "VBUS", connect: ["C1.1", "@vbus", "@vout"] }, // the author's passthrough tie
      { name: "GND", connect: ["C1.2", "@gnd"] },
    ],
  });
  const load = B("@s/load5", [
    { id: "vdd", role: "in", type: "rail", v: { min: 4.5, max: 5.5, unit: "V" } },
    { id: "gnd", role: "in", type: "gnd" },
  ]);
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "USB1", block: key(usb) }, { ref: "L1", block: key(load) }],
    connections: [
      { from: "USB1.vout", to: "L1.vdd" },
      { from: "USB1.gnd", to: "L1.gnd" },
    ],
  };
  const rd = resolve(d, lib(usb, load));
  const findings = lint(rd);
  const shorts = findings.filter((f) => f.rule === "connectivity/internal-short");
  assert.equal(shorts.length, 0, "author tie must not fire: " + JSON.stringify(shorts.map((s) => s.message)));
  // but a USER-wired same-instance short still fires: tie vout to gnd externally
  const bad: Design = { ...d, connections: [...d.connections, { from: "USB1.vout", to: "USB1.gnd" }] };
  const shorts2 = lint(resolve(bad, lib(usb, load))).filter((f) => f.rule === "connectivity/internal-short");
  assert.ok(shorts2.length >= 1, "user-wired hot-to-gnd on one instance must still fire");
});

test("net labels: same name = same net, no wire — and the label names the net", () => {
  const src5 = B("@s/src5c", [
    { id: "vout", role: "out", type: "power", v: { value: 5, unit: "V" }, i: { max: 1, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ]);
  const led = B("@s/led2", [
    { id: "vin", role: "in", type: "signal" },
    { id: "gnd", role: "in", type: "gnd" },
  ], {
    parts: [
      { ref: "R1", type: "res", value: "330", footprint: "R0603" },
      { ref: "D1", type: "led", value: "2.0" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "A", connect: ["R1.2", "D1.1"] },
      { name: "GND", connect: ["D1.2", "@gnd"] },
    ],
  });
  const d: Design = {
    id: "d", name: "d",
    blocks: [{ ref: "S1", block: key(src5) }, { ref: "L1", block: key(led) }],
    connections: [], // NO wires at all — the labels are the wiring
    labels: [
      { node: "S1.vout", name: "+5V" }, { node: "L1.vin", name: "+5V" },
      { node: "S1.gnd", name: "GND" }, { node: "L1.gnd", name: "GND" },
    ],
  };
  const rd = resolve(d, lib(src5, led));
  assert.equal(rd.nets.length, 2, "two labeled nets: " + rd.nets.map((n) => n.id).join(","));
  assert.ok(rd.nets.some((n) => n.id === "+5V") && rd.nets.some((n) => n.id === "GND"), "labels name the nets");
  // the solver sees straight through labels: LED current solves exactly
  const sol = solveDc(rd);
  const led1 = sol.diodes.find((x) => x.ref === "L1/D1")!;
  assert.ok(Math.abs(led1.amps - 3 / 330) < 1e-9, `LED solves through labels, got ${led1.amps}`);
  // a label on a vanished terminal is a dangling finding, not a crash
  const stale: Design = { ...d, labels: [...d.labels!, { node: "L1.nope", name: "+5V" }] };
  const rd2 = resolve(stale, lib(src5, led));
  assert.ok(rd2.invalid?.some((i) => i.missing.includes("L1.nope")), "stale label recorded as invalid");
});
