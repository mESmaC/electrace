# Fun Ideas — Future Additions

A living brainstorm list. Nothing here is core (see [concept.md](concept.md)). These are
"wouldn't it be cool if" directions to revisit once the basics exist. Add freely.

> **Triage pass (2026-06-09).** Every idea now carries a verdict:
> **✦ PROMOTE** (surefire winner — pull toward the roadmap), **◦ PARK** (good, wrong time),
> **✗ SCRATCH** (struck through — reasoning kept so we don't re-litigate).
> Owner exception: the silicon CAD idea is exempt from triage — it's the long-horizon
> north star by explicit owner call, see memory `silicon-cad-vision`.

---

## Your ideas

### 1. Add to cart → build it or order it — ✦ PROMOTE
**Verdict:** This isn't a "fun idea" anymore — it's the revenue engine
([business-strategy.md](business-strategy.md): BOM affiliate from day one, kitting via
partner later). Pull the BOM/affiliate half into the launch checklist; the order-the-board
half stays partner-based (AISLER/MacroFab per [competition.md](competition.md)).

You finish your schematic and PCB and you're ready to actually use it. Hit **Add to
cart**:
- **Build it yourself** → adds all the blocks' components to your cart so you can hand-
  build it on perfboard.
- **Order the board** → place the PCB order and get it manufactured, low-volume friendly.

One design, two exits: solder it yourself to learn, or have it made.

### 2. IDE plugin for live embedded debug — ◦ PARK
**Verdict:** Genuinely novel — nobody connects firmware state to a live schematic view —
but it's a *second product*: per-toolchain integration (PlatformIO, STM32, Arduino core),
debug-probe plumbing, a different buyer. Zero revenue leverage until the core tool has an
audience. Revisit post-revenue; don't scratch, the moat potential is real.

A plugin for a real code IDE that lets you simulate outputs directly from your firmware to
the pins that connect to your PCB. You create an alias in the MCU code matching the **net**
the pin connects to, and you can watch whether your code actually fires the pin when its
condition is met. A **visual embedded-systems debug reference** — the schematic becomes a
live view of what your firmware is doing to the hardware.

### ~~3. FPGA mode — strip the HDL complexity~~ — ✗ SCRATCH
**Verdict:** Scratched in favor of the silicon CAD north star, which subsumes it with a
bigger payoff. Vendor tools already do block-based FPGA assembly (Vivado IP Integrator,
Quartus Platform Designer), so the wedge is weak; the HDL-abstraction space is a graveyard
of "Verilog without Verilog" tools; and it splits focus in the same direction as silicon
CAD while landing on better-served ground. If chip-level ever happens, fabric can be a
mode of *that* product.

~~This idea maps beautifully onto FPGAs. A version of the tool that removes a lot of the
abstraction pain around HDL — express the design as blocks/intent and lower the barrier to
getting something onto fabric without living entirely in Verilog/VHDL headspace.~~

### 4. AI design assistant (intent-aware) — ✦ PROMOTE
**Verdict:** Half-built already (Sparky) and perfectly on-thesis because suggestions are
grounded in *declared* data, not LLM guesses — which is the whole anti-Flux positioning.
The missing prerequisite is the declared cost/board-area fields (todo.md §2 "tradeoff
readout"); the assistant feature falls out almost free once those exist.

An assistant that watches your blocks while you edit and offers grounded suggestions, e.g.:
- *"This component is overkill here — consider dropping to part X unless you're expecting
  high current draw."*
- *"This IC is great for shrinking the board footprint, but it's expensive. You could swap
  in this discrete block, keep the same electrical behavior, and save money at the cost of
  board real estate."*

The point: it reasons about **intent and tradeoffs** (cost vs. footprint vs. headroom),
not just DRC.

---

## Spin-off ideas (mine, riffing on yours)

- **Block "diff" / version history — ✦ PROMOTE (quietly).** Not flashy, but it's a
  registry prerequisite (immutability/fork-on-edit already in todo.md §4) and table stakes
  for trusting community blocks. Build it as infrastructure, not as a feature launch.
  — see how a block evolved, roll back a regulator block to the version that worked, like
  git for circuit blocks.
- ~~**Tradeoff sliders**~~ — **✗ SCRATCH (in this form).** The slider implies a
  parametric *part-picking engine* — a search/optimization product in its own right.
  Parametric blocks (below) deliver 80% of the magic for ~10% of the work by re-deriving
  values from formulas instead of re-picking parts. ~~for a block, drag between "cheapest /
  smallest / most robust" and watch it re-pick parts within the same declared envelope.~~
- **Shared block library — ✦ already CORE, not an idea.** This is the moat and the
  strategy ([business-strategy.md](business-strategy.md) Phase 2). Listed here only for
  history; it graduates out of this file.
- **"Explain this board" on import — ✦✦ STRONGEST PROMOTE in the file.** Kills the
  cold-start problem (meet users in their existing KiCad projects instead of asking them
  to redraw), feeds the intent corpus, and demos brilliantly in a 30-second ad/Short.
  After the launch checklist, this should be the first big feature.
- **BOM-aware sourcing — ✦ PROMOTE.** Directly multiplies affiliate revenue: warning
  "this part is unobtainium" and suggesting an in-stock equivalent converts a dead end
  into a commissioned order. Natural v2 of the affiliate integration.
- **Teaching/replay mode — ◦ PARK** until the education segment is active (fast-follow
  per strategy, not launch). The cheap version overlaps "watch the watts" below.
- **Failure-mode notes surfaced inline — ✦ PROMOTE (small).** Cheap (authored prose on
  existing blocks), pure trust-building, and exactly the kind of content no competitor
  has. Fold into the block-authoring template so every new block ships with one.

---

## Claude's batch (riffing harder)

- **Parametric blocks (calculator baked in) — ✦ PROMOTE.** Best wow-per-effort in this
  file: pure arithmetic, stays inside the no-simulation rules, feels like magic, and makes
  every regulator block twice as useful. A regulator block where you type the Vout
  you want and it re-derives the divider resistor values from the standard formula and
  fills them in. The block isn't a fixed drawing, it's a *recipe*.

- ~~**Semantic zoom — "Google Earth for your circuit."**~~ — **✗ SCRATCH.** Pure polish
  with a high rendering cost, and the canvas already has unvirtualized-rendering debt —
  this would be built on sand. Violates build-functionality-first. The 90% version
  (click-to-drill navigation) already exists. ~~One continuous zoom gesture takes
  you board → block → schematic → individual part → the relevant line of the datasheet.
  No mode switches, no separate windows. You just fly in until you hit the detail you
  wanted.~~

- **Live budget gauges — ✦ PROMOTE.** The `railBudgets` data already exists; this is
  mostly UI. Constantly-visible value that screenshots/records well. A strip across the
  top that tallies the whole design from declared numbers as you build: total cost, total
  board area, total power dissipation — each against a target you set. A calorie counter
  for your board.

- **"Watch the watts flow" — ◦ PARK as product, ✦ PROMOTE as marketing material.**
  Mid product value, but it's the single best Shorts/ad footage the tool could generate —
  animated, legible in 5 seconds, no narration needed. Build it when the content pipeline
  needs footage. Highlight the declared power path lighting up down the chain — input →
  regulator → load — sized by current. Not simulation; just animating the numbers you
  already typed in.

- **Stress-test story mode — ◦ PARK.** The interactive stress-test panel already covers
  the core (todo.md §0); the narrated version is incremental polish. Bump an input to a
  what-if value and the tool *narrates* which author-declared limit trips first.

- **Pin passport — ◦ PARK (do opportunistically).** Overlaps the existing `whats_on_net`;
  cheap, good, not urgent. Click any terminal and see everywhere that net goes, its
  declared spec, and the worst-case demand any connected block places on it.

- **One-click design report — ✦ PROMOTE.** Unique artifact no competitor can generate
  (their tools don't *have* authored intent), nearly free since the data exists, and every
  exported report is shareable marketing. Auto-generate a clean design-rationale document —
  the writeup you always mean to make and never do. Your hover text *is* the documentation.

- **The IKEA manual — ◦ PARK (gated).** Charming, but it depends on kitting, which is
  itself a later layer. Keep for the kitting milestone. When you order the kit, it ships
  with a foldable per-block manual — one page per block, in assembly order.

- **Part-value consolidation — ◦ PARK (slow-week project).** Neat, cheap, niche. "You
  used 9 distinct resistor values across this board; here's how to get to 5 without
  leaving any block's declared envelope."

- **Block swap diff — "what changed electrically?" — ✦ PROMOTE.** Pairs directly with
  expand-to-discrete's honesty strip and shares the cost/area prerequisite with the
  intent-aware assistant — build the declared fields once, get both. Swap an IC block for
  a discrete one and get the *delta in declared specs*: footprint +180 mm², cost −$2.10,
  same Vout/Iout.

---

## Parking lot (raw, unsorted)

_(drop one-liners here as they come — clean up later)_

- **Silicon CAD / open chip design (long-horizon). — NORTH STAR by owner call (exempt
  from triage).** The same transparency thesis, one layer down: let people design their
  own *chips* — schematics, then layout/IC CAD — without the $100k–$1M/seat licenses
  (Cadence, Synopsys, Mentor) that gatekeep the field. There's a real, underserved cohort
  that wants to roll their own silicon and is locked out purely by tooling cost. Tailwinds
  to ride: open PDKs (Google/SkyWater 130nm, IHP 130nm), the OpenROAD / OpenLane
  RTL-to-GDS flow, and shuttle programs like Tiny Tapeout / Efabless that make small-run
  fabrication actually reachable. The wedge isn't competing with full EDA suites — it's
  being the *approachable, self-explaining* front door to them, the same way the block
  editor is for board design. Far future; flagged here so it isn't forgotten.
