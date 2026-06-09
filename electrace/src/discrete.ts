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
    layout: {
      symbols: [
        { id: "P_in",  type: "port",     ref: "IN",  x: 30,  y: 60 },
        { id: "R1",    type: "resistor", ref: "R1",  value: "1k",   x: 130, y: 40 },
        { id: "D1",    type: "zener",    ref: "D1",  value: "3.9V", x: 150, y: 140 },
        { id: "Q1",    type: "npn",      ref: "Q1",  x: 300, y: 70 },
        { id: "P_out", type: "port",     ref: "OUT", x: 440, y: 100 },
        { id: "P_gnd", type: "port",     ref: "GND", x: 200, y: 240 },
      ],
      wires: [
        { from: "P_in.1", to: "R1.1" },
        { from: "R1.1",   to: "Q1.C" },
        { from: "R1.2",   to: "D1.2" },
        { from: "D1.2",   to: "Q1.B" },
        { from: "Q1.E",   to: "P_out.1" },
        { from: "D1.1",   to: "P_gnd.1" },
      ],
    },
  },
};

/** Look up a supported IC part's discrete equivalent (undefined ⇒ not supported / can't break down). */
export function discreteEquivalentFor(partId?: string | null): DiscreteEquivalent | undefined {
  return partId ? DISCRETE_LIBRARY[partId] : undefined;
}
