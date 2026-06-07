import { test } from "node:test";
import assert from "node:assert/strict";
import { authorChipLayout, deriveBlockSchematic } from "../src/index.js";

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
