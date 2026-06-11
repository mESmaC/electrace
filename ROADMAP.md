# Electrace roadmap — alpha → beta → 1.0

Created 2026-06-11, consolidating the scattered planning value from ideas.md, todo.md,
revenue-checklist.md, and walkthrough-gaps.md into one view. **FEATURES.md is what IS;
this is what's NEXT; DECISIONS.md is what's undecided; VERIFICATION.md is the quality gate.**
Numbers marked (proposed) are targets to react to, not commitments carved in stone.

## Where we are: ALPHA

The thesis is built and live: self-explaining blocks, the 21-rule checking engine with
DC propagation, expand-to-discrete covering every reducible IC in the library, PCB → KiCad,
Sparky, cloud accounts, Stripe, the sandbox funnel, and the content engine (SEO surfaces +
shorts pipeline). Alpha means: features land fast, breaking changes are fine, and the
gate to beta is **verification, not features**.

---

## Content goals

### Blocks: 26 → 40 (beta) → 60 (1.0)  *(proposed)*

Wave criteria, in priority order: (1) completes a real hobbyist project end-to-end,
(2) has search volume for its explainer page, (3) teardown/Shorts potential.

**Beta wave (+14):**

| Block | Why it earns the slot |
|---|---|
| LM317 adjustable regulator | the classic; calculator synergy; breakdown planned |
| Charge pump (TC7660-style) | named in the discrete library's own header as the example |
| RS-485 transceiver node | pairs with the SI engine — declare the class, watch it enforce |
| CAN bus node | same SI story; automotive/maker crossover searches |
| USB-UART bridge (irreducible) | on nearly every hobbyist board |
| Stepper driver (A4988-style, irreducible) | 3D-printer/CNC audience |
| WS2812 LED output stage | level shift + termination; huge maker volume |
| LM386 speaker amp | classic; breakdown planned; audio entry point |
| Current-sense amplifier | pairs with budgets/contact ratings story |
| Microphone preamp | completes the audio in/out pair |
| Hall-effect sensor input | sensors wave opener |
| Photodiode / LDR front-end | second sensor; opamp-block synergy |
| Rotary encoder input | debounce + quadrature; pairs with debounced-button |
| ESP32 module (irreducible) | the MCU people actually use; flagged like mcu-load |

**1.0 wave (+20, sketch — firm up after beta):** load switch / eFuse, supervisor & reset,
USB-PD trigger, solar/MPPT-lite charger, SEPIC, class-D amp stage, instrumentation amp,
Sallen-Key active filters (LP/HP), servo driver, PWM fan controller, IR receiver + emitter,
433 MHz module (irreducible), RTC DS3231 (irreducible), I2C ADC + DAC (irreducible),
EEPROM (irreducible), opto-triac AC switch (MOC3021), 4–20 mA input, thermocouple front-end,
SD-card interface, 7-segment display driver.

### Discrete breakdowns: 10 → 14 (beta) → 20 (1.0)  *(proposed)*

Every reducible IC in the library stays covered — that's now a standing rule, not a goal.

**Beta (+4):** LM317 (reference + pass + adjust network), charge pump (the flying-capacitor
dance — strong Short), LM386 (power amp in miniature), ULN2003 (it's just seven darlingtons —
perfect "no magic" content).

**1.0 (+6):** 74HC00 NAND from four transistors (logic itself, demystified — the deepest
"no magic" statement we can make), Schmitt trigger (74HC14), instrumentation amp (three
op-amps, and we already have the op-amp), R-2R DAC ladder, MOC3021 opto-triac,
supervisor/reset IC. CPUs/MCUs/FPGAs/radios stay irreducible, honestly labeled.

---

## Release gates

### BETA gate — "we'd confidently hand this to a stranger"

Quality (the hard part — see VERIFICATION.md):
- [ ] Full design-verification pass complete; every feature verified against intent
- [ ] All P1 + P2 findings from verification fixed; P3s triaged with owners
- [ ] Walkthrough #2 (PCB deep-dive: routing UX, DRC, exports) done and gaps fixed
- [ ] Stripe live purchase + cancel tested end-to-end with a real card
- [ ] Version history shipped (it's on the Pro card as "coming soon" — beta makes it true)
- [ ] Error monitoring + basic analytics live (revenue-checklist Phase E)
- [ ] Block license decided and applied (DECISIONS.md #1)

Content:
- [ ] 40 blocks · 14 breakdowns · calculators for any new block that implies one
- [ ] "New" offers a blank sheet (walkthrough P2 #6 — last open P2)

### 1.0 gate — "standard release versioning starts here"

- [ ] 60 blocks · 20 breakdowns
- [ ] Native Gerber + drill export (today: .kicad_pcb → plot in KiCad)
- [ ] DC operating-point solver (per-part dissipation; fixes the propagation class at the root)
- [ ] "Explain this board" — import a KiCad design, Electrace explains it (ideas.md's
      strongest promote: kills cold-start, feeds the corpus, demos brilliantly)
- [ ] Parametric blocks (the calculator baked into the block)
- [ ] Live budget gauges in-canvas
- [ ] Sparky unit economics sustainable with metering ON (budget gate enforced, not just built)
- [ ] Zero open P1s for 30 consecutive days

### Post-1.0 horizon (parked, not forgotten)

Block registry + community publishing (registry.md is the spec) · block diff & swap
electrical diff · protoboard store + branded kits (DECISIONS.md) · Team plan ·
teaching/replay mode · **silicon CAD north star** (owner's call, exempt from triage).

---

## Feature backlog (consolidated from todo.md §2–4 + optimization.md)

**Engine/product, pre-beta candidates:** declaration-missing findings (emit "can't check
this — block doesn't declare X" instead of silence) · block prose + per-part why visible
in editor, not just hover · blank-sheet "New" · project rename prompt on first save ·
net-name display polish ("vout#2" leaking into messages) · Sparky conversation-ID binding
bug (chat loses stream when drilling out).

**Perf (optimization.md, verify-then-fix):** PCB SVG re-render on mouse move · analyze()
during drag (partially fixed — verify) · assistant payload size (full design+blocks per turn).

**Deliberately NOT doing (so it stops getting re-proposed):** SPICE simulation · breadboard
view · one-click JLC ordering (vendor-neutrality is the wedge) · semantic zoom (scratched).

---

## Doc map (after the 2026-06-11 tidy-up)

Root = the current generation; archive/ = everything that came before (value extracted,
staged to move off-repo — see archive/README.md for the per-doc extraction table).

| Doc | Role |
|---|---|
| FEATURES.md | what IS (current state, tier-tagged) |
| ROADMAP.md | this — what's next, gates, goals |
| DECISIONS.md | open calls awaiting Cameron + the decided log |
| VERIFICATION.md | the alpha→beta quality gate |
| walkthrough-gaps.md | live findings from real-use walkthroughs |
| design.md | the design source of truth — check before any UI work |
| gsc-queue.md, bing-submit.txt, domain-reputation.md | SEO/ops, kept current |
| archive/ | the pre-consolidation docs (concept→alpha era) |
