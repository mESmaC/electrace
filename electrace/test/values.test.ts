import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValue, parallelResistance, seriesSum, formatValue } from "../src/values.js";

test("parseValue: plain and suffixed", () => {
  assert.equal(parseValue("330"), 330);
  assert.equal(parseValue("4.7k"), 4700);
  assert.equal(parseValue("10k"), 10000);
  assert.equal(parseValue("1M"), 1_000_000);
  assert.equal(parseValue("2.2"), 2.2);
  assert.ok(Math.abs(parseValue("100n")! - 100e-9) < 1e-15);
});

test("parseValue: R-notation (letter as decimal point)", () => {
  assert.equal(parseValue("4k7"), 4700);
  assert.equal(parseValue("1R5"), 1.5);
  assert.equal(parseValue("2M2"), 2_200_000);
  assert.equal(parseValue("0R5"), 0.5);
});

test("parseValue: units and case (M=mega, m=milli) and junk", () => {
  assert.equal(parseValue("10kΩ"), 10000);
  assert.equal(parseValue("47 ohm"), 47);
  assert.equal(parseValue("500m"), 0.5); // milliohm
  assert.equal(parseValue(""), null);
  assert.equal(parseValue(undefined), null);
  assert.equal(parseValue("abc"), null);
});

test("parallelResistance", () => {
  assert.equal(parallelResistance([10000, 10000]), 5000); // two equal → half
  assert.ok(Math.abs(parallelResistance([1000, 2000]) - 666.667) < 0.01);
  assert.ok(Math.abs(parallelResistance([10000, 10000, 10000]) - 10000 / 3) < 1e-6);
  assert.equal(parallelResistance([5000]), 5000);
});

test("seriesSum", () => {
  assert.equal(seriesSum([100, 220, 330]), 650);
});

test("formatValue round-trips magnitudes", () => {
  assert.equal(formatValue(4700), "4.7k");
  assert.equal(formatValue(10000), "10k");
  assert.equal(formatValue(1_500_000), "1.5M");
  assert.equal(formatValue(330), "330");
  assert.equal(formatValue(0.5), "500m");
  assert.equal(formatValue(5000), "5k");
});
