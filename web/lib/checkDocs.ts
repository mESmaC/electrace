// Documentation for every check rule the engine can fire — one indexable page per rule
// (/docs/checks/<slug>), linked from the finding cards in the editor. Copy rules: explain the
// physics and the fix, never the engine internals; example messages are REAL templates from
// lint.ts (keep in sync when a rule's wording changes).

export type CheckSeverity = "error" | "warn" | "info" | "recommendation" | "unknown";

export interface CheckDoc {
  slug: string;          // rule id with "/" → "-"
  rule: string;          // engine rule id, e.g. "voltage/over-input"
  name: string;
  severity: CheckSeverity;       // the worst level this rule fires at
  category: "voltage" | "current" | "connectivity" | "thermal" | "polarity" | "completeness" | "debug";
  example: string;       // a representative fired message
  what: string;          // what the check examines
  why: string;           // the physical consequence of ignoring it
  fix: string;           // how to resolve it
  intended?: string;     // when firing is fine, and how to acknowledge
}

export const CHECK_DOCS: CheckDoc[] = [
  // ── voltage ──────────────────────────────────────────────────────────────
  {
    slug: "voltage-over-input", rule: "voltage/over-input", name: "Over-voltage at an input",
    severity: "error", category: "voltage",
    example: "VBUS can reach 12 V but U3.vin accepts max 5.5 V.",
    what: "Every input pin declares the voltage range it tolerates. This check follows each net to its worst-case voltage — including ranges like a 9–18 V wall supply — and compares it against every pin the net touches.",
    why: "Over-voltage is the classic instant kill. Exceed a pin's absolute maximum and the input protection clamps, overheats, and fails — sometimes immediately, sometimes weeks later in the field. The worst case matters because supplies sit at the top of their range exactly when you least expect it.",
    fix: "Put a regulator between the source and the pin, pick a part rated for the full source range, or — if the source genuinely never reaches the flagged voltage — declare its real range so the check works with the truth.",
  },
  {
    slug: "voltage-under-input", rule: "voltage/under-input", name: "Brown-out risk at an input",
    severity: "warn", category: "voltage",
    example: "VIN can sag to 9 V but U2.vin needs at least 10 V — fine at nominal, brown-out at the bottom of the range.",
    what: "The mirror of over-voltage: each net's worst-case LOW voltage against each pin's declared minimum. A supply declared 9–18 V is checked at 9, not at its nominal.",
    why: "Designs that only work at nominal voltage fail in the field at the bottom of the range — cold batteries, long cables, brownouts. The symptom is the worst kind: intermittent resets that never reproduce on the bench.",
    fix: "Raise the source's minimum (different supply, shorter cable run, bigger battery), lower the part's requirement (an LDO with less dropout), or add headroom with a boost stage.",
  },
  {
    slug: "voltage-cap-rating", rule: "voltage/cap-rating", name: "Capacitor voltage rating",
    severity: "error", category: "voltage",
    example: "C3 sees 24 V at the operating point — it's rated 16 V. Electrolytics vent; ceramics crack.",
    what: "The DC solver computes the real voltage across every capacitor with a declared rating, then compares. An error past the rating, a warning past 80% of it.",
    why: "Electrolytics vent or burst over their rating; ceramics crack or short. And a ceramic near its rating quietly loses much of its capacitance long before it fails — your 10 µF may be acting like 3.",
    fix: "Use a higher-rated part — the standard rule of thumb is to keep 20% headroom (a 25 V cap on a 12 V rail, 50 V on 24 V). The fix costs cents at design time and a recall after.",
  },
  {
    slug: "voltage-diode-piv", rule: "voltage/diode-piv", name: "Diode reverse voltage (PIV)",
    severity: "error", category: "voltage",
    example: "D2 blocks 18 V in reverse — its rated reverse voltage is 10 V. It will avalanche.",
    what: "When the solver finds a diode OFF, it knows the exact reverse voltage across it — and checks it against the part's declared peak-inverse-voltage rating. Error past the rating, warning past 80%.",
    why: "A diode past its PIV avalanches: it conducts in reverse, usually destructively for a rectifier. The 'blocking' diode protecting your battery becomes a wire at exactly the moment it mattered.",
    fix: "Pick a diode rated comfortably above the worst-case reverse voltage it must block — PIV is cheap; 1N4007 blocks 1000 V and costs the same as the 50 V part.",
  },
  // ── current ──────────────────────────────────────────────────────────────
  {
    slug: "current-over-budget", rule: "current/over-budget", name: "Rail over budget",
    severity: "error", category: "current",
    example: "+5V needs 2.4 A but its source provides 2 A.",
    what: "Sums every declared load on a power rail and compares the total against the source's declared current capability. A warning fires when the rail works but has little spare.",
    why: "An overloaded source sags, overheats, or current-limits — and the symptom shows up in whatever load happens to be marginal, not at the source that caused it. Headroom matters too: a rail at 98% has no room for the load you'll add next month, or for inrush.",
    fix: "Use a bigger source, shed loads to another rail, or correct the declarations if a load's number is worst-case pessimism.",
  },
  {
    slug: "current-connector-pin", rule: "current/connector-pin", name: "Connector contact rating",
    severity: "error", category: "current",
    example: "J1 pin VBUS carries up to 3 A but one contact is rated 1.5 A.",
    what: "Current entering or leaving the board through a connector pin, checked against that pin's declared contact rating. Errors past the rating, warns when it runs close.",
    why: "Connector contacts are usually the weakest current path in the whole design — a contact run past its rating heats, oxidizes, raises resistance, and heats more. Melted connector housings are one of the most common real-world hardware failures.",
    fix: "Spread the current across multiple pins (the standard trick — it's why power connectors gang pins), pick a heavier connector series, or reduce what flows through the board edge.",
  },
  {
    slug: "current-signal-over-source", rule: "current/signal-over-source", name: "Signal pin overloaded",
    severity: "error", category: "current",
    example: "U2.out is rated 0.02 A but its loads draw 0.05 A.",
    what: "A signal output's declared drive capability against the sum of what's hanging off it.",
    why: "A logic pin asked for more current than it can source doesn't stop — it sags. The LED is dim, the next gate sees an ambiguous level, and the chip runs its driver at the edge of its spec for its whole life.",
    fix: "Buffer it: a transistor or gate driver between the signal and the load. Logic pins signal intent; transistors do work.",
  },
  {
    slug: "current-usb-inrush", rule: "current/usb-inrush", name: "USB inrush (bulk capacitance)",
    severity: "warn", category: "current",
    example: "VBUS hangs ~33 µF of hard-attached bulk capacitance off a USB port — the spec allows about 10 µF before plug-in inrush can brown-out the port.",
    what: "Adds up the bulk capacitance hard-attached to a USB-fed rail (no soft-start or current limiter between the port and the caps) and compares it with the USB specification's 10 µF inrush limit.",
    why: "At plug-in, discharged capacitors look like a short. Past ~10 µF the inrush spike can droop the host port, corrupt enumeration, or trip polyfuses — a design that 'mostly works' depending on which laptop you plug it into.",
    fix: "Add a soft-start (load switch with controlled rise, or a simple P-FET RC slew), put the bulk capacitance behind a regulator, or reduce it to spec.",
  },
  {
    slug: "current-diode-leakage", rule: "current/diode-leakage", name: "Diode reverse leakage",
    severity: "info", category: "current",
    example: "D1 is blocking, but its declared leakage lets ~0.6 µA flow backwards anyway — on a battery, that's a slow drain that never sleeps.",
    what: "When a diode with declared leakage (the datasheet's I_R at V_R) blocks, the solver models that leakage as the real resistance it is and reports the actual backwards current at the solved operating point.",
    why: "An OFF diode isn't a wall — it leaks, and on battery products the leak runs 24/7. A few microamps of 'blocking' diode can out-drain the microcontroller it protects.",
    fix: "If the number matters, pick a lower-leakage part (leakage varies by orders of magnitude between diode families) or restructure so the reverse path doesn't sit across the battery. If it doesn't matter, you now know that for a fact instead of hoping.",
  },
  {
    slug: "current-under-utilized", rule: "current/under-utilized", name: "Over-sized source",
    severity: "recommendation", category: "current",
    example: "+5V's source is rated 3 A but only ~0.06 A is used — a smaller, cheaper part would do.",
    what: "Flags a rail whose source rating is far above (less than 40% utilized) its actual declared draw.",
    why: "Not a fault — a cost and size note. Oversized regulators, inductors, and connectors cost more and take board space; some switchers also run less efficiently at a small fraction of rated load.",
    fix: "If the headroom is deliberate (future loads, inrush, derating policy), ignore it. Otherwise, downsize the source one notch.",
    intended: "Deliberate derating is good engineering — this is a recommendation precisely because the check can't know your roadmap.",
  },
  // ── connectivity ─────────────────────────────────────────────────────────
  {
    slug: "connectivity-open-net", rule: "connectivity/open-net", name: "Open net",
    severity: "warn", category: "connectivity",
    example: "U2.vin (power) isn't wired to anything yet.",
    what: "A terminal that connects to nothing — a power pin with no rail, an output driving nobody.",
    why: "Sometimes it's just unfinished work. But an unwired power pin means a block silently does nothing, and a floating input picks up whatever the nearest electric field suggests — the classic source of 'it randomly toggles'.",
    fix: "Wire it, or remove the block if it isn't meant to be there yet. For deliberately-unused pins, leaving them open is often fine — the warning is the design's to-do list.",
  },
  {
    slug: "connectivity-undriven-rail", rule: "connectivity/undriven-rail", name: "Undriven rail",
    severity: "warn", category: "connectivity",
    example: "+3V3 powers 4 loads but nothing drives it — connect a source, or mark it off-board.",
    what: "A net with loads attached but no declared source anywhere on it.",
    why: "Four chips waiting on a rail nobody generates is a design that ships dead. The common real cause: the rail is supposed to arrive from off-board, but the connector pin was never declared, so the engine — like the bench — sees nothing.",
    fix: "Add the regulator or supply that makes the rail, or declare the connector pin where it enters the board (voltage and current), which both fixes the finding and lets every other check see the real source.",
  },
  {
    slug: "connectivity-multiple-drivers", rule: "connectivity/multiple-drivers", name: "Multiple drivers",
    severity: "warn", category: "connectivity",
    example: "STATUS has 2 drivers (U1.out, U4.out) — fine if they're diode-OR'd or open-drain, otherwise two outputs are fighting.",
    what: "More than one output terminal driving the same net.",
    why: "Two push-pull outputs on one wire fight: whichever loses sources current into the other, both heat, and the level is whatever the strongest driver says. Legitimate exceptions exist — open-drain buses and diode-OR'd supplies are designed for exactly this.",
    fix: "If it's a real conflict, gate one driver or mux them. If it's open-drain or diode-OR'd by design, acknowledge the finding with a note — that keeps the checker honest without nagging you.",
    intended: "I²C, alert lines, and diode-OR'd power are the textbook intended cases — mark them intended once and the note travels with the design.",
  },
  {
    slug: "connectivity-short-circuit", rule: "connectivity/short-circuit", name: "Short to ground",
    severity: "error", category: "connectivity",
    example: "U1.vout is wired straight to ground — that's a short, not a circuit.",
    what: "A driven terminal (power or signal output) wired directly to a ground-typed terminal with nothing between them.",
    why: "The source dumps its full capability into the wire until something gives — the regulator's thermal limit, a trace, or the part itself. There is no load that benefits.",
    fix: "Almost always a mis-wire: the intended target sits one pin over, or a label confused two nets. Follow the named net in the message to the exact wire.",
  },
  {
    slug: "connectivity-internal-short", rule: "connectivity/internal-short", name: "Block-internal short",
    severity: "error", category: "connectivity",
    example: "U7 (USB-C 5V Input) internally ties vbus (5.25 V) and vout (5 V) to the same net — the block's own terminals are shorted, so its rails collapse together across the design.",
    what: "A single block whose own internal schematic ties two terminals with conflicting declarations (different voltages, or hot-to-ground) onto one net — collapsing them everywhere it's placed.",
    why: "A block that shorts its own terminals poisons every design that uses it: nets that should be distinct merge, and a cascade of phantom findings appears on wiring that's actually correct. The engine suppresses the derivative noise and points at the cause.",
    fix: "This one is fixed inside the block, not in your wiring — open the block's internal schematic and separate the terminals (or correct their declared voltages so a deliberate passthrough declares the same range on both sides).",
  },
  {
    slug: "connectivity-dangling-wire", rule: "connectivity/dangling-wire", name: "Dangling wire",
    severity: "error", category: "connectivity",
    example: "Wire U3.en ↔ U9.out references a missing endpoint: U9.out. Reconnect it or remove the wire.",
    what: "A wire whose endpoint no longer exists — usually because a block was re-authored and a terminal renamed or removed.",
    why: "The connection you think you have isn't there. Analysis continues without it (one stale wire shouldn't kill the whole net graph), but the circuit on screen and the circuit being checked have quietly diverged.",
    fix: "Delete the stale wire and reconnect to the terminal's new name. The message names the missing endpoint precisely so you don't have to hunt.",
  },
  {
    slug: "isolation-bridged", rule: "isolation/bridged", name: "Isolation bridged",
    severity: "error", category: "connectivity",
    example: "PSU1 and SENSE1 are declared galvanically isolated, but they're conductively bridged: PSU1.gnd → GND → SENSE1.gnd.",
    what: "You declare that two blocks must share no conductive path; the check walks the full conduction graph — nets plus every block's internal paths — and names the exact bridge if one exists.",
    why: "Isolation is a safety and integrity boundary: mains from touchable circuits, a noisy motor domain from a precision sensor. One shared ground pin — the most common accident — silently removes the entire barrier while the optocoupler sits there looking reassuring.",
    fix: "Break the named path. Usually it's a shared ground or a debug connector that spans both domains; the message lists the hop-by-hop route so you can see exactly which wire to cut.",
  },
  {
    slug: "si-termination-missing", rule: "si/termination-missing", name: "Bus termination missing",
    severity: "warn", category: "connectivity",
    example: "RS-485 declared on A/B, but no ~120 Ω termination bridges the pair. An unterminated bus reflects every edge — works on 10 cm of bench wire, garbles data on a real run.",
    what: "For nets declared as a terminated bus class (RS-485 and friends), verifies a termination resistor of roughly the right value actually bridges the pair.",
    why: "A transmission line without its characteristic termination reflects every edge back down the cable. The cruel part is that it works on the bench — short wires, slow edges — and fails at installation length.",
    fix: "Add the termination resistor (typically 120 Ω for RS-485) at the far end of the bus. If the design intentionally relies on a receiver's built-in termination, declare that part where the check can see it.",
  },
  {
    slug: "si-i2c-rise-time", rule: "si/i2c-rise-time", name: "I²C rise time",
    severity: "warn", category: "connectivity",
    example: "SDA as I²C Fast-mode: 10k pull-ups into ~150 pF rise in ~1500 ns — over the 300 ns limit. Drop the pull-ups to ≤1.2k or shorten the bus.",
    what: "For nets declared as an I²C class, computes the RC rise time from the actual pull-up values and estimated bus capacitance against the mode's specified limit — and tells you the pull-up value that would pass.",
    why: "I²C edges are made by the pull-ups alone. Too-weak pull-ups into too much capacitance means edges that never reach threshold in time: a bus that drops bits as you add devices or wire length, which everyone first blames on firmware.",
    fix: "Lower the pull-up value (the message computes the target), shorten the bus, or drop to a slower I²C mode. One pair of pull-ups per bus — every added device brought its own, and that's a different bug.",
  },
  // ── thermal ──────────────────────────────────────────────────────────────
  {
    slug: "thermal-resistor-dissipation", rule: "thermal/resistor-dissipation", name: "Resistor dissipation",
    severity: "error", category: "thermal",
    example: "R4 dissipates 2.21 W — its package is rated 0.1 W. It will burn.",
    what: "The DC solver knows the real current through every resistor, therefore the real power. Checked against the declared rating, or the footprint's typical rating (an 0603 is a 0.1 W part), or flagged past a generic ¼ W when neither is known.",
    why: "A resistor at 10× its rating doesn't drift — it discolors, smokes, and opens. At 70–100% it quietly cooks itself and its neighbors and drifts out of tolerance. P = I²R has no mercy and no warning period.",
    fix: "Bigger package (0805 → 1206 → through-hole), a properly rated power resistor, or revisit why that much current crosses that resistance in the first place — high dissipation in a resistor is often a topology smell.",
  },
  {
    slug: "thermal-regulator-dissipation", rule: "thermal/regulator-dissipation", name: "Linear regulator dissipation",
    severity: "error", category: "thermal",
    example: "REG2 dissipates ~2.4 W at the connected load (dropping 12→3.3 V at 280 mA — that needs a heatsink or a switcher, not hope).",
    what: "For a linear regulator, heat is (Vin − Vout) × Iout — computed from the actual connected input rail and actual load, not the datasheet's worst case.",
    why: "Linear regulators turn every dropped volt into heat at full load current. A TO-220 with no heatsink handles a watt or two; an SOT-23 far less. Past that it hits thermal shutdown and your rail cycles on and off — which looks exactly like a software bug.",
    fix: "Switch to a buck converter for big drops (it converts instead of burning), reduce the input-output differential (pre-regulate), or add real copper/heatsink area sized for the computed watts.",
  },
  {
    slug: "thermal-low-efficiency", rule: "thermal/low-efficiency", name: "Linear regulator efficiency",
    severity: "recommendation", category: "thermal",
    example: "REG1 (LDO Regulator) burns ~2.5 W as heat dropping 12→3.3 V at 0.3 A. A switching regulator would run far cooler.",
    what: "A design-level cousin of the dissipation check: flags a linear regulator whose drop × load makes it an inefficient heater, using the circuit's actual rails and draws where resolvable.",
    why: "Past a watt of waste heat, the linear-vs-switcher decision deserves a deliberate yes. Sometimes linear is right anyway — noise-critical analog rails love LDOs — but it should be a choice, not an accident.",
    fix: "A buck converter for the big drop, optionally followed by an LDO for the quiet final volt — the standard 'switcher does the work, LDO does the polish' pattern.",
    intended: "If the heat budget is fine and the LDO is there for noise, that's a legitimate call — recommendations don't block anything.",
  },
  // ── polarity ─────────────────────────────────────────────────────────────
  {
    slug: "polarity-conflict", rule: "polarity/conflict", name: "Polarity conflict",
    severity: "error", category: "polarity",
    example: "VBAT mixes + and − polarity terminals.",
    what: "A net joining terminals of opposite declared polarity, or tying a polarized terminal straight to ground.",
    why: "Reverse polarity is the most expensive easy mistake in electronics: polarized capacitors vent, protection diodes conduct hard, and chips die in the first second of the first power-up.",
    fix: "Almost always a swapped pair of wires at a battery, barrel jack, or motor connection — the named net points at the junction. And consider adding reverse-polarity protection at the power entry; one P-FET protects against the same mistake made with a real cable later.",
  },
  // ── completeness & engine honesty ────────────────────────────────────────
  {
    slug: "assert-failed", rule: "assert/failed", name: "Block self-test failed",
    severity: "error", category: "voltage",
    example: "Buck converter's own spec says the node at R2.1 should sit at 1.02 V — it solves to 0.4 V. Something in this block's values or wiring no longer does what the block claims.",
    what: "Blocks can carry assertions — 'this node sits at this voltage when I'm working'. The DC solver computes the actual value and compares. A failed assert means the block no longer does what it claims.",
    why: "It's a built-in self-test for edited circuits: change a feedback resistor inside a regulator block and the output moves, but every label still says the old voltage. The assert catches the lie at the exact node.",
    fix: "Either restore the internals that made the claim true, or — if the change is deliberate (you re-tuned the output) — update the block's asserted value so the claim matches the new truth.",
  },
  {
    slug: "assert-unverified", rule: "assert/unverified", name: "Block self-test unverified",
    severity: "info", category: "completeness",
    example: "Buck converter asserts the node at R2.1 ≈ 1.02 V, but it wasn't solvable here (nonlinear path or no source) — the claim is unverified, not wrong.",
    what: "An assertion the solver couldn't evaluate — typically because the node sits behind an unmodeled part or the block isn't powered in this design.",
    why: "Honesty about scope: 'unverified' and 'passing' are different things, and a checker that silently skips what it can't see teaches you to trust green lights it didn't earn.",
    fix: "Usually nothing — power the block or wire its source and the assert verifies on the next pass. It's information, not a defect.",
  },
  {
    slug: "declaration-missing-value", rule: "declaration/missing-value", name: "Missing component value",
    severity: "unknown", category: "completeness",
    example: "R3 has no usable resistance value — the DC solver left it open, so voltages around it are not computed.",
    what: "A component whose value can't be parsed into a number the solver can use. The part is honestly left out of the math rather than guessed.",
    why: "A solver that guesses missing values produces confident, wrong numbers. Marking the gap 'unknown' keeps every number you DO see trustworthy — the voltages around the gap are simply not claimed.",
    fix: "Give the part its value. The moment it parses, the surrounding nodes start solving.",
  },
  {
    slug: "completeness-empty-block", rule: "completeness/empty-block", name: "Empty block (interface shell)",
    severity: "info", category: "completeness",
    example: "U5 (Sensor frontend) has no components yet — it's an interface shell, so it won't appear in the BOM. Populate it with the real part(s).",
    what: "A block with declared terminals but no internal components — a typed placeholder.",
    why: "Shells are useful for sketching architecture, but they're invisible to the BOM and to internal analysis. A design full of shells looks finished and isn't — this keeps the difference visible.",
    fix: "Populate the block with its real parts when you choose them (or ask Sparky to author it from a part number). Until then the finding is just an honest progress marker.",
  },
  {
    slug: "completeness-connector-full", rule: "completeness/connector-full", name: "Connector full",
    severity: "recommendation", category: "completeness",
    example: "J2 (JST-XH 6) is full — all 6 pins wired, no spare. If a signal is left unconnected elsewhere, you've likely run out of pins here; size up the connector.",
    what: "Every pin of a connector is wired — zero spares.",
    why: "A full connector at design time means no room for the signal you forgot, the ground you'll want for signal integrity, or the test line that would have saved a board spin.",
    fix: "Size up one position if the change is cheap now. If the pinout is fixed by a mating cable, that's a fine reason to ignore this.",
    intended: "Mating an existing cable or standard pinout? Full is correct — this is a recommendation for exactly that reason.",
  },
  // ── debug ────────────────────────────────────────────────────────────────
  {
    slug: "debug-test-points", rule: "debug/test-points", name: "Test points on the power entry",
    severity: "recommendation", category: "debug",
    example: "This looks like your main power-entry rail. Add a test point on both VIN and ground — if the board ever won't power up, the fastest first thing to rule out is whether it's getting ample power.",
    what: "Suggests test points on the main power-entry rail and its ground when none are present.",
    why: "The first question for every dead board is 'is power even arriving?' — and answering it through a connector shell with two probe tips is how boards get scratched. Two test points cost nothing and answer it in five seconds.",
    fix: "Drop a test point on the entry rail and one on ground near it. Future-you, mid-debug, says thanks.",
  },
];

export const CHECK_DOC_BY_RULE: Record<string, CheckDoc> = Object.fromEntries(CHECK_DOCS.map((d) => [d.rule, d]));
export const CHECK_DOC_BY_SLUG: Record<string, CheckDoc> = Object.fromEntries(CHECK_DOCS.map((d) => [d.slug, d]));
