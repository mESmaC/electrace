# Competitive Landscape & Positioning

_Based on a deep-research pass (27 sources fetched, 108 claims extracted, 25
adversarially verified, 22 confirmed). Confidence and caveats noted throughout. See
[concept.md](concept.md) for the product definition._

## Headline finding

**No surveyed competitor occupies the intersection of our two pillars:**
(a) author-declared, drillable, plain-language explanation of what a block/IC does, and
(b) deterministic arithmetic/threshold checks on declared specs (no simulation).

Every player touches *one* axis at most, and usually via a different mechanism than ours.
The white space is the *combination*, aimed at the learner-to-intermediate,
discrete-friendly, low-volume user.

## The landscape, by threat level

### Most dangerous — AI-copilot EDA (Flux Copilot, AllSpice/DRCY)
These are the only players touching *both* explanation and checking.
- **Flux Copilot**: you can ask "explain the function of U1"; it reads schematics, BOMs,
  connections, and datasheet info, suggests alternatives, validates compatibility.
- **AllSpice / DRCY**: an AI *design-review* agent that flags risks like mismatched pins
  or derating problems. It's a review/collaboration layer on top of existing ECAD — not a
  capture tool, and it doesn't narrate what a block was *designed* to do.
- **The crucial distinction (our wedge):** their explanation and checking are
  **LLM/datasheet-inferred** — probabilistic, no accuracy guarantee (Flux admits this).
  Ours is **author-declared and deterministic.** That's a trust/transparency difference,
  not just a feature difference.

### Adjacent but aimed the other way — AI-synthesis EDA (CELUS, JITX)
- **CELUS**: organizes design around functional blocks ("CUBOs") and *auto-generates*
  schematic + BOM + footprints from requirements, then hands off to Altium/KiCad/Eagle.
- **JITX**: requirements expressed as Python code; AI generates candidate designs,
  validated by external/EM evaluators.
- **Why they're not us:** both *generate the design for you*. That's the opposite of "make
  you understand it." Different buyer, and arguably a positioning *gift* — they're
  automation, we're transparency.

### Closest conceptual analog on pillar (b) — TypedSchematics
- A **Sept 2025 arXiv academic prototype**: a block-based PCB tool with a *language syntax
  for "typing" blocks*, giving real-time connection-error checking — explicitly framed on
  the "block reuse is normal in software but absent in circuits" analogy (same insight as
  ours). Non-simulation, lint-style checking = our pillar (b).
- **But:** no plain-language explanation (pillar a is left open), and it's a research
  prototype with no commercial presence. Conceptual overlap high, commercial threat
  currently low. **Worth watching** — if it gets funded, it's the closest thing to us.

### Structural blocks, neither pillar — Altium, EasyEDA Pro
- "Reuse Blocks" bundle schematic + PCB layout as version-controlled replication
  containers. Metadata is **administrative only** (name, description, revision, author,
  date) — no design intent, no explanation, no spec checking.
  - _(Honest caveat: adversarial verification refuted the over-broad claim that Altium has
    "zero" intent/checking — Altium has a separate Requirements/V&V module that flags
    out-of-alignment values. It's just not attached to reuse blocks.)_

### Opposite paradigm — simulators (Falstad/CircuitJS)
- Real-time SPICE-like simulator; hover shows *computed simulated state* (V, I, P), not
  authored intent. Confirms that even hover-info beginner tools don't occupy our
  authored-explanation pillar. This is what we are explicitly NOT.

## Positioning angles (verified-backed)

1. **"Nothing is a black box."** Authored, deterministic transparency vs. LLM-inferred
   guesses. Lean hard on *trust* — Flux/DRCY can't promise their explanation is correct;
   ours is whatever the author declared.
2. **"Linting, not simulation."** Fast declared-number sanity checks for people who don't
   want to set up SPICE. Speed + approachability.
3. **The IDE mental model** (hover docs / go-to-definition / lint / autocomplete) as the
   framing — no competitor uses it, and it instantly communicates the product.
4. **Discrete-friendly + low-volume kitting / add-to-cart** — a build-it-or-order-it flow
   no copilot or synthesis tool integrates.
5. **Own the gap between toy simulators (Falstad/Tinkercad) and pro automation
   (Altium/CELUS/JITX)** — the learner-to-intermediate valley nobody serves well.

## Gaps & wedges (where we can slip in)

- **Workflow gap:** every tool dumps you into the next with no continuity
  (capture → PCB → sourcing → assembly). A continuous, explained journey is open.
- **Audience gap:** the learner-to-intermediate valley is real and confirmed — pro tools
  too cold, toy tools don't graduate to real hardware.
- **Trust gap (structural):** automation/copilot tools generate or infer things you can't
  fully audit. "Understand and own every part of your board" is a counter-position they
  *architecturally* can't take without abandoning their core pitch.
- **Vendor-neutrality (structural):** TI WEBENCH / ADI tools explain blocks and pick parts
  by spec beautifully — but are structurally biased to sell *their* silicon. We can be
  neutral; they literally cannot. **(Note: not yet verified — see gaps below.)**
- **Mechanism gap:** deterministic author-declared metadata is a fundamentally different
  (and more trustworthy) substrate than LLM inference or full simulation.

## Second-pass findings (kitting, vendor-neutrality, Geppetto)

_A focused follow-up run (24 sources, 86 claims, 19 verified) resolved the leads and the
kitting/vendor questions._

### Geppetto: validation, not a threat — and it's DEAD
- **Gumstix Geppetto was the real thing** — a drag-and-drop modular board builder (100+
  modules, "no engineering required") that went block-placement → auto BOM + pricing →
  Seeed-manufactured, shipped board in one session. The closest analog to our kitting
  vision that has ever existed.
- **But it placed blocks without explaining them, and did no real spec-checking** — it had
  a narrow "Power Consumption" feature (sum each module's draw vs. source, color-coded),
  which is a *hint* of pillar (b) but nothing like general declared-spec checking, and
  zero on the explanation pillar.
- **Gumstix permanently ceased all operations by Dec 31, 2025.** Acquired by Altium (2019),
  the tool was folded into "Upverter Modular"; geppetto.gumstix.com now 301-redirects to
  modular.upverter.com, with a Seeed-hosted iframe of the same lineage.
- **The lesson (Upverter arc):** the block→order modular product got *absorbed and left to
  wither*, not grown into a transparent block tool. It was tied to one vendor's
  modules/manufacturing. **Takeaway: a blocks-to-order tool welded to a single hardware
  vendor is fragile. Our vendor-neutral + explanation angle is exactly what it lacked.**
  Demand was proven; the execution model (vendor-locked, no transparency) is the warning.

### Vendor-neutrality wedge — CONFIRMED
- **TI WEBENCH** is spec-driven (enter requirements → auto-selects parts/values from a
  40,000+ library) but the function-defining ICs are **always TI silicon.** Structurally
  vendor-locked — it exists to sell TI parts and *cannot* be neutral.
- _(Nuance: WEBENCH also does SPICE simulation, so it's not a pure pillar-(b) analog — it's
  selection + simulation, both different from our deterministic-arithmetic approach.)_
- The neutrality wedge is real: a vendor-neutral block library is something the vendor
  tools architecturally cannot offer.

### Kitting: PARTNER, don't BUILD — strongly supported
- **JLCPCB** exposes documented **PCB + Components APIs** explicitly pitched for
  third-party workflow integration (real-time quoting, ordering, lifecycle tracking,
  millions of parts with pricing/stock). *Caveat: API access is **gated** by prior order
  history and business standing — a real onboarding risk for a brand-new tool.*
- **MacroFab** — turnkey: upload BOM + Gerbers, it sources (Mouser/DigiKey), assembles,
  drop-ships.
- **AISLER "Simple Supply"** — ingest a BOM/project file, auto-identify parts across 9
  distributors, consolidate into **one order, one invoice, one delivery.**
- **kicad-jlcpcb-tools** (a community KiCad plugin) proves fulfillment integration can be a
  **thin glue layer** over existing EDA — one click generates BOM + CPL + Gerbers.
- **Conclusion:** building kitting from scratch would be wasted effort. The smart play is a
  thin export/ordering layer on top of an existing fulfillment backend. Start with the
  least-gated option (AISLER/MacroFab) since JLCPCB's API needs order history we won't have.

### Modular ecosystems — no software-to-order flow
- **Mikroe Click Snap** is purely a *physical* snap-off mechanism (peripheral section
  becomes a System-on-Module); there is **no software design front-end** that turns picked
  blocks into an ordered, assembled custom board. Modules are physical building blocks, not
  a blocks-to-board pipeline.
- _(Grove, STEMMA QT, Qwiic, Pmod, littleBits, Snap Circuits were not individually verified
  — inference, not evidence. But none is known to offer design-to-order software.)_

## Still uncovered (lower priority)

No verified findings on: ADI LTpowerCAD specifically; several educational tools (Tinkercad,
Wokwi, CircuitLab, EveryCircuit); and the non-Mikroe modular ecosystems. None of these
bear on the core strategy now that the big questions are answered — chase only if a
specific decision needs them.
