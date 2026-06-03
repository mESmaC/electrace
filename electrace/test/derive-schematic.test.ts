import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBlockSchematic } from "../src/derive-schematic.js";
import type { SchematicLayout, Part } from "../src/types.js";

// the LED-indicator block: P_vin → R1 → D1 → P_gnd
const led: SchematicLayout = {
  symbols: [
    { id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 },
    { id: "R1", type: "resistor", ref: "R1", value: "330", x: 0, y: 0 },
    { id: "D1", type: "led", ref: "D1", x: 0, y: 0 },
    { id: "P_gnd", type: "port", ref: "gnd", x: 0, y: 0 },
  ],
  wires: [
    { from: "P_vin.1", to: "R1.1" },
    { from: "R1.2", to: "D1.1" },
    { from: "D1.2", to: "P_gnd.1" },
  ],
};

test("a chip's named pins derive as the function net, not the pad number", () => {
  const layout: SchematicLayout = {
    symbols: [
      { id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 },
      { id: "U1", type: "chip", ref: "U1", x: 0, y: 0, chip: { profile: "soic", pins: 4, names: { "1": "VIN", "3": "SW" } } },
    ],
    wires: [{ from: "P_vin.1", to: "U1.1" }],
  };
  const { nets } = deriveBlockSchematic(layout);
  const vin = nets.find((n) => n.connect.includes("@vin"))!;
  assert.ok(vin.connect.includes("U1.VIN"), "named pin 1 derives as U1.VIN");
  assert.ok(!vin.connect.includes("U1.1"), "the bare pad number is not used");
});

test("derives parts from the layout's component symbols (ports excluded)", () => {
  const { parts } = deriveBlockSchematic(led);
  assert.deepEqual(parts.map((p) => p.ref).sort(), ["D1", "R1"]);
  assert.equal(parts.find((p) => p.ref === "R1")!.type, "res"); // resistor → res
  assert.equal(parts.find((p) => p.ref === "D1")!.type, "led");
});

test("a net touching a port exposes the terminal with @ and takes its name", () => {
  const { nets } = deriveBlockSchematic(led);
  const vin = nets.find((n) => n.connect.includes("@vin"))!;
  assert.ok(vin, "vin net exists");
  assert.deepEqual(vin.connect.sort(), ["@vin", "R1.1"]);
  assert.equal(vin.name, "VIN");
  const gnd = nets.find((n) => n.connect.includes("@gnd"))!;
  assert.deepEqual(gnd.connect.sort(), ["@gnd", "D1.2"]);
});

test("internal nets (no port) are still emitted", () => {
  const { nets } = deriveBlockSchematic(led);
  const mid = nets.find((n) => n.connect.includes("R1.2"))!;
  assert.deepEqual(mid.connect.sort(), ["D1.1", "R1.2"]);
});

test("authored part metadata (why/footprint) is merged in by ref", () => {
  const authored: Part[] = [{ ref: "R1", type: "res", footprint: "R0603", why: "sets the LED current" }];
  const { parts } = deriveBlockSchematic(led, authored);
  const r1 = parts.find((p) => p.ref === "R1")!;
  assert.equal(r1.footprint, "R0603");
  assert.equal(r1.why, "sets the LED current");
  assert.equal(r1.value, "330"); // value still comes from the layout symbol
});

test("two wires meeting at a shared pin collapse into one net", () => {
  const layout: SchematicLayout = {
    symbols: [
      { id: "P", type: "port", ref: "vout", x: 0, y: 0 },
      { id: "C1", type: "cap-pol", ref: "C1", x: 0, y: 0 },
      { id: "U1", type: "regulator", ref: "U1", x: 0, y: 0 },
    ],
    wires: [
      { from: "U1.OUT", to: "C1.1" },
      { from: "C1.1", to: "P.1" },
    ],
  };
  const { nets } = deriveBlockSchematic(layout);
  assert.equal(nets.length, 1);
  assert.deepEqual(nets[0].connect.sort(), ["@vout", "C1.1", "U1.OUT"]);
});
