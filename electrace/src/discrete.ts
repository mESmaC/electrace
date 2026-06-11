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
        { from: "P_inn.1", to: "Q2.B", via: [[236, 250]] },
        { from: "Q1.E", to: "RE.1" },
        { from: "Q2.E", to: "RE.1" },
        { from: "RE.2", to: "P_gnd.1" },
        { from: "Q2.C", to: "P_out.1" },
      ],
    },
  },
  "buck-controller": {
    ic: "buck-controller",
    name: "Buck controller — a comparator flipping a switch",
    note: "The simplest REAL control scheme there is: hysteretic ('bang-bang') regulation. The comparator watches the feedback pin against a ~1.0 V reference — FB below the reference means the output sagged, so the switch turns ON; above it, OFF. The inductor and output cap (outside this chip) smooth the banging into a steady rail. Honest simplifications: the reference is drawn as a zener (real parts use a ~1.0 V bandgap — zeners don't come that low); production controllers use fixed-frequency PWM with an error amplifier instead of pure hysteresis, plus soft-start, current limiting, and dead-time. But hysteretic converters ship in real products — this isn't a cartoon, it's the minimum viable truth. Open the comparator for the next layer down.",
    schematic: {
      parts: [
        { ref: "R1", type: "res", value: "10k", why: "bias for the reference — a few hundred microamps keeps the zener in regulation" },
        { ref: "D1", type: "zener", value: "1V0 ref", why: "the reference the whole supply is judged against (drawn as a zener; really a bandgap)" },
        { ref: "U2", type: "ic", part: "comparator", why: "the entire control law: FB below the reference → switch ON. That's it." },
        { ref: "R2", type: "res", value: "1k", why: "base drive for the gate-driver transistor" },
        { ref: "Q2", type: "bjt", why: "gate driver / inverter — comparator says ON, this yanks the P-FET's gate low" },
        { ref: "R3", type: "res", value: "10k", why: "gate pull-up — guarantees the P-FET is OFF when nothing is driving" },
        { ref: "Q1", type: "mosfet", part: "p-fet", why: "the power switch — connects VIN to SW while ON; the inductor takes it from there" },
      ],
      nets: [
        { name: "VIN", connect: ["R1.1", "Q1.S", "R3.1", "@VIN"] },
        { name: "REF", connect: ["R1.2", "D1.2", "U2.in+"] },
        { name: "FB", connect: ["U2.in-", "@FB"] },
        { name: "CMP", connect: ["U2.out", "R2.1"] },
        { name: "BASE", connect: ["R2.2", "Q2.B"] },
        { name: "GATE", connect: ["Q2.C", "R3.2", "Q1.G"] },
        { name: "SW", connect: ["Q1.D", "@SW"] },
        { name: "GND", connect: ["D1.1", "Q2.E", "@GND"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_vin", type: "port", ref: "VIN", x: 30, y: 2 },
        { id: "R1", type: "resistor", ref: "R1", value: "10k", x: 55, y: 51, rot: 90 },
        { id: "D1", type: "zener", ref: "D1", value: "1V0", x: 65, y: 161, rot: 270 },
        { id: "U2", type: "opamp", ref: "U2", x: 190, y: 84 },
        { id: "P_fb", type: "port", ref: "FB", x: 30, y: 114 },
        { id: "R2", type: "resistor", ref: "R2", value: "1k", x: 270, y: 98 },
        { id: "Q2", type: "npn", ref: "Q2", x: 360, y: 80 },
        { id: "R3", type: "resistor", ref: "R3", value: "10k", x: 395, y: 43, rot: 90 },
        { id: "Q1", type: "pmos", ref: "Q1", x: 470, y: 10 },
        { id: "P_sw", type: "port", ref: "SW", x: 560, y: 80 },
        { id: "P_gnd", type: "port", ref: "GND", x: 220, y: 250 },
      ],
      wires: [
        { from: "P_vin.1", to: "Q1.S" },
        { from: "R1.1", to: "P_vin.1" },
        { from: "R1.2", to: "D1.2" },
        { from: "R1.2", to: "U2.in+" },
        { from: "P_fb.1", to: "U2.in-" },
        { from: "U2.out", to: "R2.1" },
        { from: "R2.2", to: "Q2.B" },
        { from: "Q2.C", to: "Q1.G" },
        { from: "R3.2", to: "Q1.G" },
        { from: "Q1.D", to: "P_sw.1" },
        { from: "D1.1", to: "P_gnd.1" },
        { from: "Q2.E", to: "P_gnd.1" },
      ],
    },
  },
  "boost-controller": {
    ic: "boost-controller",
    name: "Boost controller — the same comparator trick, low side",
    note: "Identical philosophy to the buck's hysteretic control, mirrored for a boost: the comparator watches FB against a ~1.0 V reference, and when the output sags it turns the LOW-SIDE N-FET on — charging the inductor against ground. Release the switch and the inductor's current has nowhere to go but UP through the diode into the output. Same honest simplifications as the buck: bandgap drawn as a zener, real parts use fixed-frequency PWM with slope compensation, current limits, and soft-start around this exact core.",
    schematic: {
      parts: [
        { ref: "R1", type: "res", value: "10k", why: "bias for the reference" },
        { ref: "D1", type: "zener", value: "1V0 ref", why: "the reference (drawn as a zener; really a bandgap)" },
        { ref: "U2", type: "ic", part: "comparator", why: "the control law: FB below the reference → charge the inductor" },
        { ref: "R2", type: "res", value: "100", why: "gate series resistance — tames the switching edge" },
        { ref: "Q1", type: "mosfet", part: "n-fet", why: "the power switch — pulls SW to ground to wind the inductor up" },
      ],
      nets: [
        { name: "VIN", connect: ["R1.1", "@VIN"] },
        { name: "REF", connect: ["R1.2", "D1.2", "U2.in+"] },
        { name: "FB", connect: ["U2.in-", "@FB"] },
        { name: "CMP", connect: ["U2.out", "R2.1"] },
        { name: "GATE", connect: ["R2.2", "Q1.G"] },
        { name: "SW", connect: ["Q1.D", "@SW"] },
        { name: "GND", connect: ["D1.1", "Q1.S", "@GND"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_vin", type: "port", ref: "VIN", x: 30, y: 10 },
        { id: "R1", type: "resistor", ref: "R1", value: "10k", x: 55, y: 51, rot: 90 },
        { id: "D1", type: "zener", ref: "D1", value: "1V0", x: 65, y: 161, rot: 270 },
        { id: "U2", type: "opamp", ref: "U2", x: 190, y: 84 },
        { id: "P_fb", type: "port", ref: "FB", x: 30, y: 114 },
        { id: "R2", type: "resistor", ref: "R2", value: "100", x: 270, y: 98 },
        { id: "Q1", type: "nmos", ref: "Q1", x: 360, y: 80 },
        { id: "P_sw", type: "port", ref: "SW", x: 470, y: 70 },
        { id: "P_gnd", type: "port", ref: "GND", x: 220, y: 250 },
      ],
      wires: [
        { from: "P_vin.1", to: "R1.1" },
        { from: "R1.2", to: "D1.2" },
        { from: "R1.2", to: "U2.in+" },
        { from: "P_fb.1", to: "U2.in-" },
        { from: "U2.out", to: "R2.1" },
        { from: "R2.2", to: "Q1.G" },
        { from: "Q1.D", to: "P_sw.1" },
        { from: "D1.1", to: "P_gnd.1" },
        { from: "Q1.S", to: "P_gnd.1" },
      ],
    },
  },
  "tl431": {
    ic: "tl431",
    name: "TL431 — an adjustable zener, opened up",
    note: "Three things in a three-pin package: a 2.495 V reference (drawn as a zener here — the real part uses a bandgap, which is how it stays precise across temperature), an error amplifier (drawn as a comparator — in the real part it's linear, not snapping), and a shunt transistor. The amplifier watches the REF pin against the internal reference and drives the transistor to pull the cathode down exactly as hard as needed to make them match. That closed loop is why a TL431 regulates like an ideal zener instead of drifting like a real one. Open the comparator for the next layer down.",
    schematic: {
      parts: [
        { ref: "R1", type: "res", value: "10k", why: "bias for the internal reference — runs off the cathode itself, which is why the part needs ~1 mA minimum to regulate" },
        { ref: "D1", type: "zener", value: "2V5 ref", why: "the 2.495 V reference everything is judged against (drawn as a zener; really a bandgap)" },
        { ref: "U2", type: "ic", part: "comparator", why: "the error amplifier: REF above the internal reference → drive the shunt harder (linear in the real part — drawn as a comparator so you can open it)" },
        { ref: "R2", type: "res", value: "1k", why: "base drive for the shunt transistor" },
        { ref: "Q1", type: "bjt", why: "the shunt — pulls the cathode toward the anode; the loop sets exactly how hard" },
      ],
      nets: [
        { name: "K", connect: ["R1.1", "Q1.C", "@k"] },
        { name: "IREF", connect: ["R1.2", "D1.2", "U2.in-"] },
        { name: "REF", connect: ["U2.in+", "@ref"] },
        { name: "CMP", connect: ["U2.out", "R2.1"] },
        { name: "BASE", connect: ["R2.2", "Q1.B"] },
        { name: "A", connect: ["D1.1", "Q1.E", "@a"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_k", type: "port", ref: "K", x: 30, y: 10 },
        { id: "R1", type: "resistor", ref: "R1", value: "10k", x: 55, y: 51, rot: 90 },
        { id: "D1", type: "zener", ref: "D1", value: "2V5", x: 65, y: 161, rot: 270 },
        { id: "P_ref", type: "port", ref: "REF", x: 140, y: 40, rot: 270 },
        { id: "U2", type: "opamp", ref: "U2", x: 190, y: 84 },
        { id: "R2", type: "resistor", ref: "R2", value: "1k", x: 270, y: 98 },
        { id: "Q1", type: "npn", ref: "Q1", x: 360, y: 80 },
        { id: "P_a", type: "port", ref: "A", x: 220, y: 250, rot: 90 },
      ],
      wires: [
        { from: "P_k.1", to: "R1.1" },
        { from: "R1.2", to: "D1.2" },
        { from: "R1.2", to: "U2.in-", via: [[160, 110], [160, 124]] },
        { from: "P_ref.1", to: "U2.in+", via: [[155, 100]] },
        { from: "U2.out", to: "R2.1" },
        { from: "R2.2", to: "Q1.B" },
        { from: "Q1.C", to: "P_k.1", via: [[400, 20]] },
        { from: "D1.1", to: "P_a.1", via: [[100, 245]] },
        { from: "Q1.E", to: "P_a.1", via: [[400, 245]] },
      ],
    },
  },
  "optocoupler": {
    ic: "optocoupler",
    name: "Optocoupler — an LED staring at a phototransistor",
    note: "The simplest teardown in the library, and the most honest: there is NOTHING else in the package. An LED on one side, a phototransistor on the other, and a deliberate gap between them. Current lights the LED; the light — and only the light — crosses the gap; the phototransistor conducts in proportion (the datasheet's CTR says how much). That gap is the entire product: the two halves share no wire, no ground, nothing. The drawing below has no connection between its left and right halves on purpose.",
    schematic: {
      parts: [
        { ref: "D1", type: "led", why: "the transmitter — an infrared LED; the input signal's current becomes light" },
        { ref: "Q1", type: "bjt", why: "the receiver — a phototransistor whose base is its own exposed junction: light IS the base current" },
      ],
      nets: [
        { name: "A", connect: ["D1.1", "@a"] },
        { name: "K", connect: ["D1.2", "@k"] },
        { name: "C", connect: ["Q1.C", "@c"] },
        { name: "E", connect: ["Q1.E", "@e"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_a", type: "port", ref: "A", x: 30, y: 50, rot: 180 },
        { id: "D1", type: "led", ref: "D1", x: 90, y: 38 },
        { id: "P_k", type: "port", ref: "K", x: 200, y: 50 },
        { id: "Q1", type: "phototransistor", ref: "Q1", x: 300, y: 28 },
        { id: "P_c", type: "port", ref: "C", x: 400, y: 20 },
        { id: "P_e", type: "port", ref: "E", x: 400, y: 80 },
      ],
      wires: [
        { from: "P_a.1", to: "D1.1" },
        { from: "D1.2", to: "P_k.1" },
        { from: "Q1.C", to: "P_c.1" },
        { from: "Q1.E", to: "P_e.1" },
      ],
    },
  },
  "opamp": {
    ic: "opamp",
    name: "Op-amp — three stages and a cap that keeps it honest",
    note: "Every op-amp is the comparator's long-tailed pair grown up: the same two matched transistors weigh in+ against in−, but now a PNP current mirror turns BOTH collector currents into one signal (double the gain, no wasted half), a second transistor amplifies that into a big voltage swing, and a push-pull pair muscles the result out. The tiny capacitor is the entire difference between an op-amp and a comparator: it deliberately slows the gain stage (Miller compensation) so a feedback loop around the whole thing can't oscillate. Simplified honestly: the tail is a resistor (real parts use a current source), and the bias diodes only roughly cancel crossover distortion.",
    schematic: {
      parts: [
        { ref: "Q1", type: "npn", why: "in+ side of the input pair — more voltage here steers more tail current" },
        { ref: "Q2", type: "npn", why: "in− side — the matched twin; the pair amplifies only the DIFFERENCE between the bases" },
        { ref: "Q3", type: "pnp", why: "current-mirror master — diode-connected, it copies Q1's collector current…" },
        { ref: "Q4", type: "pnp", why: "…mirror slave: forces Q1's current onto Q2's collector, so any imbalance has nowhere to go but out — twice the gain a resistor load would give" },
        { ref: "RE", type: "res", value: "10k", why: "the shared tail current (a real op-amp uses a current source here for supply rejection)" },
        { ref: "Q5", type: "npn", why: "voltage-amplification stage — turns the input pair's small signal into nearly the full supply swing" },
        { ref: "RC", type: "res", value: "10k", why: "Q5's collector load" },
        { ref: "CC", type: "cap", value: "30pF", why: "Miller compensation — THE op-amp ingredient: rolls gain off with frequency so closed-loop feedback stays stable instead of ringing" },
        { ref: "D1", type: "diode", why: "bias diode — with D2, holds the output pair's bases ~1.2 V apart…" },
        { ref: "D2", type: "diode", why: "…so both output transistors are just barely on, smoothing the NPN→PNP handover (class AB)" },
        { ref: "Q6", type: "npn", why: "output high side — sources current into the load on positive swings" },
        { ref: "Q7", type: "pnp", why: "output low side — sinks current on negative swings; together they drive loads the gain stages never could" },
      ],
      nets: [
        { name: "vcc", connect: ["Q3.E", "Q4.E", "RC.1", "Q6.C", "@vcc"] },
        { name: "mir", connect: ["Q3.B", "Q4.B", "Q3.C", "Q1.C"] },
        { name: "diff", connect: ["Q4.C", "Q2.C", "Q5.B", "CC.1"] },
        { name: "inp", connect: ["Q1.B", "@in+"] },
        { name: "inn", connect: ["Q2.B", "@in-"] },
        { name: "tail", connect: ["Q1.E", "Q2.E", "RE.1"] },
        { name: "vas", connect: ["Q5.C", "RC.2", "CC.2", "D1.1", "Q6.B"] },
        { name: "bias", connect: ["D1.2", "D2.1"] },
        { name: "basep", connect: ["D2.2", "Q7.B"] },
        { name: "out", connect: ["Q6.E", "Q7.E", "@out"] },
        { name: "gnd", connect: ["RE.2", "Q5.E", "Q7.C", "@gnd"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_vcc", type: "port", ref: "vcc", x: 290, y: 10 },
        { id: "Q3", type: "pnp", ref: "Q3", x: 130, y: 64 },
        { id: "Q4", type: "pnp", ref: "Q4", x: 270, y: 64 },
        { id: "Q1", type: "npn", ref: "Q1", x: 116, y: 168 },
        { id: "Q2", type: "npn", ref: "Q2", x: 256, y: 168 },
        { id: "RE", type: "resistor", ref: "RE", value: "10k", x: 175, y: 285, rot: 90 },
        { id: "P_inp", type: "port", ref: "in+", x: 20, y: 190, rot: 180 },
        { id: "P_inn", type: "port", ref: "in-", x: 20, y: 250, rot: 180 },
        { id: "RC", type: "resistor", ref: "RC", value: "10k", x: 395, y: 51, rot: 90 },
        { id: "Q5", type: "npn", ref: "Q5", x: 400, y: 168 },
        { id: "CC", type: "capacitor", ref: "CC", value: "30pF", x: 322, y: 116 },
        { id: "D1", type: "diode", ref: "D1", x: 490, y: 96, rot: 90 },
        { id: "D2", type: "diode", ref: "D2", x: 490, y: 156, rot: 90 },
        { id: "Q6", type: "npn", ref: "Q6", x: 545, y: 64 },
        { id: "Q7", type: "pnp", ref: "Q7", x: 545, y: 200 },
        { id: "P_out", type: "port", ref: "out", x: 660, y: 140 },
        { id: "P_gnd", type: "port", ref: "gnd", x: 300, y: 340, rot: 90 },
      ],
      wires: [
        { from: "Q3.E", to: "P_vcc.1", via: [[150, 14]] },
        { from: "Q4.E", to: "P_vcc.1" },
        { from: "RC.1", to: "P_vcc.1", via: [[395, 14]] },
        { from: "Q6.C", to: "P_vcc.1", via: [[565, 14]] },
        { from: "Q3.B", to: "Q4.B" },
        { from: "Q3.B", to: "Q3.C" },
        { from: "Q3.C", to: "Q1.C" },
        { from: "Q4.C", to: "Q2.C" },
        { from: "Q4.C", to: "Q5.B" },
        { from: "CC.1", to: "Q2.C" },
        { from: "CC.2", to: "Q5.C" },
        { from: "P_inp.1", to: "Q1.B" },
        { from: "P_inn.1", to: "Q2.B", via: [[236, 250]] },
        { from: "Q1.E", to: "RE.1" },
        { from: "Q2.E", to: "RE.1" },
        { from: "RE.2", to: "P_gnd.1" },
        { from: "Q5.C", to: "RC.2" },
        { from: "Q5.C", to: "D1.1" },
        { from: "D1.1", to: "Q6.B" },
        { from: "D1.2", to: "D2.1" },
        { from: "D2.2", to: "Q7.B" },
        { from: "Q6.E", to: "P_out.1" },
        { from: "Q7.E", to: "P_out.1" },
        { from: "Q5.E", to: "P_gnd.1" },
        { from: "Q7.C", to: "P_gnd.1", via: [[565, 332]] },
      ],
    },
  },
  "tp4056": {
    ic: "tp4056",
    name: "Li-ion charger — a pass transistor with two referees",
    note: "Linear CC/CV charging, drawn out: a power PNP passes current from input to cell, and two control loops referee it. The current referee: charge current through the sense resistor drops a voltage across Q3's base-emitter — past ~0.6 V (here ≈ 1 A), Q3 wakes and steals the pass transistor's drive, so current can't rise further (constant current). The voltage referee: when the cell reaches the 3.6 V zener plus Q4's 0.6 V base-emitter — 4.2 V, the Li-ion full-charge number — Q4 robs the driver instead and the current tapers (constant voltage). The sense resistor IS the PROG pin's job here: I ≈ 0.6 V / R. Simplified honestly: the real IC adds a precision reference (a zener is not ±1%), thermal regulation, and the TEMP/STDBY functions omitted from this drawing.",
    schematic: {
      parts: [
        { ref: "RS", type: "res", value: "0.6", why: "current sense AND current programmer — charge current is whatever drops 0.6 V here: I ≈ 0.6/0.6 = 1 A (the discrete version of PROG)" },
        { ref: "Q1", type: "pnp", why: "the pass element — a power PNP carrying the whole charge current; everything else just decides how hard it's on" },
        { ref: "Q3", type: "pnp", why: "current referee — its base-emitter sits across the sense resistor; past 0.6 V it conducts and lifts Q1's base, capping the current" },
        { ref: "RPU", type: "res", value: "10k", why: "default-off — holds Q1's base at its emitter until the driver pulls it down" },
        { ref: "RD", type: "res", value: "1k", why: "drive resistor — Q2 pulls Q1's base low through this to turn charging on" },
        { ref: "Q2", type: "npn", why: "the driver — enabled by CE, it sinks Q1's base current; both referees work by stealing THIS" },
        { ref: "REN", type: "res", value: "10k", why: "enable resistor — CE high feeds Q2's base" },
        { ref: "D1", type: "zener", value: "3.6V", why: "voltage reference — conducts once the cell passes 3.6 V + Q4's 0.6 V = 4.2 V, the Li-ion full-charge voltage" },
        { ref: "RZ", type: "res", value: "1k", why: "limits the zener-to-base current" },
        { ref: "Q4", type: "npn", why: "voltage referee — when the zener conducts, Q4 robs the driver's base and charging tapers to a stop" },
        { ref: "Q5", type: "npn", why: "status output — on while the driver is driving, pulling CHRG low (open-collector, just like the IC)" },
        { ref: "R5", type: "res", value: "10k", why: "Q5's base feed from the enable node" },
      ],
      nets: [
        { name: "VIN", connect: ["RS.1", "Q3.E", "RPU.1", "@VCC"] },
        { name: "SENSE", connect: ["RS.2", "Q1.E", "Q3.B", "@PROG"] },
        { name: "BAT", connect: ["Q1.C", "D1.2", "@BAT"] },
        { name: "DRV", connect: ["Q1.B", "RPU.2", "RD.1", "Q3.C"] },
        { name: "SINK", connect: ["RD.2", "Q2.C"] },
        { name: "EN", connect: ["REN.2", "Q2.B", "Q4.C", "R5.1"] },
        { name: "CE", connect: ["REN.1", "@CE"] },
        { name: "ZB", connect: ["D1.1", "RZ.1"] },
        { name: "Q4B", connect: ["RZ.2", "Q4.B"] },
        { name: "Q5B", connect: ["R5.2", "Q5.B"] },
        { name: "CHRG", connect: ["Q5.C", "@CHRG"] },
        { name: "GND", connect: ["Q2.E", "Q4.E", "Q5.E", "@GND"] },
      ],
    },
    layout: {
      symbols: [
        { id: "P_vcc", type: "port", ref: "VCC", x: 30, y: 60, rot: 180 },
        { id: "RS", type: "resistor", ref: "RS", value: "0.6Ω", x: 120, y: 56 },
        { id: "Q3", type: "pnp", ref: "Q3", x: 175, y: 150 },
        { id: "Q1", type: "pnp", ref: "Q1", x: 280, y: 88 },
        { id: "P_prog", type: "port", ref: "PROG", x: 245, y: 200, rot: 90 },
        { id: "P_bat", type: "port", ref: "BAT", x: 560, y: 60 },
        { id: "RPU", type: "resistor", ref: "RPU", value: "10k", x: 330, y: 121, rot: 90 },
        { id: "RD", type: "resistor", ref: "RD", value: "1k", x: 330, y: 201, rot: 90 },
        { id: "Q2", type: "npn", ref: "Q2", x: 325, y: 280 },
        { id: "REN", type: "resistor", ref: "REN", value: "10k", x: 215, y: 296 },
        { id: "P_ce", type: "port", ref: "CE", x: 120, y: 300, rot: 180 },
        { id: "D1", type: "zener", ref: "D1", value: "3.6V", x: 480, y: 121, rot: 90 },
        { id: "RZ", type: "resistor", ref: "RZ", value: "1k", x: 480, y: 196, rot: 90 },
        { id: "Q4", type: "npn", ref: "Q4", x: 475, y: 280 },
        { id: "R5", type: "resistor", ref: "R5", value: "10k", x: 555, y: 296 },
        { id: "Q5", type: "npn", ref: "Q5", x: 645, y: 280 },
        { id: "P_chrg", type: "port", ref: "CHRG", x: 730, y: 240 },
        { id: "P_gnd", type: "port", ref: "GND", x: 400, y: 405, rot: 90 },
      ],
      wires: [
        { from: "P_vcc.1", to: "RS.1" },
        { from: "P_vcc.1", to: "Q3.E" },
        { from: "RS.2", to: "Q1.E" },
        { from: "RS.2", to: "Q3.B" },
        { from: "RS.2", to: "P_prog.1" },
        { from: "Q1.C", to: "P_bat.1" },
        { from: "D1.2", to: "P_bat.1" },
        { from: "Q1.B", to: "RPU.1" },
        { from: "RPU.1", to: "Q3.C" },
        { from: "RPU.2", to: "RD.1" },
        { from: "RD.2", to: "Q2.C" },
        { from: "REN.2", to: "Q2.B" },
        { from: "P_ce.1", to: "REN.1" },
        { from: "Q4.C", to: "Q2.B", via: [[700, 252], [430, 252]] },
        { from: "R5.1", to: "Q2.B", via: [[598, 252], [430, 252]] },
        { from: "D1.1", to: "RZ.1" },
        { from: "RZ.2", to: "Q4.B" },
        { from: "R5.2", to: "Q5.B" },
        { from: "Q5.C", to: "P_chrg.1" },
        { from: "Q2.E", to: "P_gnd.1" },
        { from: "Q4.E", to: "P_gnd.1" },
        { from: "Q5.E", to: "P_gnd.1" },
      ],
    },
  },
};

/** Look up a supported IC part's discrete equivalent (undefined ⇒ not supported / can't break down). */
export function discreteEquivalentFor(partId?: string | null): DiscreteEquivalent | undefined {
  return partId ? DISCRETE_LIBRARY[partId] : undefined;
}
