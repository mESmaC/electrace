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
  "ne555": {
    ic: "ne555",
    name: "555 timer — two comparators, a latch, and a discharge switch",
    note: "The most famous chip in electronics, opened up. R1–R3 are the three equal resistors the '555' is named for — they tap 1/3 and 2/3 of VCC. Comparator A trips when THR passes 2/3·VCC (resetting the latch), comparator B when TRG drops under 1/3·VCC (setting it). The latch's inverted output turns the discharge transistor on whenever the output is low. CV is literally the 2/3 tap — that's why decoupling it steadies the frequency. Simplified honestly: the latch is drawn as a logic block (itself two cross-coupled transistors), RST is wired into the reset line without its real priority logic, and the output buffer is omitted.",
    schematic: {
      parts: [
        { ref: "R1", type: "res", value: "5k", footprint: "R0603", why: "top of the famous 3×5k divider — sets the 2/3·VCC threshold" },
        { ref: "R2", type: "res", value: "5k", footprint: "R0603", why: "middle of the divider — between the 2/3 and 1/3 taps" },
        { ref: "R3", type: "res", value: "5k", footprint: "R0603", why: "bottom of the divider — sets the 1/3·VCC trigger point" },
        { ref: "U1", type: "ic", part: "comparator", why: "threshold comparator — flips when THR rises past 2/3·VCC; resets the latch" },
        { ref: "U2", type: "ic", part: "comparator", why: "trigger comparator — flips when TRG falls under 1/3·VCC; sets the latch" },
        { ref: "L1", type: "ic", why: "the SR latch the comparators fight over — itself just two cross-coupled transistors" },
        { ref: "Q1", type: "bjt", why: "the discharge switch — shorts DIS to ground whenever the output is low, so the timing cap can drain" },
      ],
      nets: [
        { name: "VCC", connect: ["R1.1", "@VCC"] },
        { name: "REF23", connect: ["R1.2", "R2.1", "U1.in-", "@CV"] },
        { name: "REF13", connect: ["R2.2", "R3.1", "U2.in+"] },
        { name: "THR", connect: ["U1.in+", "@THR"] },
        { name: "TRG", connect: ["U2.in-", "@TRG"] },
        { name: "RESET", connect: ["U1.out", "L1.R", "@RST"] },
        { name: "SET", connect: ["U2.out", "L1.S"] },
        { name: "Q", connect: ["L1.Q", "@OUT"] },
        { name: "QB", connect: ["L1.QB", "Q1.B"] },
        { name: "DIS", connect: ["Q1.C", "@DIS"] },
        { name: "GND", connect: ["R3.2", "Q1.E", "@GND"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_vcc", type: "port", ref: "VCC", x: 40, y: 10 },
        { id: "R1", type: "resistor", ref: "R1", value: "5k", x: 65, y: 51, rot: 90 },
        { id: "R2", type: "resistor", ref: "R2", value: "5k", x: 65, y: 171, rot: 90 },
        { id: "R3", type: "resistor", ref: "R3", value: "5k", x: 65, y: 291, rot: 90 },
        { id: "P_cv", type: "port", ref: "CV", x: 20, y: 60 },
        { id: "U1", type: "opamp", ref: "U1", x: 250, y: 40 },
        { id: "U2", type: "opamp", ref: "U2", x: 250, y: 150 },
        { id: "P_thr", type: "port", ref: "THR", x: 20, y: 100 },
        { id: "P_trg", type: "port", ref: "TRG", x: 20, y: 260 },
        { id: "L1", type: "chip", ref: "L1", value: "SR", x: 380, y: 100, chip: { profile: "soic", pins: 4, names: { "1": "R", "2": "S", "3": "Q", "4": "QB" } } },
        { id: "P_rst", type: "port", ref: "RST", x: 330, y: 20 },
        { id: "Q1", type: "npn", ref: "Q1", x: 470, y: 180 },
        { id: "P_out", type: "port", ref: "OUT", x: 530, y: 130 },
        { id: "P_dis", type: "port", ref: "DIS", x: 560, y: 170 },
        { id: "P_gnd", type: "port", ref: "GND", x: 280, y: 400 },
      ],
      wires: [
        { from: "P_vcc.1", to: "R1.1" },
        { from: "R1.2", to: "R2.1" },
        { from: "R2.2", to: "R3.1" },
        { from: "P_cv.1", to: "R1.2" },
        { from: "R1.2", to: "U1.in-" },
        { from: "P_thr.1", to: "U1.in+", via: [[230, 110], [230, 56]] },
        { from: "R2.2", to: "U2.in+", via: [[235, 230], [235, 166]] },
        { from: "P_trg.1", to: "U2.in-", via: [[210, 270], [210, 190]] },
        { from: "U1.out", to: "L1.1" },
        { from: "P_rst.1", to: "L1.1" },
        { from: "U2.out", to: "L1.2" },
        { from: "L1.3", to: "P_out.1" },
        { from: "L1.4", to: "Q1.B", via: [[460, 120], [460, 212]] },
        { from: "Q1.C", to: "P_dis.1" },
        { from: "R3.2", to: "P_gnd.1" },
        { from: "Q1.E", to: "P_gnd.1", via: [[510, 380]] },
      ],
    },
  },
  "comparator": {
    ic: "comparator",
    name: "Comparator — a long-tailed pair deciding who wins",
    note: "Every comparator (and every op-amp input) starts with this: two matched transistors sharing one emitter ('tail') current. Whichever base is higher steals more of the shared current, so its collector drops — the circuit literally weighs the two inputs against each other. The output is taken single-ended from one collector. Simplified honestly: the tail is a plain resistor (a real part uses a current source for supply rejection), the loads are resistors (real parts use a current mirror for gain), and there's no output stage — which is why real comparator outputs are open-collector: you're looking almost straight at a collector.",
    schematic: {
      parts: [
        { ref: "Q1", type: "npn", why: "the in+ side of the pair — more base voltage here steals more tail current" },
        { ref: "Q2", type: "npn", why: "the in− side — matched twin of Q1; the contest is between their bases" },
        { ref: "RC1", type: "res", value: "10k", why: "Q1's collector load — turns its share of the current into a voltage" },
        { ref: "RC2", type: "res", value: "10k", why: "Q2's collector load — the output is read across this one" },
        { ref: "RE", type: "res", value: "10k", why: "the 'long tail' — the shared current both sides fight over (a real IC uses a current source here)" },
      ],
      nets: [
        { name: "vcc", connect: ["RC1.1", "RC2.1", "@vcc"] },
        { name: "c1", connect: ["RC1.2", "Q1.C"] },
        { name: "out", connect: ["RC2.2", "Q2.C", "@out"] },
        { name: "inp", connect: ["Q1.B", "@in+"] },
        { name: "inn", connect: ["Q2.B", "@in-"] },
        { name: "tail", connect: ["Q1.E", "Q2.E", "RE.1"] },
        { name: "gnd", connect: ["RE.2", "@gnd"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_vcc", type: "port", ref: "vcc", x: 200, y: 10 },
        { id: "RC1", type: "resistor", ref: "RC1", value: "10k", x: 105, y: 51, rot: 90 },
        { id: "RC2", type: "resistor", ref: "RC2", value: "10k", x: 245, y: 51, rot: 90 },
        { id: "Q1", type: "npn", ref: "Q1", x: 110, y: 108 },
        { id: "Q2", type: "npn", ref: "Q2", x: 250, y: 108 },
        { id: "RE", type: "resistor", ref: "RE", value: "10k", x: 155, y: 201, rot: 90 },
        { id: "P_inp", type: "port", ref: "in+", x: 20, y: 130 },
        { id: "P_inn", type: "port", ref: "in-", x: 20, y: 200 },
        { id: "P_out", type: "port", ref: "out", x: 420, y: 100 },
        { id: "P_gnd", type: "port", ref: "gnd", x: 185, y: 290 },
      ],
      wires: [
        { from: "RC1.1", to: "P_vcc.1" },
        { from: "RC2.1", to: "P_vcc.1" },
        { from: "RC1.2", to: "Q1.C" },
        { from: "RC2.2", to: "Q2.C" },
        { from: "P_inp.1", to: "Q1.B" },
        { from: "P_inn.1", to: "Q2.B" },
        { from: "Q1.E", to: "RE.1" },
        { from: "Q2.E", to: "RE.1" },
        { from: "RE.2", to: "P_gnd.1" },
        { from: "Q2.C", to: "P_out.1" },
      ],
    },
  },
};

/** Look up a supported IC part's discrete equivalent (undefined ⇒ not supported / can't break down). */
export function discreteEquivalentFor(partId?: string | null): DiscreteEquivalent | undefined {
  return partId ? DISCRETE_LIBRARY[partId] : undefined;
}
