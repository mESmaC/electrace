import { test } from "node:test";
import assert from "node:assert/strict";
import { authorChipLayout, authorPartLayout, deriveBlockSchematic } from "../src/index.js";

test("authorChipLayout: chip becomes a part, exposed pins become wired terminals", () => {
  const { layout, terminals } = authorChipLayout(
    "U1",
    { profile: "qfp", pins: 32, mpn: "ATmega328P-AU", names: { "4": "VCC", "3": "GND", "30": "PD0_RXD" } },
    ["VCC", "GND", "PD0_RXD", "NOPE"], // NOPE isn't on the chip → skipped
  );
  const sch = deriveBlockSchematic(layout);

  // the chip is a real part (→ BOM/footprint), not a hollow shell
  assert.ok(sch.parts.some((p) => p.ref === "U1"));

  // only real pins exposed, with sensible role/type
  assert.deepEqual(terminals.map((t) => t.id).sort(), ["GND", "PD0_RXD", "VCC"]);
  assert.equal(terminals.find((t) => t.id === "VCC")!.type, "power");
  assert.equal(terminals.find((t) => t.id === "VCC")!.role, "in");
  assert.equal(terminals.find((t) => t.id === "GND")!.type, "gnd");
  assert.equal(terminals.find((t) => t.id === "PD0_RXD")!.role, "out");

  // each terminal's net reaches the right chip pin (by function name)
  assert.ok(sch.nets.some((n) => n.connect.includes("@VCC") && n.connect.includes("U1.VCC")));
  assert.ok(sch.nets.some((n) => n.connect.includes("@PD0_RXD") && n.connect.includes("U1.PD0_RXD")));
});

test("authorPartLayout: a passive becomes a real BOM part with its value, wired to the block's terminals", () => {
  // a 22pF cap block with two terminals (1, 2) → positional pin assignment
  const { layout } = authorPartLayout("C1", "capacitor", ["1", "2"], "22pF");
  const sch = deriveBlockSchematic(layout);

  const c = sch.parts.find((p) => p.ref === "C1");
  assert.ok(c, "the capacitor is a real part");
  assert.equal(c!.type, "cap");      // symbol type → BOM partType via the catalog
  assert.equal(c!.value, "22pF");    // value carried through

  // each block terminal reaches the cap (terminal[i] ↔ catalog pin i: "1","2")
  assert.ok(sch.nets.some((n) => n.connect.includes("@1") && n.connect.includes("C1.1")));
  assert.ok(sch.nets.some((n) => n.connect.includes("@2") && n.connect.includes("C1.2")));
});

test("authorPartLayout: explicit pinMap wires named pins (regulator IN/OUT/GND)", () => {
  const { layout } = authorPartLayout("U1", "regulator", ["vin", "vout", "gnd"], "LM1117-5.0",
    { vin: "IN", vout: "OUT", gnd: "GND" });
  const sch = deriveBlockSchematic(layout);
  assert.ok(sch.parts.some((p) => p.ref === "U1" && p.value === "LM1117-5.0"));
  assert.ok(sch.nets.some((n) => n.connect.includes("@vout") && n.connect.includes("U1.OUT")));
});
