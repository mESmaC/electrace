# Fun Ideas — Future Additions

A living brainstorm list. Nothing here is core (see [concept.md](concept.md)). These are
"wouldn't it be cool if" directions to revisit once the basics exist. Add freely.

---

## Your ideas

### 1. Add to cart → build it or order it
You finish your schematic and PCB and you're ready to actually use it. Hit **Add to
cart**:
- **Build it yourself** → adds all the blocks' components to your cart so you can hand-
  build it on perfboard.
- **Order the board** → place the PCB order and get it manufactured, low-volume friendly.

One design, two exits: solder it yourself to learn, or have it made.

### 2. IDE plugin for live embedded debug
A plugin for a real code IDE that lets you simulate outputs directly from your firmware to
the pins that connect to your PCB. You create an alias in the MCU code matching the **net**
the pin connects to, and you can watch whether your code actually fires the pin when its
condition is met. A **visual embedded-systems debug reference** — the schematic becomes a
live view of what your firmware is doing to the hardware.

### 3. FPGA mode — strip the HDL complexity
This idea maps beautifully onto FPGAs. A version of the tool that removes a lot of the
abstraction pain around HDL — express the design as blocks/intent and lower the barrier to
getting something onto fabric without living entirely in Verilog/VHDL headspace.

### 4. AI design assistant (intent-aware)
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

- **Block "diff" / version history** — see how a block evolved, roll back a regulator
  block to the version that worked, like git for circuit blocks.
- **Tradeoff sliders** — for a block, drag between "cheapest / smallest / most robust" and
  watch it re-pick parts within the same declared envelope.
- **Shared block library** — publish a block you designed; pull in someone else's
  well-documented power stage. The corpus grows socially (the npm/PyPI of circuit blocks).
- **"Explain this board" on import** — point it at an existing schematic and it tries to
  segment it into blocks and annotate intent. Reverse-engineering as onboarding.
- **BOM-aware sourcing** — the cart checks live stock/lead-time and warns when a block
  depends on an unobtainium part, suggesting an in-stock equivalent block.
- **Teaching/replay mode** — step through the chain block by block, watching declared
  voltages/currents propagate, as a way to understand a design you didn't write.
- **Failure-mode notes surfaced inline** — author-written "here's how this block dies"
  notes shown next to the relevant part, so the dangerous limits aren't buried.

---

## Claude's batch (riffing harder)

- **Parametric blocks (calculator baked in).** A regulator block where you type the Vout
  you want and it re-derives the divider resistor values from the standard formula and
  fills them in. Pure arithmetic — no simulation — so it stays inside the rules, but it
  feels like magic. The block isn't a fixed drawing, it's a *recipe*.

- **Semantic zoom — "Google Earth for your circuit."** One continuous zoom gesture takes
  you board → block → schematic → individual part → the relevant line of the datasheet.
  No mode switches, no separate windows. You just fly in until you hit the detail you
  wanted.

- **Live budget gauges.** A strip across the top that tallies the whole design from
  declared numbers as you build: total cost, total board area, total power dissipation —
  each against a target you set. A calorie counter for your board. Add an expensive IC
  and watch the cost gauge jump; you *feel* the tradeoff in real time.

- **"Watch the watts flow."** Highlight the declared power path lighting up down the
  chain — input → regulator → load — sized by current. Not simulation; just animating the
  numbers you already typed in. Makes the energy story of the board legible at a glance.

- **Stress-test story mode.** Bump an input to a what-if value and the tool *narrates*
  which author-declared limit trips first: "at 22V in, the input cap's voltage rating is
  the first thing to go." It's reading authored limit notes in order, not solving physics
  — a guided tour of how your design dies.

- **Pin passport.** Click any terminal and see everywhere that net goes, its declared
  spec, and the worst-case demand any connected block places on it. One click to answer
  "wait, what's actually riding on this node?"

- **One-click design report.** Because every block already carries its intent and
  explanation, the tool can auto-generate a clean design-rationale document — the writeup
  you always mean to make and never do. Your hover text *is* the documentation.

- **The IKEA manual.** When you order the kit, it ships with a foldable per-block manual —
  one page per block, explaining what it does and why, in assembly order. Furniture
  instructions that actually teach you electronics as you build. (Pairs with kitted
  delivery in concept.md.)

- **Part-value consolidation.** "You used 9 distinct resistor values across this board;
  here's how to get to 5 without leaving any block's declared envelope." Fewer reels,
  fewer mistakes, cheaper BOM — all from arithmetic on values you already set.

- **Block swap diff — "what changed electrically?"** Swap an IC block for a discrete one
  and instead of just a schematic diff, get the *delta in declared specs*: footprint +180
  mm², cost −$2.10, same Vout/Iout. The decision laid out in the terms that actually
  matter.

---

## Parking lot (raw, unsorted)

_(drop one-liners here as they come — clean up later)_

- **Silicon CAD / open chip design (long-horizon).** The same transparency thesis, one
  layer down: let people design their own *chips* — schematics, then layout/IC CAD —
  without the $100k–$1M/seat licenses (Cadence, Synopsys, Mentor) that gatekeep the field.
  There's a real, underserved cohort that wants to roll their own silicon and is locked
  out purely by tooling cost. Tailwinds to ride: open PDKs (Google/SkyWater 130nm, IHP
  130nm), the OpenROAD / OpenLane RTL-to-GDS flow, and shuttle programs like Tiny Tapeout /
  Efabless that make small-run fabrication actually reachable. The wedge isn't competing
  with full EDA suites — it's being the *approachable, self-explaining* front door to them,
  the same way the block editor is for board design. Far future; flagged here so it isn't
  forgotten.
