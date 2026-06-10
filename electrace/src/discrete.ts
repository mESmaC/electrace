// Standard discrete-equivalent library, keyed by IC PART id (not by block). A supported IC — the LDO
// chip, a 555, a charge pump — has a discrete equivalent: the same pins realized from discrete parts.
// You "break into discrete" by selecting that chip inside a schematic, so only supported parts can be
// reduced (no exploding a GPU into transistors). Free tier = this standard library (+ community, later);
// Pro = AI-generated equivalents for supported parts.
import type { Schematic, SchematicLayout } from "./types.js";

export interface DiscreteEquivalent {
  ic: string;               // the IC part id this replaces (matches a schematic part's `part`, or a chip mpn)
  name: string;             // human label, e.g. "Linear regulator — series-pass"
  note?: string;            // how it works / honesty framing, shown in the break-into-discrete view
  schematic: Schematic;     // discrete parts + nets, exposing the IC's pins (@IN/@OUT/@GND…)
  layout?: SchematicLayout; // drawn schematic for the view
}

// pins recap for layouts: npn = B/C/E · resistor/zener/capacitor = 1/2 · port = 1
export const DISCRETE_LIBRARY: Record<string, DiscreteEquivalent> = {
  "ldo-3v3": {
    ic: "ldo-3v3",
    name: "Linear regulator — discrete series-pass",
    note: "The IC, drawn out: a zener sets a fixed reference and an NPN emitter-follower passes the load current, so the output sits one Vbe below the reference (Vout ≈ Vz − 0.6 V). That's the whole idea of a linear regulator — a reference plus a pass element. A real LDO integrates these with an error amplifier for tighter regulation and lower dropout; this is the teaching equivalent, not a production-optimal part.",
    schematic: {
      parts: [
        { ref: "Q1", type: "npn",   part: "BC547",  footprint: "SOT-23",  why: "series pass element (emitter follower) — carries the load current; the emitter follows the base, one Vbe down" },
        { ref: "D1", type: "zener", value: "3.9V",  footprint: "SOD-123", why: "voltage reference — clamps the base near 3.9 V so the emitter sits at ~3.3 V" },
        { ref: "R1", type: "res",   value: "1k",    footprint: "R0603",   why: "biases current into the zener and the transistor base" },
      ],
      nets: [
        { name: "IN",  connect: ["Q1.C", "R1.1", "@IN"] },
        { name: "REF", connect: ["R1.2", "D1.2", "Q1.B"] },
        { name: "OUT", connect: ["Q1.E", "@OUT"] },
        { name: "GND", connect: ["D1.1", "@GND"] },
      ],
    },
    // Clean series-pass drawing: VIN rail across the top, a vertical R1-over-D1 reference divider at
    // x≈180 dropping to the GND rail, the base tapped off the divider into Q1, emitter → OUT.
    // Geometry note: port pin is at (0,10) — rot 180 puts it on the right (left-side IN), rot 0 on the
    // left (right-side OUT), rot 90 on top (bottom GND). rot 90/270 makes 2-pin parts vertical.
    layout: {
      symbols: [
        // ports carry no rotation — the renderer auto-faces each one toward its wire
        { id: "P_in",  type: "port",     ref: "IN",  x: 30,  y: 40 },
        { id: "R1",    type: "resistor", ref: "R1",  value: "1k",   x: 135, y: 81,  rot: 90 },  // pin1 (180,50) VIN · pin2 (180,140) REF
        { id: "D1",    type: "zener",    ref: "D1",  value: "3.9V", x: 145, y: 201, rot: 270 }, // pin2 (180,180) REF · pin1 (180,250) GND
        { id: "Q1",    type: "npn",      ref: "Q1",  x: 320, y: 48 },                            // C(360,50) B(320,80) E(360,110)
        { id: "P_out", type: "port",     ref: "OUT", x: 440, y: 100 },
        { id: "P_gnd", type: "port",     ref: "GND", x: 165, y: 275 },
      ],
      wires: [
        { from: "P_in.1", to: "R1.1" },    // VIN rail
        { from: "R1.1",   to: "Q1.C" },    // VIN rail → collector
        { from: "R1.2",   to: "D1.2" },    // reference divider
        { from: "R1.2",   to: "Q1.B" },    // reference tap → base
        { from: "Q1.E",   to: "P_out.1" }, // emitter → OUT
        { from: "D1.1",   to: "P_gnd.1" }, // zener anode → GND
      ],
    },
  },
  "h-bridge-1ch": {
    ic: "h-bridge-1ch",
    name: "H-bridge — four switches around the motor",
    note: "The chip, drawn out: each side of the 'H' is a P-FET stacked over an N-FET — the same totem-pole structure as a CMOS logic gate, just sized for amps. Driving IN1 high turns the left N-FET on (OUT1 low) and the left P-FET off; driving it low does the reverse — so each input picks its side's polarity, and a diagonal pair conducts through the motor. The honesty caveat: this bare version has no dead-time logic, so during input transitions both FETs of one side conduct for an instant (shoot-through). A real driver IC adds break-before-make timing, current limits, and thermal shutdown around exactly this core.",
    schematic: {
      parts: [
        { ref: "QA1", type: "mosfet", part: "p-fet", footprint: "SOT-23", why: "left high-side — connects OUT1 to VM when IN1 is low" },
        { ref: "QA2", type: "mosfet", part: "n-fet", footprint: "SOT-23", why: "left low-side — pulls OUT1 to ground when IN1 is high" },
        { ref: "QB1", type: "mosfet", part: "p-fet", footprint: "SOT-23", why: "right high-side — connects OUT2 to VM when IN2 is low" },
        { ref: "QB2", type: "mosfet", part: "n-fet", footprint: "SOT-23", why: "right low-side — pulls OUT2 to ground when IN2 is high" },
      ],
      nets: [
        { name: "VM",   connect: ["QA1.S", "QB1.S", "@VM"] },
        { name: "GND",  connect: ["QA2.S", "QB2.S", "@GND"] },
        { name: "IN1",  connect: ["QA1.G", "QA2.G", "@IN1"] },
        { name: "IN2",  connect: ["QB1.G", "QB2.G", "@IN2"] },
        { name: "OUT1", connect: ["QA1.D", "QA2.D", "@OUT1"] },
        { name: "OUT2", connect: ["QB1.D", "QB2.D", "@OUT2"] },
      ],
    },
    // Two totem-pole columns (P over N), VM rail joining the sources at top, GND at bottom,
    // each input fanning to BOTH gates of its column, outputs tapped between the drains.
    // pmos/nmos: G(0,32) left · pmos S(40,2) D(40,62) · nmos D(40,2) S(40,62).
    layout: {
      symbols: [
        { id: "QA1", type: "pmos", ref: "QA1", x: 120, y: 40 },   // G(120,72) S(160,42) D(160,102)
        { id: "QA2", type: "nmos", ref: "QA2", x: 120, y: 140 },  // G(120,172) D(160,142) S(160,202)
        { id: "QB1", type: "pmos", ref: "QB1", x: 320, y: 40 },
        { id: "QB2", type: "nmos", ref: "QB2", x: 320, y: 140 },
        { id: "P_vm",   type: "port", ref: "VM",   x: 228, y: 10 },
        { id: "P_gnd",  type: "port", ref: "GND",  x: 228, y: 250 },
        { id: "P_in1",  type: "port", ref: "IN1",  x: 20,  y: 112 },
        { id: "P_in2",  type: "port", ref: "IN2",  x: 450, y: 112 },
        { id: "P_out1", type: "port", ref: "OUT1", x: 195, y: 100 },
        { id: "P_out2", type: "port", ref: "OUT2", x: 195, y: 160 },
      ],
      wires: [
        { from: "QA1.S", to: "P_vm.1" },   // VM rail
        { from: "QB1.S", to: "P_vm.1" },
        { from: "QA2.S", to: "P_gnd.1" },  // GND rail
        { from: "QB2.S", to: "P_gnd.1" },
        { from: "P_in1.1", to: "QA1.G" },  // IN1 → both left gates
        { from: "P_in1.1", to: "QA2.G" },
        { from: "P_in2.1", to: "QB1.G" },  // IN2 → both right gates
        { from: "P_in2.1", to: "QB2.G" },
        { from: "QA1.D", to: "QA2.D" },    // left output node
        { from: "QA1.D", to: "P_out1.1" },
        { from: "QB1.D", to: "QB2.D" },    // right output node
        { from: "QB2.D", to: "P_out2.1" },
      ],
    },
  },
};

/** Look up a supported IC part's discrete equivalent (undefined ⇒ not supported / can't break down). */
export function discreteEquivalentFor(partId?: string | null): DiscreteEquivalent | undefined {
  return partId ? DISCRETE_LIBRARY[partId] : undefined;
}
