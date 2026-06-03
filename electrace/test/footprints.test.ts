import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFootprint } from "../src/footprints.js";
import type { FlatPart } from "../src/types.js";

const part = (over: Partial<FlatPart>): FlatPart => ({ ref: "X1", instance: "I", type: "cap", ...over });

test("an SMD chip code resolves to the standard land pattern", () => {
  const { footprint } = resolveFootprint(part({ type: "cap", footprint: "C0805" }), ["1", "2"]);
  assert.equal(footprint.id, "0805");
  assert.equal(footprint.kind, "smd");
  assert.equal(footprint.pads.length, 2);
  assert.equal(footprint.pads[0].x, -0.95); // KiCad-ish 0805 pad centre
  assert.equal(footprint.pads[0].drill, undefined); // SMD has no hole
});

test("SOIC-8 yields 8 pads on a 1.27 mm pitch in two rows", () => {
  const { footprint } = resolveFootprint(part({ type: "ic", footprint: "SOIC-8" }), ["1", "8"]);
  assert.equal(footprint.pads.length, 8);
  const p1 = footprint.pads.find((p) => p.num === "1")!, p2 = footprint.pads.find((p) => p.num === "2")!;
  assert.equal(Math.abs(p2.y - p1.y).toFixed(2), "1.27"); // pitch
  const p8 = footprint.pads.find((p) => p.num === "8")!;
  assert.ok(p8.x > 0 && p1.x < 0); // pin 1 left column, pin 8 right column
});

test("a 3-terminal MOSFET infers SOT-23 with a sensible G/D/S map", () => {
  const { footprint, pinToPad } = resolveFootprint(part({ type: "mosfet" }), ["G", "D", "S"]);
  assert.equal(footprint.id, "SOT-23");
  assert.equal(footprint.pads.length, 3);
  assert.deepEqual(pinToPad, { G: "1", S: "2", D: "3" });
});

test("numbered pins map straight through to pads", () => {
  const { pinToPad } = resolveFootprint(part({ type: "ic", footprint: "TSSOP-14" }), ["1", "7", "14"]);
  assert.deepEqual(pinToPad, { "1": "1", "7": "7", "14": "14" });
});

test("a through-hole DIP has drilled pads", () => {
  const { footprint } = resolveFootprint(part({ type: "ic", footprint: "DIP-8" }), ["1", "8"]);
  assert.equal(footprint.kind, "tht");
  assert.equal(footprint.pads.length, 8);
  assert.ok(footprint.pads.every((p) => p.drill && p.drill > 0));
});

test("a radial electrolytic cap resolves to a 2-pad THT footprint", () => {
  const { footprint } = resolveFootprint(part({ type: "cap", footprint: "radial-6.3mm", polarized: true }), ["1", "2"]);
  assert.equal(footprint.kind, "tht");
  assert.equal(footprint.pads.length, 2);
});
