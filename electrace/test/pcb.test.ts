import { test } from "node:test";
import assert from "node:assert/strict";
import { pcbProject } from "../src/pcb.js";
import type { Block, Design } from "../src/types.js";

// two blocks: a source and a load, connected vout→vin and gnd→gnd
const SRC: Block = {
  id: "@t/src", name: "Src", version: "1.0.0",
  terminals: [{ id: "vout", role: "out", type: "rail", v: { value: 5, unit: "V" } }, { id: "gnd", role: "out", type: "gnd" }],
  schematic: {
    parts: [{ ref: "C1", type: "cap", value: "10uF", footprint: "C0805" }],
    nets: [{ name: "VOUT", connect: ["C1.1", "@vout"] }, { name: "GND", connect: ["C1.2", "@gnd"] }],
  },
};
const LOAD: Block = {
  id: "@t/load", name: "Load", version: "1.0.0",
  terminals: [{ id: "vin", role: "in", type: "rail" }, { id: "gnd", role: "in", type: "gnd" }],
  schematic: {
    parts: [{ ref: "U1", type: "ic", footprint: "SOIC-8" }],
    nets: [{ name: "VDD", connect: ["U1.1", "@vin"] }, { name: "GND", connect: ["U1.2", "@gnd"] }],
  },
};
const design: Design = {
  id: "d", name: "D",
  blocks: [{ ref: "P1", block: "@t/src@1.0.0" }, { ref: "L1", block: "@t/load@1.0.0" }],
  connections: [{ from: "P1.vout", to: "L1.vin" }, { from: "P1.gnd", to: "L1.gnd" }],
};
const blocks = new Map([["@t/src@1.0.0", SRC], ["@t/load@1.0.0", LOAD]]);

test("every part becomes a placeable component with a footprint and pads", () => {
  const { components } = pcbProject(design, blocks);
  assert.deepEqual(components.map((c) => c.ref).sort(), ["L1/U1", "P1/C1"]);
  const c1 = components.find((c) => c.ref === "P1/C1")!;
  assert.equal(c1.footprint, "0805"); // C0805 resolves to the standard 0805 land pattern
  assert.deepEqual(c1.pads.map((p) => p.id).sort(), ["1", "2"]);
  assert.ok(c1.pads[0].x !== c1.pads[1].x); // two pads, separated
  // each pad carries the schematic pin mapped to it (functional identity, not just the pad number)
  const u1 = components.find((c) => c.ref === "L1/U1")!;
  assert.ok(u1.pads.some((p) => p.pin === "1" || p.pin === "2"), "pads expose their schematic pin");
});

test("the ratsnest mirrors the flattened nets as pad-to-pad links", () => {
  const { ratsnest } = pcbProject(design, blocks);
  const gnd = ratsnest.find((r) => r.pads.includes("P1/C1.2"))!;
  // C1.2, U1.2 and the two grounds are one stitched net
  assert.ok(gnd.pads.includes("L1/U1.2"), "grounds are stitched across the boundary");
  const vout = ratsnest.find((r) => r.pads.includes("P1/C1.1"))!;
  assert.ok(vout.pads.includes("L1/U1.1"), "vout→vin stitched");
});
