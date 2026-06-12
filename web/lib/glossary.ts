// The glossary: short, genuinely good definitions that each link onward into the product —
// calculator, block page, check rule, video. Every term is a search door AND an internal-link
// hub; definitions are written to be quotable (the AI-assistant answer should be ours).

export interface GlossaryTerm {
  slug: string;
  term: string;
  also?: string[];           // synonyms folded into the page (and its metadata)
  def: string;               // the 2–3 sentence quotable definition
  practice: string;          // "in practice" — the working engineer's paragraph
  links: { label: string; href: string }[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "hysteresis", term: "Hysteresis", also: ["Schmitt trigger"],
    def: "Deliberately giving a threshold two values: one for crossing upward, a lower one for crossing back down. The gap means a signal that just crossed can't immediately un-cross, so noise near the threshold can't make the output chatter.",
    practice: "Any comparator watching a slow or noisy signal needs it. A feedback resistor from output to the + input shifts the threshold away from the signal the instant it trips — the circuit version of 'make up your mind'. Width is set by a resistor ratio; 1% of VCC is a typical start.",
    links: [
      { label: "Comparator with hysteresis — the circuit", href: "/blocks/comparator-hysteresis" },
      { label: "Why your comparator chatters (video on the block page)", href: "/blocks/comparator-hysteresis" },
    ],
  },
  {
    slug: "flyback-diode", term: "Flyback diode", also: ["Freewheeling diode", "Inductive kickback", "Back EMF"],
    def: "A diode placed backwards across an inductive load (relay coil, motor, solenoid) to catch the voltage spike at turn-off. An inductor's current can't stop instantly — cut its path and the voltage slams up hunting for one; the diode is the path.",
    practice: "Without it, a 12 V relay coil can put hundreds of volts on the switching transistor's collector — the classic silent microcontroller killer. The diode does nothing while the load runs (it's reverse-biased) and conducts only during the kick. 1N4007-class is fine for relays.",
    links: [
      { label: "Relay driver — the circuit with its flyback path", href: "/blocks/relay-driver" },
      { label: "Diode reverse voltage (PIV) — the related check", href: "/docs/checks/voltage-diode-piv" },
    ],
  },
  {
    slug: "reverse-polarity-protection", term: "Reverse-polarity protection",
    def: "Circuitry that makes connecting power backwards a non-event instead of a funeral. The modern version is a P-channel MOSFET that only forms its channel when polarity is correct — near-zero loss, no fuse to replace.",
    practice: "A series diode also works but wastes ~0.5–0.7 V forever — painful on battery rails. The P-FET trick costs millivolts. Anything a user plugs in (battery packs, barrel jacks, screw terminals) deserves it; one assembly mistake pays for the part a thousand times over.",
    links: [
      { label: "Reverse-polarity protection — the circuit", href: "/blocks/reverse-polarity-protection" },
      { label: "Polarity conflict — the related check", href: "/docs/checks/polarity-conflict" },
    ],
  },
  {
    slug: "piv", term: "Peak inverse voltage (PIV)", also: ["Reverse voltage rating", "V_RRM"],
    def: "The maximum reverse voltage a diode can block before it avalanches and conducts backwards — usually destructively for parts not designed to do so. Every blocking diode in a design has a worst-case reverse voltage; PIV must comfortably exceed it.",
    practice: "Rectifiers see roughly twice the peak AC voltage in reverse; a 'blocking' diode on a battery sees the full charger voltage. PIV is cheap — the 1000 V 1N4007 costs the same as the 50 V 1N4001 — so the only failure here is not checking.",
    links: [
      { label: "Diode reverse voltage — the check that computes it", href: "/docs/checks/voltage-diode-piv" },
      { label: "Diode reverse leakage", href: "/glossary/reverse-leakage" },
    ],
  },
  {
    slug: "reverse-leakage", term: "Reverse leakage", also: ["I_R", "Leakage current"],
    def: "The small current that flows backwards through a diode that is supposedly blocking. An OFF diode isn't a wall — datasheets specify I_R at a given reverse voltage, from nanoamps (small-signal silicon) to milliamps (large Schottkys, hot).",
    practice: "It matters most on batteries, where the leak runs 24/7: a few microamps of 'protection' diode can out-drain the microcontroller it protects. Leakage also rises steeply with temperature — the datasheet number at 25 °C can be 100× worse at 85 °C.",
    links: [
      { label: "Diode reverse leakage — the check", href: "/docs/checks/current-diode-leakage" },
      { label: "Standby draw", href: "/glossary/standby-current" },
    ],
  },
  {
    slug: "standby-current", term: "Standby current", also: ["Quiescent current", "Sleep current", "Off-state draw"],
    def: "What a circuit draws when everything that can sleep is asleep. 'Off' almost never means zero: voltage dividers, pull-ups, regulator quiescent current, and diode leakage have no sleep mode — they set a floor the design can never beat.",
    practice: "The classic mistake: a microcontroller sleeping at 10 µA next to a feedback divider burning 100 µA forever. Battery life is set by the floor, not the average. Add up the always-on paths first; the engine computes this floor exactly from the schematic.",
    links: [
      { label: "The standby-draw floor — built into the editor", href: "/editor" },
      { label: "Reverse leakage", href: "/glossary/reverse-leakage" },
    ],
  },
  {
    slug: "galvanic-isolation", term: "Galvanic isolation",
    def: "Two circuits that exchange information or power with no conductive path between them — coupled only through light (optocoupler), magnetic field (transformer), or capacitance (isolator ICs). The barrier is for safety, noise, or breaking ground loops.",
    practice: "The barrier is only as real as its weakest accidental bridge — and the classic accident is a shared ground through a debug connector or mounting hole. Isolation isn't a part you place; it's a property you must verify across every conductive path.",
    links: [
      { label: "Isolation bridged — the check that walks every path", href: "/docs/checks/isolation-bridged" },
      { label: "Optocoupler input — the circuit", href: "/blocks/optocoupler-input" },
    ],
  },
  {
    slug: "net-label", term: "Net label", also: ["Power flag", "Named net"],
    def: "A name attached to a point in a schematic that connects it to every other point carrying the same name — wiring by name instead of by drawn line. +5V, GND, and SDA labels replace the spaghetti of long power wires.",
    practice: "Labels aren't just tidiness: they document intent (a net named CHRG_STAT explains itself) and they name nets in netlists, exports, and error messages. Rule of thumb: power and ground by label, signal flow by drawn wire — readers follow signals, they look up rails.",
    links: [
      { label: "Net labels in the Electrace editor (right-click any terminal)", href: "/editor" },
    ],
  },
  {
    slug: "pull-up-resistor", term: "Pull-up resistor",
    def: "A resistor from a signal to the positive rail that defines the signal's idle state as HIGH. Anything that can only pull the line low — an open-collector output, a button to ground, an I²C device — needs one to make the high state exist.",
    practice: "Value is a speed/power trade: strong (1–4.7 k) for fast edges on capacitive buses, weak (10–100 k) to save current. On I²C the pull-up and the bus capacitance literally set the rise time — too weak and the bus drops bits at length.",
    links: [
      { label: "I²C rise time — the check that computes it", href: "/docs/checks/si-i2c-rise-time" },
      { label: "Open-collector output", href: "/glossary/open-collector" },
    ],
  },
  {
    slug: "open-collector", term: "Open-collector output", also: ["Open-drain"],
    def: "An output that can only pull LOW — its transistor sinks current to ground or lets the line float. The HIGH state comes from an external pull-up. Open-drain is the MOSFET version of the same idea.",
    practice: "It looks broken on first encounter: 'my comparator never goes high.' It isn't broken; it's missing its pull-up. The payoff is that many open-collector outputs can share one wire safely (wired-AND) — which is why I²C, interrupt lines, and fault flags use it.",
    links: [
      { label: "Comparator with hysteresis — note R4, the pull-up", href: "/blocks/comparator-hysteresis" },
      { label: "Multiple drivers — when sharing a wire is fine", href: "/docs/checks/connectivity-multiple-drivers" },
    ],
  },
  {
    slug: "voltage-divider", term: "Voltage divider",
    def: "Two resistors in series turning a voltage into a smaller, proportional one: Vout = Vin · R2/(R1+R2). The simplest circuit that does real work — references, feedback networks, level scaling, sensor reading.",
    practice: "Two cautions: it only holds when lightly loaded (the load becomes part of R2), and it burns current forever — a divider across a battery is a standby drain. For feedback networks, total resistance trades noise immunity against wasted current.",
    links: [
      { label: "Voltage divider calculator", href: "/calculators/voltage-divider" },
      { label: "Voltage divider — the block", href: "/blocks/voltage-divider" },
      { label: "Standby current", href: "/glossary/standby-current" },
    ],
  },
  {
    slug: "decoupling-capacitor", term: "Decoupling capacitor", also: ["Bypass capacitor"],
    def: "A small capacitor placed next to a chip's power pin to supply its instantaneous current demands locally, so fast spikes don't have to travel through the inductance of the power wiring. It decouples the chip from its supply's slowness.",
    practice: "The 100 nF ceramic next to every IC is the most-placed component in electronics. Placement IS the function: it works because it's close. A bulk capacitor (1–10 µF) per rail region handles the slower swings; the small one handles the edges.",
    links: [
      { label: "MCU load — see C1/C2 doing this job", href: "/blocks/mcu-load" },
    ],
  },
  {
    slug: "ldo", term: "LDO (low-dropout regulator)", also: ["Linear regulator"],
    def: "A linear regulator that holds its output voltage by burning the difference as heat — continuously adjusting a pass transistor so Vout stays put. 'Low-dropout' means it keeps regulating even when Vin is only a few hundred millivolts above Vout.",
    practice: "Heat is (Vin − Vout) × Iout, full stop. Dropping 12 V to 3.3 V at 500 mA is 4.35 W of heat — that's a switcher's job. LDOs shine for the quiet final volt: clean, simple, no switching noise, perfect after a buck has done the heavy lifting.",
    links: [
      { label: "LDO regulator — the circuit", href: "/blocks/ldo-regulator" },
      { label: "Linear regulator dissipation — the check", href: "/docs/checks/thermal-regulator-dissipation" },
      { label: "Buck converter", href: "/glossary/buck-converter" },
    ],
  },
  {
    slug: "buck-converter", term: "Buck converter", also: ["Step-down converter"],
    def: "A switching regulator that steps voltage down by chopping the input and averaging the result through an inductor and capacitor. Instead of burning the excess as heat, it converts — efficiencies of 85–95% are routine.",
    practice: "The trade for that efficiency: switching noise, more parts, and layout that matters. The feedback divider sets the output voltage; the inductor and switching frequency set the ripple. For drops bigger than a volt or two at real current, it's the default answer.",
    links: [
      { label: "Buck converter — the circuit, explained", href: "/blocks/buck-converter" },
      { label: "LDO — the other way to step down", href: "/glossary/ldo" },
    ],
  },
  {
    slug: "boost-converter", term: "Boost converter", also: ["Step-up converter"],
    def: "A switching regulator that steps voltage UP: the inductor is charged from the input, then its stored energy is released on top of the input voltage into the output. A single battery cell becomes a 5 V rail this way.",
    practice: "Boost converters can't current-limit through the inductor-diode path at startup, and the output can never go below Vin minus a diode drop — two surprises worth knowing before the bench finds them for you. Input current exceeds output current; size the source accordingly.",
    links: [
      { label: "Boost converter — the circuit", href: "/blocks/boost-converter" },
    ],
  },
  {
    slug: "duty-cycle", term: "Duty cycle",
    def: "The fraction of a period a signal spends HIGH, as a percentage. A 25% duty square wave is on a quarter of the time — and carries a quarter of the power a continuous signal would.",
    practice: "It's the control variable of almost everything switched: PWM dimming, motor speed, buck converter regulation, the 555's blink ratio. The classic astable 555 can't go below 50% without the extra diode trick — a question every 555 user eventually asks.",
    links: [
      { label: "555 timer calculator (astable/monostable + duty)", href: "/calculators/555-timer" },
      { label: "555 timer — the circuit, explained", href: "/blocks/timer-555" },
    ],
  },
  {
    slug: "rc-time-constant", term: "RC time constant (τ)",
    def: "τ = R × C: the time for a capacitor charging through a resistor to cover ~63% of the remaining distance to its target. Five τ is 'fully' charged (99.3%) — the universal clock of analog electronics.",
    practice: "Everything timing-flavored reduces to it: debounce delays, filter cutoffs, 555 periods, soft-start ramps, I²C rise times. If a circuit waits, charges, settles, or filters, find the R and the C and you've found its schedule.",
    links: [
      { label: "RC filter calculator", href: "/calculators/rc-filter" },
      { label: "RC low-pass — the block", href: "/blocks/rc-lowpass" },
      { label: "Cutoff frequency", href: "/glossary/cutoff-frequency" },
    ],
  },
  {
    slug: "cutoff-frequency", term: "Cutoff frequency", also: ["Corner frequency", "-3 dB point"],
    def: "The frequency where a filter's output power has fallen to half (−3 dB, ~70.7% of voltage). Not where the filter 'stops working' — where its effect becomes significant. For an RC filter: fc = 1/(2πRC).",
    practice: "Below cutoff a low-pass passes nearly everything; above, it rolls off at 20 dB/decade per pole. Choosing fc is choosing what counts as signal and what counts as noise — put it a decade away from both when you can.",
    links: [
      { label: "RC filter calculator", href: "/calculators/rc-filter" },
      { label: "Active filter designer (order 2–8)", href: "/calculators/filter-designer" },
    ],
  },
  {
    slug: "q-factor", term: "Q factor", also: ["Quality factor"],
    def: "How underdamped a resonant system is: high Q rings long and peaks sharply, low Q is sluggish and broad. For filters, Q sets the shape near the corner — 0.707 is maximally flat; higher peaks, lower droops.",
    practice: "In an LC circuit Q tells you the bandwidth (f0/Q) and the voltage magnification at resonance. In active filters, each cascaded stage has its own Q — and component spread grows with Q², which is why very sharp filters get awkward to build.",
    links: [
      { label: "LC resonance calculator", href: "/calculators/lc-resonance" },
      { label: "Active filter designer — per-stage Qs", href: "/calculators/filter-designer" },
    ],
  },
  {
    slug: "resonance", term: "Resonance (LC)",
    def: "The frequency where an inductor's and capacitor's reactances cancel: f0 = 1/(2π√(LC)). Energy sloshes between the magnetic and electric field with the source only topping up losses — tiny inputs build large swings.",
    practice: "Wanted: tuned circuits, crystal oscillators, wireless charging. Unwanted: the surprise peak in your supply filter, ringing on switching edges. Same equation either way — if there's an L and a C, there's an f0, whether you planned one or not.",
    links: [
      { label: "LC resonance calculator", href: "/calculators/lc-resonance" },
      { label: "Crystal load capacitance calculator", href: "/calculators/crystal-load-capacitor" },
    ],
  },
  {
    slug: "power-factor", term: "Power factor",
    def: "The fraction of apparent power (V × I) doing real work: PF = P/|S| = cos φ for sinusoids. At PF 0.7, the wires carry ~43% more current than the useful power requires — the extra just sloshes back and forth.",
    practice: "Utilities bill industry for poor PF because their wires and transformers are sized by current, not work. Correction means adding the opposite reactance — typically capacitors across inductive (motor) loads — sized for the actual operating point.",
    links: [
      { label: "AC power & power factor calculator", href: "/calculators/ac-power" },
      { label: "AC motor calculator", href: "/calculators/ac-motor" },
    ],
  },
  {
    slug: "three-phase-power", term: "Three-phase power",
    def: "Three AC supplies 120° apart sharing conductors. The sum of balanced phase currents is zero (slim or no neutral), instantaneous total power is constant (no torque pulsation), and √3 shows up in every line-vs-phase conversion.",
    practice: "V_line = √3 × V_phase in wye; I_line = √3 × I_phase in delta; P = √3 × V_L × I_L × PF for balanced loads either way. Keep the √3 with the line quantities and the algebra stays self-consistent.",
    links: [
      { label: "AC power calculator (single & three phase)", href: "/calculators/ac-power" },
      { label: "Delta–wye transformation calculator", href: "/calculators/delta-wye" },
    ],
  },
  {
    slug: "delta-wye", term: "Delta–wye transformation", also: ["Star-delta", "Y-Δ"],
    def: "The equivalence between three resistances arranged in a triangle (delta) and three in a star (wye): any delta has an exactly equivalent wye and vice versa. For balanced networks, Z_Y = Z_Δ/3.",
    practice: "It un-sticks network analysis when nothing is purely series or parallel (bridge circuits), and it's physical reality in three-phase machines — a motor started in wye sees 1/3 the per-winding power, which is the classic soft-start trick.",
    links: [
      { label: "Delta–wye calculator", href: "/calculators/delta-wye" },
      { label: "Three-phase power", href: "/glossary/three-phase-power" },
    ],
  },
  {
    slug: "thevenin-equivalent", term: "Thévenin equivalent",
    def: "Any linear circuit, seen from two terminals, behaves exactly like one voltage source in series with one resistance: Voc and Rth. The whole network collapses to two numbers that predict what any load will experience.",
    practice: "It answers the practical question 'what happens when I connect something here?' — sag under load, maximum transferable power (load = Rth), interface stiffness. The editor computes it live for any net: click and read Voc and Rth.",
    links: [
      { label: "Thévenin from any net — in the editor", href: "/editor" },
      { label: "Voltage divider (the classic Thévenin exercise)", href: "/calculators/voltage-divider" },
    ],
  },
  {
    slug: "kirchhoffs-laws", term: "Kirchhoff's laws (KCL & KVL)",
    def: "The two conservation laws all circuit analysis stands on. KCL: current into a node equals current out (charge doesn't pile up). KVL: voltages around any closed loop sum to zero (potential is single-valued).",
    practice: "Node-voltage analysis is just KCL written systematically — it's what circuit solvers (including this site's engine) do under the hood: one KCL equation per node, solve the system, every voltage and current falls out.",
    links: [
      { label: "Ohm's law & Joule's law calculator", href: "/calculators/ohms-law" },
      { label: "Current divider calculator", href: "/calculators/current-divider" },
    ],
  },
  {
    slug: "e-series", term: "E-series values (E12/E24/E96)", also: ["Standard resistor values", "Preferred numbers"],
    def: "The standard component value ladders: each series spaces values logarithmically so every real number is within a fixed tolerance of an available part. E12 steps ~20%, E24 ~10%, E96 ~2% — which is why 4.7 k exists and 5 k mostly doesn't.",
    practice: "Design math gives 11.25 kΩ; the shelf gives 11 k (E24). Good tools snap to the series and then recompute what the snapped value actually delivers — the difference between the circuit you calculated and the one you'll solder.",
    links: [
      { label: "Every calculator here snaps to E-series", href: "/calculators" },
      { label: "LED resistor calculator", href: "/calculators/led-resistor" },
    ],
  },
  {
    slug: "current-sense-resistor", term: "Current-sense resistor", also: ["Shunt resistor"],
    def: "A deliberately small, known resistance placed in a current path so the voltage across it reports the current: I = V/R. Milliohms to single ohms, chosen to drop enough to measure but not enough to matter.",
    practice: "It's how chargers regulate (the TP4056's PROG current is 'whatever drops 0.6 V here'), how fuel gauges count coulombs, how motor drivers detect stall. Power rating matters: P = I²R lands on a part chosen for smallness.",
    links: [
      { label: "Li-ion charger — RS is the whole current loop", href: "/blocks/liion-charger" },
      { label: "Resistor dissipation — the check", href: "/docs/checks/thermal-resistor-dissipation" },
    ],
  },
  {
    slug: "inrush-current", term: "Inrush current",
    def: "The surge a circuit draws at the instant of connection, before steady state — discharged capacitors look like shorts, cold filament/motor resistance is low, transformers can saturate. Often 10–100× the running current, gone in milliseconds.",
    practice: "USB is the textbook case: the spec allows ~10 µF of hard-attached capacitance because plug-in inrush from more can droop the host port and corrupt enumeration. Fixes are soft-start switches, NTC inrush limiters, or staging the capacitance behind a regulator.",
    links: [
      { label: "USB inrush — the check", href: "/docs/checks/current-usb-inrush" },
      { label: "USB-C power input — the circuit", href: "/blocks/usb-c-power" },
    ],
  },
  {
    slug: "brown-out", term: "Brown-out",
    def: "A supply that sags below what a circuit needs without going to zero — the half-alive state where logic misbehaves, resets loop, and memory corrupts. Named for the way incandescent lights dim brown during one.",
    practice: "Designs that only work at nominal voltage brown out at the bottom of the range: cold batteries, long cables, shared supplies under load. Microcontrollers have brown-out detectors for a reason — enable them, and check the worst-case rail math before the field does.",
    links: [
      { label: "Brown-out risk — the check", href: "/docs/checks/voltage-under-input" },
      { label: "Rail over budget — the sibling check", href: "/docs/checks/current-over-budget" },
    ],
  },
  {
    slug: "body-diode", term: "Body diode",
    def: "The parasitic diode inside every MOSFET, from source to drain (in an N-channel), formed by the transistor's own structure. It conducts whether you want it to or not — many circuits quietly depend on it; others are quietly broken by it.",
    practice: "Reverse-polarity protection exploits it: at first contact, current flows through the body diode, then the channel turns on and shorts it out for near-zero loss. In bridges it freewheels during dead time. Its slowness (reverse recovery) is also why fast converters pair FETs with real diodes.",
    links: [
      { label: "Reverse-polarity protection — the body diode at work", href: "/blocks/reverse-polarity-protection" },
      { label: "MOSFET switch — the circuit", href: "/blocks/mosfet-switch" },
    ],
  },
  {
    slug: "sallen-key", term: "Sallen-Key topology",
    def: "The standard way to build a second-order active filter around one op-amp, two resistors, and two capacitors. Higher-order filters are cascades of these biquad sections — an 8th-order filter is four Sallen-Keys in a row.",
    practice: "The unity-gain version realizes the stage's Q through a component ratio (C1/C2 = 4Q² for low-pass), which is why sharp filters demand awkward part spreads. Build lowest-Q stage first in the cascade to keep internal nodes from clipping.",
    links: [
      { label: "Active filter designer — cascaded Sallen-Key stages", href: "/calculators/filter-designer" },
      { label: "Q factor", href: "/glossary/q-factor" },
    ],
  },
  {
    slug: "ntc-thermistor", term: "NTC thermistor",
    def: "A resistor whose resistance falls steeply as temperature rises (Negative Temperature Coefficient) — typically halving every ~20 °C. Paired with a fixed resistor in a divider, it turns temperature into a voltage.",
    practice: "The β equation converts resistance to temperature; the divider's fixed resistor should equal the NTC's resistance at your most-important temperature for best sensitivity there. Big power NTCs do double duty as inrush limiters.",
    links: [
      { label: "NTC thermistor calculator", href: "/calculators/ntc-thermistor" },
      { label: "NTC thermistor — the sensing circuit", href: "/blocks/ntc-thermistor" },
    ],
  },
];

export const GLOSSARY_BY_SLUG: Record<string, GlossaryTerm> = Object.fromEntries(GLOSSARY.map((t) => [t.slug, t]));
