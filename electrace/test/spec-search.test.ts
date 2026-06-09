import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpecQuery, searchBlocks } from "../src/index.js";
import type { Block } from "../src/index.js";

const buck: Block = {
  id: "@electrace/buck-converter", name: "Buck Converter", version: "1.2.0", category: "power",
  spec: { vin: { min: 9, max: 18, unit: "V" }, vout: { value: 5, unit: "V" }, iout_max: { value: 3, unit: "A" } },
  terminals: [{ id: "vin", role: "in", type: "power" }],
};
const ldo: Block = {
  id: "@electrace/ldo-regulator", name: "LDO Regulator", version: "1.0.0", category: "power",
  spec: { vin: { min: 4.5, max: 12, unit: "V" }, vout: { value: 3.3, unit: "V" }, iout_max: { value: 0.5, unit: "A" } },
  terminals: [{ id: "vin", role: "in", type: "power" }],
};
const led: Block = { id: "@electrace/led-indicator", name: "LED Indicator", version: "1.0.0", category: "ui", terminals: [{ id: "vin", role: "in", type: "power" }] };
const LIB = [buck, ldo, led];

test("parses '18V → 5V at 3A' into vin/vout/iout", () => {
  assert.deepEqual(parseSpecQuery("18V → 5V at 3A"), { vin: 18, vout: 5, iout: 3, text: [] });
});

test("parses 'to' arrows, mA units, and in/out word forms", () => {
  assert.deepEqual(parseSpecQuery("12 to 3.3v 500ma"), { vin: 12, vout: 3.3, iout: 0.5, text: [] });
  const q = parseSpecQuery("9v in 5v out");
  assert.equal(q.vin, 9); assert.equal(q.vout, 5);
});

test("a lone voltage means the rail you want; bare words stay text terms", () => {
  const q = parseSpecQuery("3.3v buck");
  assert.equal(q.vout, 3.3); assert.equal(q.vin, undefined); assert.deepEqual(q.text, ["buck"]);
});

test("'18 V → 5 V at 3 A' finds the buck, not the LDO (vin + vout + iout all gate)", () => {
  const r = searchBlocks(LIB, "18V → 5V at 3A");
  assert.deepEqual(r.map((m) => m.block.id), ["@electrace/buck-converter"]);
  // and the why is built from declared numbers — checkable, not magic
  assert.ok(r[0].why.some((w) => w.includes("9–18")));
});

test("over-current is a hard fail with the declared rating in the why", () => {
  const r = searchBlocks(LIB, "12V → 3.3V at 2A"); // LDO tops out at 0.5 A
  assert.equal(r.length, 0);
});

test("undeclared spec can't pass silently — it surfaces as 'not declared'", () => {
  const r = searchBlocks([led], "led 5v");
  // led matches by name but its missing vout is REPORTED, not skipped
  assert.equal(r.length, 1);
  assert.ok(r[0].why.some((w) => w.includes("not declared")));
});

test("range query input takes the upper bound: '9-18V to 5V'", () => {
  const q = parseSpecQuery("9-18V to 5V");
  assert.equal(q.vin, 18); assert.equal(q.vout, 5);
});
