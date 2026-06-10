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
