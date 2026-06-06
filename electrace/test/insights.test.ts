import { test } from "node:test";
import assert from "node:assert/strict";
import { schematicInsights, type InsightComponent } from "../src/insights.js";

const R = (ref: string, a: number, b: number, value?: string): InsightComponent => ({ ref, type: "resistor", value, pins: { "1": a, "2": b } });
const C = (ref: string, a: number, b: number, value?: string): InsightComponent => ({ ref, type: "capacitor", value, pins: { "1": a, "2": b } });
const find = (comps: InsightComponent[], kind: string) => schematicInsights(comps).filter((i) => i.kind === kind);

test("parallel resistors → Req", () => {
  const f = find([R("R1", 1, 2, "10k"), R("R2", 1, 2, "10k")], "parallel-r");
  assert.equal(f.length, 1);
  assert.match(f[0].text, /R1 ∥ R2 in parallel = 5kΩ/);
});

test("series resistors → sum (degree-2 midpoint)", () => {
  const f = find([R("R1", 1, 2, "10k"), R("R2", 2, 3, "10k")], "series-r");
  assert.equal(f.length, 1);
  assert.match(f[0].text, /R1 \+ R2 in series = 20kΩ/);
});

test("a used midpoint (degree ≥3) is a divider, not a series string", () => {
  const comps = [R("R1", 1, 2, "30k"), R("R2", 2, 3, "10k"), C("C1", 2, 4, "100n")]; // C taps net 2 → degree 3
  assert.equal(find(comps, "series-r").length, 0);
  const d = find(comps, "divider");
  assert.equal(d.length, 1);
  assert.match(d[0].text, /voltage divider/);
  assert.match(d[0].text, /0\.250/); // 10k/(30k+10k)
});

test("parallel caps add; series caps reciprocal", () => {
  assert.match(find([C("C1", 1, 2, "100n"), C("C2", 1, 2, "100n")], "parallel-c")[0].text, /= 200nF/);
  assert.match(find([C("C1", 1, 2, "100n"), C("C2", 2, 3, "100n")], "series-c")[0].text, /= 50nF/);
});

test("single part and missing values are handled", () => {
  assert.equal(find([R("R1", 1, 2, "10k")], "parallel-r").length, 0);
  assert.match(find([R("R1", 1, 2), R("R2", 1, 2)], "parallel-r")[0].text, /give them values/);
});
