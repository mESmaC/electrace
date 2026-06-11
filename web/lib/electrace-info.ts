// Single source of truth for "what Electrace is / what's new" — rendered on the public /help page AND
// fed to the assistant (Sparky) via the electrace_help tool, so it can help users with the app itself,
// not just their design. Keep this current as features ship.

export interface ChangeEntry { date: string; title?: string; items: string[] }

/** Reverse-chronological, ONE entry per day — every functionality change that day, grouped by area.
 *  `date` is the ISO day (or "Foundations" for the original core). Keep current as features ship. */
export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-06-11",
    items: [
      "**Blocks that prove themselves:** a block can now declare its own expected operating points (\"the feedback node sits at 1.02 V\") and the solver verifies the claim on every single change — change a divider resistor and the block itself reports its spec broken, with the arithmetic. The buck converter ships with its first assert. Also new: terminal aliases (wiring REG1.gnd just works even when the block's terminal is gnd_in), declared part ratings (a 10 V cap on a 12 V node is now an error computed from the REAL solved voltage, not a guess), the net panel shows the solved voltage on every net, and Sparky gained a solve_dc tool — ask it what voltage is actually at a node and it answers from the matrix, not the vibes.",
      "**A fab-grade bug found by the solver:** two different nets that happened to derive the same name (two blocks both calling their output VOUT) would have been fused on KiCad netlist import — physically shorting them on your board. Flat net names are now always unique. The solver caught it because the same fusion made its matrix singular; honest math finds dishonest data.",
      "**The engine solves now.** Stage 1 of the analysis ladder is live: a DC operating-point solver (Modified Nodal Analysis — the node-voltage method from your circuits course, as code) runs over the flattened design on every change. What that buys today: every resistor's REAL current and dissipation — a 0603 quietly burning 1.4 W is now an error naming the part, with the arithmetic shown. The solver is honest to the bone: semiconductors and ICs are left open and it says so (bias networks around them solve correctly), a resistor with no value gets a 'can't solve this' finding instead of silence, and anything it can't compute is reported, never guessed. Closed-form linear algebra — still no simulation.",
      "**Five more calculators — the circuits-course toolkit:** current divider (the voltage divider's mirror image), delta ↔ wye conversion (the bridge-circuit unlock), LC resonance & reactance (with series/parallel L and C math), AC power & power factor (real/reactive/apparent, single and three phase, plus correction-capacitor sizing), and the AC induction motor (synchronous speed, slip, rotor frequency, shaft torque, efficiency). Ohm's law also gained a Joule's-law section — energy over time at the computed power. Fifteen calculators total.",
      "**Motor winding & Kv calculator:** Kv to torque (they're the same constant — Kt = 9.549/Kv), rewind turns scaling, wye/delta conversion, cogging-step arithmetic, and winding-wire math (AWG, parallel strands, phase resistance with the I²R loss at your current). Honest about its limits: it does the exact arithmetic around a winding, and tells you to consult a winding table for the layout itself.",
      "**Inrush checking, the deterministic way:** hang too much hard-attached bulk capacitance off a USB port and the checker now tells you — at plug-in, every bulk cap is a momentary near-short, and the USB spec allows only ~10 µF before inrush can brown-out or trip the host. The finding sums the actual caps inside your blocks, names each contributor, and suggests the fix (a soft-start / load switch). No simulation — declared-value arithmetic, like every other check.",
    ],
  },
  {
    date: "2026-06-10",
    items: [
      "**Connector pins now mean something:** double-click any placed connector (or right-click → **Pin specs…**) and declare what the outside world presents — or draws — at each pin: a name (`VBAT`, `SDA`), a net type, a direction, and voltage/current. A declared pin becomes a **real terminal at the board edge**, so every existing check works across it: a 12 V supply arriving on a header pin gets caught against a 5.5 V-max input, off-board loads count in the power budget, a hot wire into a ground pin flags as a short, and the net inherits the pin's name (`VBUS`) everywhere it's mentioned.",
      "**Connectors that know their own pinout, out of the box:** USB receptacles (C/A/Mini/Micro), the LiPo JST-PH, barrel jacks, and audio jacks ship with their inherent meanings built in — drop a USB-C and the engine already knows VBUS is 5 V power in at up to 3 A and GND is ground, zero clicks. Built-ins show greyed in the pin editor and any field can be overridden per instance.",
      "**Contact ratings, enforced:** every connector in the catalog now carries its family's per-contact current rating (JST-PH 2 A, 0.1\" headers 3 A, screw terminals 10 A, USB-A 1.5 A…), and a new check compares the current actually flowing through each declared pin against it — pushing 4 A of load through a 2 A LiPo contact is an error that names the pin, with a warning band as you approach the limit.",
      "**Connector cards show the declarations:** pin rows on the canvas display the declared name color-coded by net type, plus the declared volts/amps — so a glance at the board edge tells you what comes in and goes out.",
      "**The feature lists caught up with the engine:** the pricing page now spells out what the checking engine actually catches — voltage propagation, budgets, isolation, signal integrity, connector ratings, wiring sanity — and that all of it is free. The in-app help and Sparky's reference got the same update.",
      "**Sparky's toolbox caught up too:** it can now declare connector pins (and does so proactively at power entry), set galvanic-isolation requirements (verified the moment it declares them), assign signal-integrity classes to nets, and run the what-if stress test — so asking it \"can I run this from a 24 V brick?\" gets arithmetic, not vibes.",
      "**Signal integrity and galvanic isolation are now Pro analyses.** The core checking engine — voltage propagation, current budgets, shorts, polarity, connector ratings, the stress test — stays free forever; the professional-grade declarations (SI classes, isolation guarantees) join Sparky and manufacturing export in Pro. The menu items remain visible to everyone, with a clear explanation of what they do.",
      "**Manufacturing export now actually requires Pro** (it was always meant to): the BOM CSV download and the routed-board .kicad_pcb export check your plan. Viewing the BOM, the Digi-Key cart, PCB editing/routing/DRC, the design JSON, and the KiCad netlist all stay free — your design is never locked in.",
      "**Try Electrace without an account.** The editor is no longer login-walled — open it cold and everything works: blocks, wiring, the full checking engine, the PCB editor. Your work saves to that browser, a banner says exactly that, and creating a free account imports it automatically. \"Free, no card\" now means what it says, from the very first click.",
      "**Every reducible IC in the library now breaks into discrete:** two new teardowns complete the set — the **op-amp** (the comparator's long-tailed pair grown up: a current-mirror load, a compensated gain stage, and a class-AB output — the 30 pF Miller cap is the entire difference between an op-amp and a comparator) and the **Li-ion charger** (a pass transistor with two referees: a 0.6 V sense resistor capping the current, and a zener + transistor tapering it at exactly 4.2 V). Ten ICs now open up; the other sixteen library blocks were already fully discrete.",
    ],
  },
  {
    date: "2026-06-09",
    items: [
      "**Net labels:** a block's internal schematic now has **net labels / power flags** (in the Power palette) — drop one on a pin and name it (`+5V`, `+3V3`, `GND`…), and **every label, port, or power symbol with that same name is the same net, with no wire between them**. So a row of bypass caps can fan out to a rail without a single wire crossing the whole row, and multiple ground symbols collapse to one ground — the way a real schematic tool works. Crucially, **differently-named labels stay separate even when drawn collinear**, so two rails laid out as one visual row don't short together.",
      "**Clearer short detection:** when a block's own internal wiring ties two incompatible terminals together (say a 5 V rail to a 3.3 V rail, or a rail to ground), the checker now flags the **block that's internally shorted** and names the two terminals — instead of blaming your top-level wiring — and it suppresses the cascade of phantom over-voltage / dueling-driver warnings that the one short was causing.",
      "**Findings highlight where they are:** a block with a live issue now **lights up in its severity color** — a red ring + glow for an error, amber for a warning — right on the canvas, and **clicking a finding jumps to that block** and highlights it. Inside a block, locating a problem pulses the affected part or wire in the same red/amber so you can see *exactly* what it's pointing at instead of hunting for it.",
      "**Smoother dragging:** moving blocks around the canvas no longer re-runs the full design analysis on every pixel — checks now re-run only when the circuit itself changes, so big designs drag noticeably smoother.",
      "**No lost last edits:** your work is now saved immediately when you close the tab or leave the editor — previously the very last moments of editing could miss the autosave window.",
      "**Import feedback:** importing a file that isn't a valid design now tells you so, instead of silently doing nothing.",
      "**Undo correctness:** undoing past a block edit no longer brings back the block's old terminal layout.",
      "**Junction taps stay connected:** a wire tapped onto another wire is now **bound to it** — drag the host wire's parts around or hit **Align** and the junction rides along, keeping the connection. Deleting the host wire leaves the tapped wire visibly floating instead of silently broken.",
      "**Block cards tell you more at a glance:** every block on the canvas now shows its **declared-spec line** (e.g. `9–18 V → 5 V · 3 A`), a live **status chip** (green ● OK · amber ▲ warnings · red ⬣ errors, with counts) fed by the same checks as the Problems panel, and an **IC / DISC tag** so you can see which blocks are chip-based and which are fully discrete without opening them.",
      "**Find blocks by spec, not name:** the palette has a **spec-search box** — type the need (`18V → 5V at 3A`, `12 to 3.3v 500ma`, or just `buck`) and it filters to blocks whose **declared specs** actually satisfy it. Matching is on authored numbers only — a block missing a declaration can't sneak in, and every match can explain exactly why it fits. Sparky got the same power: ask it to \"drop 18 V to 5 V at 3 A\" and it searches by spec instead of guessing.",
      "**Designs live in your account:** signed-in designs now save to **real cloud storage** — your projects (schematic *and* board layout) follow you across devices, work you made before signing up is **imported automatically** on your next visit, and your browser stays a fast offline cache. Private designs are enforced down at the database layer, not just in the UI.",
      "**Forgot your password?** The login page's *Forgot?* link now works — request a reset email and choose a new password.",
      "**Parts-basics overhaul, round one:** twenty part types that quietly fell back to a generic chip footprint on the PCB (thermistors, fuses, tact switches, buzzers, triacs, JFETs, photo-devices, test points…) now land physically correct patterns — and the connector catalog gains the hobbyist staples: **JST-PH** (the LiPo standard), **JST-XH** in 2/3/4-pin, and a 3.5 mm audio jack, all with true-pitch land patterns.",
      "**Signal integrity, declared and enforced:** right-click any wire → **Signal class…** and say what the net IS — RS-485, CAN, I2C at 100/400 kHz, a USB pair, or just a fast edge. The checker then enforces what that class physically requires: a **missing 120 Ω termination** on a declared bus gets caught (it scans for the actual resistor bridging the pair), **I2C rise time** is computed from your pull-ups and bus size with the fix in the message ('drop the pull-ups to ≤8.8k'), and on the PCB, **electrically-long traces** and **mismatched pair lengths** show up in DRC with the limits derived from the class's edge rate.",
      "**Galvanic isolation, as a standing guarantee:** right-click any block → **Isolation…** → choose which blocks it must share NO conductive path with (or 'all others'). The checker re-verifies on every single change, honouring true barriers (an optocoupler's two sides only exchange light) — and the moment anything bridges the gap, usually a carelessly shared ground, the finding names the exact net that did it. Declare it once; never accidentally break it again.",
      "**Four new checks, built on the propagation engine:** a signal output driving more load than it's rated for (the classic 'three LEDs on one GPIO'), a power source wired straight to ground (a short, not a circuit), **brown-out detection** (a rail that can sag below an input's declared minimum — works at nominal, dies at the bottom of the range), and **real regulator dissipation** — the LDO-as-space-heater catch, computed from what's actually connected, with a needs-a-heatsink error tier.",
      "**The checker got fundamentally smarter — DC propagation:** voltages now flow THROUGH chips (a 555 powered from 18 V swings its output at 18 V — and the checker now catches that hitting a 5.5 V-max input downstream), and current draw flows back UP (a rail now sees the chip plus everything the chip drives, so the power budget reads true). The stress test uses it too: 'holds at 24 V' is now impossible to see when a 15 V-max part sits on the input rail — it names the first part to die. And the checks panel can no longer stay pinned to a deleted block.",
      "**Four more calculators** — **parallel resistors** (any number, plus 'what do I parallel with what's in my drawer?'), **555 timer astable** (frequency, duty, HIGH/LOW times — with the why-never-50% answer), **RC filter cutoff** (and what −3 dB actually means), and **Ohm's law + power** (the wattage number that decides whether your resistor survives). Nine calculators total at /calculators.",
      "**New block: Optocoupler Input** — isolate a 24 V industrial signal from your microcontroller with nothing but light crossing the barrier. Covers CTR aging (design for end-of-life, not the datasheet's sunny day), why these are slow, the inverted-output gotcha, and the reverse-protection diode field wiring will eventually need. And open the chip: the simplest teardown in the library — an LED staring at a phototransistor across a deliberate gap.",
      "**Sparky remembers long projects without the bill:** conversations now compact — older turns fold into a rolling summary (what you're building, decisions made, refs and values chosen) while recent turns stay verbatim. Week-long design conversations keep their memory at a fraction of the tokens, and replies stay just as sharp.",
      "**Report a bug — with the context already attached:** the editor now keeps a short replay buffer of editor actions on your device (like a game recorder — local only, never synced). Hit **⚑ Report a bug**, and a dialog shows exactly what would be sent — your description, the recent action log (viewable), optionally a design snapshot — and sends only when you confirm. The capture toggle is gone; there's nothing to configure and nothing leaves your machine without you pressing Send.",
      "**Schematics you can actually read:** block pages, calculator pages, share pages, and the in-editor teardown view now render schematics at their natural size (scaled to fit, capped) instead of squeezing a full 8-pin design into a thumbnail. The 555's internals are finally legible without squinting.",
      "**Pro has a price:** $9/month, early-adopter rate, right on the pricing page — no more mystery. Yearly billing is in the upgrade flow (best value), and a new FAQ spells out the cancel policy: Pro runs out what you paid for and your designs are never deleted.",
      "**The landing page now shows a catch:** the hero demo's linter flags a real mistake — a 24 V brick feeding an 18 V-max regulator — with the offending net highlighted in red. Watching the checker catch something IS the product; now the first screen shows it.",
      "**Sparky is on the landing page** — with the honest argument: AI copilots guess because nothing checks them; Sparky's work goes through the same deterministic linter as yours. Every wire resolved, every budget recomputed, every claim checkable.",
      "**Circuit calculators:** five free calculators — **LED resistor**, **voltage divider** (with reverse mode), **crystal load caps**, **NTC thermistor tables**, and **op-amp gain** — each showing the REAL schematic it computes, with standard E-series values, the gotchas, and a one-click path into the editor. Find them in the footer or at /calculators.",
      "**Four new blocks (Wave 3):** the **non-inverting op-amp amplifier** (the two-resistors-make-precision circuit, with the clipping and single-supply gotchas), **crystal + load caps** (the load-capacitance math everyone gets wrong, and why placement is the engineering), **TL431 voltage reference** (the most-shipped secret IC in electronics), and **NTC temperature sensing** (with the self-heating and ratiometric notes). Library: 25 blocks.",
      "**The TL431 opens up too:** its discrete equivalent shows the three things inside the three-pin package — reference, error amp, shunt transistor — and the error amp nests into the comparator teardown. Seven ICs in the library now break into discrete.",
      "**The buck and boost open up:** both switching regulators gain **discrete equivalents** — honest hysteretic (bang-bang) controllers: a comparator watching the feedback pin against a reference, flipping the power switch. And because that comparator is itself breakable, the buck is now a **triple-nested teardown**: buck → controller internals → comparator → transistor pair. Six ICs in the library now open up.",
      "**Everything in your account now persists:** your custom blocks, block edits, settings, and project list now live in real cloud storage alongside your designs — they follow you across devices and survive anything. (Anonymous/local use keeps working from your browser.)",
      "**Honest legal pages:** the Privacy and Terms pages got a full rewrite to match today's product — accounts, design visibility, billing via Stripe, the assistant's data path, affiliate links, and exactly what stays local-only. Plain language, no boilerplate fog.",
      "**Sparky says so when it's out of fuel:** if our AI capacity is exhausted (it happens during development), Sparky now says exactly that instead of a vague error — your design is untouched, just try again later.",
      "**Faster discovery:** the site now publishes an **llms.txt** index (so AI assistants citing sources for circuit questions can find and quote the block explainers) and supports **IndexNow** for near-instant indexing on Bing-family search engines.",
      "**Honest comparisons:** new **/vs** pages compare Electrace with Fritzing, Tinkercad Circuits, EasyEDA, and KiCad — and every one names what the OTHER tool does better and when you should pick it instead. KiCad's page isn't even a versus: it's the on-ramp story, because the export button is the whole point.",
      "**Findable:** a site-wide SEO pass — every published URL (canonicals, sitemap, robots) now points at the real host instead of a redirect, the landing page declares itself properly to search engines (organization, site, and free-app structured data), the pricing FAQ is machine-readable, block pages carry breadcrumbs, and **every block page now generates its own social card** (title, framing, declared specs) so shared links look right everywhere. Unlisted shared designs stay out of search indexes — public ones are in.",
      "**Comparator (with hysteresis)** joins the library — the Schmitt trigger built from parts you can point at, teaching the two classic comparator bugs (the missing pull-up on an open-collector output, and chattering at the threshold without hysteresis). Its **discrete equivalent** is the long-tailed pair — two matched transistors weighing the inputs against each other, the front door of every comparator and op-amp ever made. And because the 555's internal comparators are the same part, **teardowns now nest**: open the 555, then open one of ITS comparators.",
      "**The 555 arrives — and opens up:** a new **555 Timer (astable)** block (the two-resistors-one-cap oscillator, with the frequency and duty formulas and the floating-RST gotcha), and the most famous teardown in electronics as its **discrete equivalent**: the three 5k resistors the chip is named for, the two comparators they feed, the SR latch they fight over, and the discharge switch — with CV honestly exposed as the 2/3-divider tap it really is.",
      "**The H-bridge opens up:** the motor driver gains its **discrete equivalent** — select the chip and break it into the four FETs it really is (two totem-pole pairs, the same structure as a CMOS gate, sized for amps), with the honest note about shoot-through and what a real driver IC adds. It's drawn on the block's public page too, under *Inside the chip*.",
      "**Pad net passport:** click any pad on the board and the properties panel now shows everything riding on that net — every pad on it (click one to jump straight there), how many millimetres of copper are routed, and in how many traces. The PCB answer to the schematic's net inspector.",
      "**PCB editor catches up:** components can no longer **overlap** — dragging slides a part along its neighbour (same feel as the schematic canvas), rotations that would land on another part are refused, and **arrow keys nudge** the selected part (0.5 mm, Shift for 2.5 mm). Also fixed: rotating a part you'd never dragged used to **teleport it to the board origin** — it now rotates in place.",
      "**Zooming fixed in Firefox (both editors):** wheel deltas are now normalized across browsers — Firefox reports scroll in lines (and fractional pixels), which made zoom crawl at ~2% per notch and sometimes routed the wheel to pan instead. Schematic and PCB editors both behave the same now.",
      "**Connectors on the full schematic:** the whole-design sheet now shows every board connector as its own region — each pin with its net flag (and an honest dashed *open* for unwired pins). A schematic without its headers was missing exactly what a reviewer checks first.",
      "**Long labels behave now:** part values longer than a real value (Sparky liked writing datasheet sentences into them) are **clamped with an ellipsis** on the drawing, the IEC inside-the-box value placement only fires when the text truly **fits the drawn box** (no more wire strike-throughs), and the full-schematic sheet's titles count as obstacles so labels stop parking on them. Sparky is also now told that a value is a VALUE (\"100n\", \"SMBJ18A\") — explanations belong in chat, not on the sheet.",
      "**Full schematic view:** a **Schematic** button in the editor opens the whole design as **one traditional schematic sheet** — every block's real internals drawn side by side in titled regions, with **net-name flags** at each port (same name = same net, the way multi-sheet schematics have always worked). Hover any part for its authored why, double-click a block to edit it, and **Download SVG** for a clean handoff/review drawing.",
      "**The net graph never lies anymore:** connector pins now appear as members of their nets everywhere — the net inspector gains a **Board I/O** section showing exactly where a net leaves the board, and Sparky's net listings include them too (they were silently dropped before). And a **stale wire no longer kills the analysis**: a wire whose endpoint vanished (say a block was re-authored) used to crash the checks into one cryptic error — now everything else still resolves and the stale wire becomes a precise finding that names the endpoint's actual valid terminals. Sparky also reports an explicit **terminal diff** (added / removed / reconnected / orphaned) whenever it re-draws a block.",
      "**Sparky replies land in the right chat:** a reply that finished after you switched threads (or drilled in/out of a block schematic mid-response) used to land in whichever conversation was active at that moment — looking like it vanished. Every run is now bound to the conversation it started in.",
      "**Six more library blocks — the GPIO-to-world set:** **MOSFET Switch** (the 'drive a 12 V thing from a 3.3 V pin' answer, with the logic-level-gate gotcha), **Relay Driver** (starring the famous flyback diode), **H-Bridge Motor Driver** (how reversing a motor actually works, and why you size for stall), **I2C Level Shifter** (the two-FET BSS138 trick, explained properly), **Debounced Button** (why one press reads as twenty, and the RC fix), and **LED Current Sink** (a real two-transistor current regulator — your first taste of how every linear regulator works inside). The library is now 19 blocks, every one with its schematic, whys, declared specs, and failure-mode notes.",
      "**Symbol bodies are opaque:** a wire passing behind a part is now **masked by the body** instead of showing through it — a line through a symbol used to read as a connection that doesn't exist. Pins and their stubs stay clear.",
      "**Wires are always clickable:** a wire squeezed between two close parts used to be unselectable — the parts' grab areas sat on top of it. Clicks landing on the line itself now always reach the wire (and clicks near a pin still go to the pin).",
      "**Symbols can't overlap anymore:** there's never a reason for two parts to sit on top of each other, so now they can't — dragging slides a part *along* a neighbour instead of through it, rotating into a neighbour is refused, nudges stop at contact, and newly placed or duplicated parts walk to the nearest clear spot.",
      "**Labels stopped fighting the drawing:** schematic ref/value labels are now **collision-avoided** — they never sit on symbols, wires, or each other. Chips and ICs carry their label **on the body**; in **IEC** mode a horizontal resistor's value goes **inside the box** (that's what the box is for); long labels **wrap** into a neat stack instead of running over neighbours; and when a crowded area pushes a label away from its part, a **light dotted leader line** points back to it. **PCB silkscreen refs** do the same dance — they slide above/below/beside their part to the first clear spot instead of stamping over the neighbour.",
      "**Terminals always face their wire:** port symbols now auto-orient toward their connection — place one backwards (or let Sparky do it) and it snaps to face the wire, in the editor and every preview.",
      "**Six new library blocks** — the power spine: **USB-C 5V Input** (the CC-resistor handshake everyone forgets), **Reverse-Polarity Protection** (the P-FET trick, explained), **Boost Converter**, **Li-ion Charger** (CC/CV, with the charge-current formula), **Input Protection** (fuse + TVS crowbar pairing), and **Voltage Divider** (with the two loading gotchas). Every one ships with its drawn schematic, per-part whys, declared specs the checker can verify, and a failure-mode note — and each has its own explainer page in the library.",
      "**Power Entry fix:** the reverse-polarity FET inside Power Entry was drawn input-to-source; correct is input-to-**drain** (otherwise a reversed supply sneaks through the body diode). Fixed, and the explainer now teaches why.",
      "**Block pages got a big upgrade:** every public block page now shows the **actual schematic**, an **\"Inside the chip\"** section that draws out the discrete equivalent where one exists (the same view as the editor's break-into-discrete), related blocks, and a try-it call-to-action. The library search now also takes **specs** — type `18V → 5V at 3A` and get the blocks that can do it.",
      "**Buy your BOM:** every line in the BOM panel now has a **buy ↗** link (by part number when declared, value + package otherwise), a **CSV download**, and a one-click **Send to Digi-Key** that drops every line with a part number straight into a Digi-Key list/cart — refs and quantities included. Links never influence which parts a block recommends.",
      "**Share your designs:** a **Share** button in the editor lets you choose who can see a design — **Public** (anyone can find it), **Unlisted** (anyone with the link), or **Private** (only you — part of Pro) — and copy a share link. The shared page is a clean read-only view: the blocks with their specs and internals, live check status, and an **\"Open a copy in Electrace\"** button so anyone can fork a shared design into their own workspace.",
    ],
  },
  {
    date: "2026-06-08",
    items: [
      "**Settings:** a proper **settings page** (from the account menu) to change your theme, accent, ANSI/IEC symbols, role, and local-capture preference — and edit your display name — any time after onboarding.",
      "**Block library:** the library index is now **searchable** and **filterable by category**.",
      "**Schematic export:** export a **KiCad netlist (.net)** of the whole stitched design straight from the editor toolbar (alongside Export and Report).",
      "**Polish:** friendly **404 and error pages**, and real **Privacy** and **Terms** pages (linked from sign-up and the footer).",
      "**Landing page:** a cleaner, roomier **hero animation** — the two-block preview is properly spaced with port-to-port wires, terminal labels no longer overlap the blocks, and the hover-to-explain tooltip and lint bubble sit clear of everything.",
      "**Site look:** a subtle **schematic dot-grid + ambient glow** backdrop across the pages, so the background has a bit more depth instead of reading flat.",
      "**Themed dialogs & right-click menus:** the browser's plain prompt/confirm boxes are replaced with **in-app themed dialogs** (Escape/Enter, click-away to cancel). **Right-click** now opens a themed menu — on a block (open · duplicate · delete), on empty canvas (fit to view · clear selection), and on a dashboard design (open · star · rename · delete).",
      "**Dashboard:** each design now shows its **lint status** at a glance (Ready / N issues / N warnings), an **Open issues** total across your designs, **sort** (last edited / name / issues) and a **grid ↔ list** toggle, plus **starring** designs with a working **Starred** filter (and a **Drafts** view for empty boards).",
      "**Hover-to-explain:** hover any block on the canvas to get a quick **tooltip** — its spec, inputs/outputs, what parts are folded inside, and a key limit note — the same at-a-glance read the home page shows off.",
      "**QFP blocks:** pin labels on big (QFP-style) chips no longer **overflow off the block** — top/bottom labels now read down/up into the chip and every label is clamped to stay on-body.",
      "**Brand:** the Electrace **logo mark** — the circuit-C with a resistor trace — now sits beside the wordmark in the nav, footer, sign-in, and onboarding, and shows up as the browser **favicon** (themed to the page).",
      "**Wire-to-wire junctions:** in a block's internal schematic you can now **end a wire on any point along an existing wire** — a junction tap — instead of only pin-to-pin. The two are electrically joined (a junction dot marks the tap), so you can branch a net without routing all the way back to a pin.",
      "**Footprint imports:** the PCB editor can now **import real KiCad `.kicad_mod` footprints** — a single file or a whole library's worth at once — into a browsable **footprint library** (with a land-pattern preview of each), and **assign one to a part**: select a component, open Footprints, hit **Use**. The part's pins map onto the imported pads and the ratsnest follows; **Use default** reverts. Or hit **Auto-match parts** to assign library footprints to every part that matches by package (e.g. an 0805 cap → the library's `C_0805`) in one go. It's undoable and saved with your board.",
      "**Pricing & tiers:** a **/pricing** page with three tiers — **Hobby** (free, up to 10 designs), **Pro** (unlimited + private designs + manufacturing exports), and **Team** — a founding early-adopter note, and an FAQ. The dashboard shows your **10-design Hobby allowance** with an upgrade prompt when you hit it. Linked from the nav, footer, and dashboard.",
      "**Sparky is a Pro feature:** the AI assistant (build/wire/explain) is now part of **Pro** — on the free Hobby plan the assistant pane shows an upgrade prompt. Everything else on Hobby is unchanged.",
      "**Accounts:** real **cloud accounts** — sign up with **email + password** (with email confirmation) or **continue with GitHub / Google**, and your session now follows you **across devices** instead of living only on one browser. The top bar shows **Log in / Sign up** when signed out and your **avatar menu** (your designs · settings · log out) when signed in. The **app requires signing in** — the editor, your dashboard, settings, and onboarding — while the **marketing pages, block library, and help stay public**.",
    ],
  },
  {
    date: "2026-06-07",
    items: [
      "**Sparky (assistant):** named **Sparky** ✨ with a friendlier face; opens into a **collapsible side pane** over the canvas (was a small popup); **multiple conversations** — new / switch / delete, each named from its first message and saved; replies render as **markdown** (tables, lists, code); shows **live progress while it works** instead of a static typing indicator; for a big multi-block build, Sparky fans the work out to its **sparks** and builds blocks in parallel, then places, wires, and reviews them; **bias-to-action** — finishes obvious steps instead of asking permission; can answer questions about **Electrace itself + what's new**; reads a block's details, sets values without re-authoring, exposes chip pins as a header, authors discrete/passive parts, places connectors, and reads power budgets.",
      "**Blocks & authoring:** a block is a **functional subcircuit** (multiple parts folded in), not one-part-per-block; re-authoring **auto-reconnects renamed pins** instead of orphaning wires; **shared-value guardrail** warns when one shared block can't carry per-instance values; values are **first-class** and editable.",
      "**Library:** **relay** variants (SPST / DPDT / solid-state); **Mini-USB-B** and **Micro-USB-B** connectors; connectors are placeable by the assistant.",
      "**Checks & analysis:** **acknowledge** a correct-but-noisy finding so it mutes with a reason (and grouped acknowledgements now mute every matching pin); a **connector-capacity** note when a header is maxed; **power budgets** surfaced (draw vs capacity, headroom); the findings panel and help now say plainly that checks are **structural, not a simulation** — clean = sane, not validated.",
      "**Declare loads & sources from the UI:** power/rail terminals now take a **voltage + current** in the block form and the right-hand inspector, so a source or static load shows up in the budget (instead of reading 0 W).",
      "**Appearance:** **three themes** — Light / Mid / Dark (Mid default) — from a selector, and the editor themes too; **user-assignable glyph colors** per block; an **accent color** you can pick.",
      "**Onboarding:** a first-run **welcome wizard** — pick your role, choose **ANSI vs IEC symbols** (a teaching picker that shows a resistor both ways), and your theme + accent — all applied live as you pick, then it opens a sample design to explore.",
      "**Dashboard:** the projects home is now a real dashboard — a workspace sidebar, **jump-back-in** recents, **start-from-a-template** cards, and a **searchable design grid** with live thumbnails + block counts (and a friendly empty state).",
      "**Account pages:** **login / sign-up** screens (GitHub / Google + email, split-layout with a product showcase).",
      "**Landing page:** a real home page — an **animated** hero with a live product-window preview (floating window, mini block schematics, a hover-to-explain cursor, a lint bubble), how-it-works, the see-inside transparency story, typed-nets, why-Electrace, the design → PCB → build path, scroll-reveal sections, and a start-free CTA.",
      "**PCB editor:** **connectors now land on the board** with real footprints (a 2×20 header is a proper 2-row grid, not a 100 mm row) and the ratsnest connects them; **size-aware auto-placement** so big parts don't overlap; **faster zoom**; authored **chips land their real package** (e.g. QFP-32 with all 32 pads).",
      "**Site:** a **Help & Changelog** page; social-share metadata (OpenGraph/Twitter card), sitemap + robots for the public block pages.",
      "**Fixes:** assistant reply truncation; authored blocks now reach the BOM/analyzer; light-mode contrast (white text/symbols on light); theme load flash + hydration warning.",
    ],
  },
  {
    date: "2026-06-06",
    items: [
      "**Connectors:** added as a first-class concept — place them on the canvas and **drag a block terminal onto a connector pin to dock** it as board-edge I/O.",
      "**Blocks:** **edit a user block after creating it**; **expose a chip's pins as block terminals** one at a time (as needed); **QFP-style rendering** for high-pin blocks; the assistant can **author a block's internal schematic with a real chip** (so it hits the BOM + footprints, not a hollow shell).",
      "**Palette:** reorganized into a **2-wide grid** with collapsible **My blocks / Library / Connectors** sections; drag blocks/connectors straight onto the canvas.",
      "**Fixes:** duplicate-terminal canvas crash; block persistence across refresh; live-edit refresh; orphan ports; net-markers wrongly becoming duplicate PCB components.",
    ],
  },
  {
    date: "Foundations",
    title: "The core idea",
    items: [
      "**Block-based, strictly-typed schematic design** — wire typed terminals (power / rail / signal / gnd, in / out); the type system catches the dumb-but-deadly mistakes.",
      "**Live deterministic linting** — open nets, two drivers fighting, undriven rails, over-current/voltage, polarity, empty blocks — without SPICE.",
      "**BOM** from the real parts inside your blocks, and a **PCB view** (footprints, ratsnest, routing, DRC, KiCad export).",
      "**Transparent** — every block can be cracked open to its real chip, footprint, and schematic; nothing hidden behind a magic box.",
    ],
  },
];

/** A user-facing guide to what you can do in Electrace — the answer to \"how do I…?\". */
export const FEATURES_MD = `# What you can do in Electrace

Electrace is the electrical engineer's IDE — a transparent, **block-based** schematic and PCB tool with
live checks, no SPICE required. Here's the lay of the land.

## Designing a schematic
- **Place blocks.** Drag from the palette (left) onto the canvas, or click to add. Blocks are grouped:
  *My blocks*, *Library*, and *Connectors*.
- **Wire terminals.** Drag from one terminal handle to another. Terminals are typed (**power / rail /
  signal / gnd**) and have a **role** (**in** = load, **out** = driver) — wiring two drivers onto a net
  flags a warning.
- **Functional blocks.** A block is a *subcircuit*, not one part — an oscillator block holds the crystal
  **and** its two load caps. Crack any block open (double-click) to see/edit its internal schematic.
- **Make your own blocks.** Create a block with the terminals you need, then draw its internal schematic
  (or have Sparky author it from a part number). Expose just the pins the rest of the design connects to.
- **Connectors** are the board-edge home for off-board nets — USB, barrel jacks, headers, screw
  terminals, RJ45. Dock a block terminal onto a connector pin. **Double-click a connector** (or
  right-click → *Pin specs…*) to declare what each pin means — name, type, direction, voltage,
  current — and the checks work across the board edge. USB receptacles, the LiPo JST, and barrel
  jacks come pre-declared (VBUS is already 5 V power in), and each connector family's
  **per-contact current rating** is enforced against what actually flows through the pin.

## Checking your work
- **Live linting** runs on every change — errors, warnings, and notes appear in the bottom panel and on
  the selected block. Click a finding to jump to the block.
- **Voltage & current propagate.** A supply's range follows the wires through chips whose outputs swing
  at their rail, so an over-voltage three blocks downstream is caught at the pin that will actually die.
  Every load charges back to its rail.
- **Power budgets** (bottom bar) show each rail's load vs the source's capacity, and the **what-if
  stress test** asks "would this survive 24 V at the input?" against every declared limit on the rail.
- **Galvanic isolation** (Pro): right-click a block → *Isolation…* and declare it must share no conductive
  path with another block (or all others). Re-verified on every change; a violation names the bridging net.
- **Signal integrity** (Pro): right-click a wire → *Signal class…* and declare it RS-485 / CAN / I2C / a USB
  pair. The checker enforces termination, rise time (with the fix in the message), and — on the PCB —
  trace length and pair matching against the class's edge rate.
- **Acknowledge** a finding that's correct-but-noisy (e.g. USB + regulator legitimately sharing a rail)
  with the *mark intended* button — it mutes with your reason and stops counting.

## What the checks mean (and what they don't)
Electrace's checks are **structural — not a simulation.** They look at how your design is connected and
the values you declared, and catch the dumb-but-deadly mistakes: two drivers fighting on a net, an
undriven rail, an open/unconnected pin, a power pin tied to ground, a rail drawing more than its source
can supply, a polarized part wired backwards, a regulator burning more heat than its package survives,
a connector contact carrying more current than it's rated for.

What they **don't** do: time-domain behaviour. No SPICE, no transient simulation — though the
**DC operating point IS solved** (node voltages and real resistor dissipation, closed-form), and
USB hard-attach inrush is checked from declared bulk-capacitance arithmetic. No waveforms, no thermal,
no ripple-current-on-the-caps, no EMI or loop-stability. A clean result means your design is
**structurally sane — typed-correct and connected as intended — not that it's validated.** Component
values you (or Sparky) set are *starting points*; nothing here checks them against a real part's
datasheet. Treat a green check as "the first 80% is correct and BOM-ready," then take it to a simulator
and a real EDA/PCB review for the analog 20%. The **KiCad export** is that escape hatch — Electrace
never locks you in.

## Author a block vs. use a library block
- **Use a library block** when a stock part fits as-is (a header, a generic passive, a connector).
- **Author a block** when you need a real part or a functional grouping: an MCU/driver IC (author it
  from its part number → real footprint + BOM), or a subcircuit like a power stage or oscillator. A
  block should be a *functional unit* — fold its support parts (decoupling, gate resistors, shunts,
  load caps) inside it, and expose only the pins the rest of the design connects to. Don't scatter
  loose passives on the canvas, and don't leave a block as a hollow shell (it won't reach the BOM).

## Outputs
- **BOM** — built from the real parts inside your blocks; exportable.
- **PCB** — open the PCB view to get footprints + a ratsnest from your schematic, route traces, run DRC,
  and export to KiCad.

## Calculators
Free engineering calculators at **/calculators** — LED resistor, voltage divider, crystal load caps,
NTC thermistor, op-amp gain, parallel resistors, 555 timer, RC filter, Ohm's law, motor winding & Kv, current divider, delta↔wye, LC resonance, AC power & PF, AC motor — each with E-series
value snapping and a link into the related block where one exists.

## The symbol library
Passives (R, C, L, crystal, ferrite, fuse…), diodes (incl. Zener, Schottky, TVS, LED), transistors
(BJT/MOSFET/JFET), ICs (with full pinouts → real footprints), sources, and electromechanical parts
including **switches and relays (SPST/SPDT/DPDT/solid-state)**.

## Sparky, your assistant ✨
Open Sparky (bottom-right) to build and reason about your design in plain language. Sparky can place and
wire blocks, **author a chip from its part number** (dropping the real IC into a block with its footprint),
add the support parts a block needs, place connectors, run the analysis, read the net graph and power
budgets, and explain what's on any net. Start a **new chat** any time; conversations are saved.`;

/** Render the changelog to markdown (for the page and the assistant). */
export function changelogMarkdown(): string {
  return ["# Changelog", ...CHANGELOG.map((e) =>
    `## ${e.date}${e.title ? ` — ${e.title}` : ""}\n\n${e.items.map((i) => `- ${i}`).join("\n")}`,
  )].join("\n\n");
}

/** Combined reference handed to the assistant on demand (features + recent changelog). */
export function electraceHelpText(): string {
  const recent = CHANGELOG.slice(0, 2);
  const log = recent.map((e) => `### ${e.date}${e.title ? ` — ${e.title}` : ""}\n${e.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
  return `${FEATURES_MD}\n\n---\n\n# Recent changes\n\n${log}`;
}
