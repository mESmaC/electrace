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
