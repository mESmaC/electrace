import { test } from "node:test";
import assert from "node:assert/strict";
import { authorChipLayout, authorPartLayout, buildBlockLayout, deriveBlockSchematic } from "../src/index.js";

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

test("buildBlockLayout: a real subcircuit — crystal oscillator block (crystal + 2 load caps + chip)", () => {
  const { layout, terminals } = buildBlockLayout(
    [
      { ref: "Y1", type: "crystal", value: "16MHz" },
      { ref: "C1", type: "capacitor", value: "22pF" },
      { ref: "C2", type: "capacitor", value: "22pF" },
      { ref: "U1", chip: { profile: "qfp", pins: 32, mpn: "ATmega328P-AU", names: { "7": "XTAL1", "8": "XTAL2", "3": "GND" } } },
    ],
    [
      { connect: ["U1.XTAL1", "Y1.1", "C1.1"], expose: "XTAL1" },
      { connect: ["U1.XTAL2", "Y1.2", "C2.1"], expose: "XTAL2" },
      { connect: ["C1.2", "C2.2", "U1.GND"], expose: "GND" },
    ],
  );
  const sch = deriveBlockSchematic(layout);

  // FOUR real parts in ONE block — not four blocks
  assert.deepEqual(sch.parts.map((p) => p.ref).sort(), ["C1", "C2", "U1", "Y1"]);
  assert.equal(sch.parts.find((p) => p.ref === "C1")!.value, "22pF");
  assert.equal(sch.parts.find((p) => p.ref === "Y1")!.type, "crystal");

  // the XTAL1 net actually joins the chip pin, the crystal, and its load cap
  const xtal1 = sch.nets.find((n) => n.connect.includes("@XTAL1"))!;
  assert.ok(xtal1.connect.includes("U1.XTAL1") && xtal1.connect.includes("Y1.1") && xtal1.connect.includes("C1.1"));
  // both cap bottoms tie to the exposed GND terminal
  const gnd = sch.nets.find((n) => n.connect.includes("@GND"))!;
  assert.ok(gnd.connect.includes("C1.2") && gnd.connect.includes("C2.2"));
  // exposes exactly the 3 external pins, GND typed as gnd
  assert.deepEqual(terminals.map((t) => t.id).sort(), ["GND", "XTAL1", "XTAL2"]);
  assert.equal(terminals.find((t) => t.id === "GND")!.type, "gnd");
});

test("buildBlockLayout: a signal net wired only to passives defaults to a LOAD (in), not a driver", () => {
  // a crystal-oscillator block (crystal + 2 load caps, no chip) → XTAL pins are passive loads
  const { terminals } = buildBlockLayout(
    [
      { ref: "Y1", type: "crystal", value: "16MHz" },
      { ref: "C1", type: "capacitor", value: "22pF" },
      { ref: "C2", type: "capacitor", value: "22pF" },
    ],
    [
      { connect: ["Y1.1", "C1.1"], expose: "XTAL1" },
      { connect: ["Y1.2", "C2.1"], expose: "XTAL2" },
      { connect: ["C1.2", "C2.2"], expose: "GND" },
    ],
  );
  // both XTAL pins are loads — so they won't false-fire two-drivers against the MCU's XTAL outputs
  assert.equal(terminals.find((t) => t.id === "XTAL1")!.role, "in");
  assert.equal(terminals.find((t) => t.id === "XTAL2")!.role, "in");

  // but a signal net that DOES touch an active part (a chip output) stays a driver
  const withChip = buildBlockLayout(
    [{ ref: "U1", chip: { profile: "qfp", pins: 8, names: { "1": "OUT" } } }],
    [{ connect: ["U1.OUT"], expose: "OUT" }],
  );
  assert.equal(withChip.terminals.find((t) => t.id === "OUT")!.role, "out");
});
