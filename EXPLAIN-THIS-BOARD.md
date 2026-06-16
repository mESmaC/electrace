# "Explain this board" — KiCad import → findings (build plan)

Status: **scoped + de-risked, building** (2026-06-15). The one heavier build from the digest's
six-item list (#5). Items #1–#4 shipped; #6 (pricing) genuinely waits on usage telemetry.

## Why it exists
The cold-start fix. A pro lands on Electrace, won't rebuild their board to evaluate it, and bounces.
"Paste/import your KiCad design and see what Electrace catches" removes that tax — it's a standing
free top-of-funnel hook on the live platform, not a one-time launch asset.

## The trust contract (the whole point)
A raw KiCad netlist carries connectivity + values + part types, but NONE of Electrace's declarations
(typed terminals, v/i ranges, ratings, net classes). Naive full inference → **confident wrongness**
(reporting a finding/clean-bill from a guessed rail), which is strictly worse than a silent no-fire
and is the exact sin the standby-draw honesty centerpiece promises we don't commit. So:
- Every inferred value is **shown and overridable**.
- Findings are labeled **"inferred — may be wrong"** vs **"you confirmed."**
- Solver-backed checks stay **deferred** until the user confirms rails.
The riskiest surface becomes the showcase of the trust contract.

## What fires when (validated against lint.ts, 2026-06-15)
**Tier 1 — fire pre-form (scary + safe), from KiCad pin-type + net-name only:**
- `shortCircuit` — power source + GND on one net (zero-inference once pin types are mapped).
- `polarityConflict` — hot-to-gnd, or +/− polarity mixed (polarized cap/diode/LED backwards).
- `multipleDrivers` — two `role:out` on one net (needs KiCad Output-pin → role:out mapping).
- `danglingWire` — malformed netlist endpoint (data-quality gate).
- `testPoints` / `undrivenRail` — soft, low-inference (net-name → power/rail).

**Tier 2 — deferred behind the confirm-rails form (need voltage/rating/class):**
overVoltage, underVoltage, overCurrent, signalOverCurrent, dcOperatingPoint (thermal/cap-rating/
diode-PIV), regulatorDissipation, connectorPinCurrent, usbInrush, busTermination, i2cRiseTime.

**Not applicable to a flat import (no blocks):** openNet, internalShort, emptyBlock.

## Format decision (settled 2026-06-15): `.net` ONLY for Phase 1
KiCad's flat `.net` netlist does NOT carry pin electrical-types (Input/Output/Power) — those live in
`.kicad_sch`. The engineer's instinct is "then parse `.kicad_sch` to get real roles" — WRONG here.
The feature's whole job is killing cold-start with ZERO friction; `.net` is the universal,
trivially-exported, 10-second-paste artifact, while requiring `.kicad_sch` ("open your project files
to a website") reintroduces exactly the commitment friction the feature exists to remove. Requiring
the richer input to fire more checks defeats the reason it converts.
- **Phase 1: `.net` only.** Universal path, proven against many real netlists, ships the conversion moment.
- **Later, additive: `.kicad_sch` enrich** — when a richer file happens to be present, pin types
  sharpen inference + shorten the confirm-rails form. Option-3 architecture, NOT a Phase-1 dependency.
  (Building the symbol-lib + hierarchy parser first = the over-build trap, before import-seekers are
  even validated.)

## The choreography IS the feature: certain → inferred → confirmed
Consequence of `.net`-only, faced head-on: without pin roles, `multipleDrivers`/`shortCircuit` fire on
INFERENCE (part-type + net-name), so under our honesty contract they wear the "inferred — may be wrong"
label — the scary moment is hedged. Don't paper over it; make the flow USE it:
1. **Certain** — paste → "here's what we can see for sure": pure-connectivity, zero-inference findings
   (genuinely floating nodes, structural facts true regardless of any guess). UNHEDGED. Lead with these
   — an unhedged true finding on the user's own board beats a hedged scary one for first-contact trust.
2. **Inferred** — "here's what we suspect — we're inferring your power rails to check it," the
   inference-dependent findings, clearly labeled.
3. **Confirmed** — the ~90s confirm-rails form resolves the guesses → "now here's the real verdict."
The user watches uncertainty resolve into certainty as they give 10 seconds of input. The `.net`
format's limitation becomes the on-brand demonstration of the trust contract (same move as the landing
honesty centerpiece, one level down). The design effort goes HERE, not into the parser fork.

## The crux: the parser does ONE safe inference layer
KiCad pin **electrical types** (Power/Ground/Output/Input/Passive/OpenCollector…) + **net-name
conventions** (GND/VSS → gnd; VCC/VDD/+5V/VBUS → power) map to Electrace terminal `type`/`role`/
`polarity`. This is explicit in the .net file (not a voltage guess), so Tier-1 checks stay honest —
but the mapping IS the trust-critical surface and must be (a) proven against varied real netlists and
(b) surfaced to the user ("we read these pins as power/ground — fix any we got wrong").

## Phases (parser-proven FIRST)
1. **Parser** — `.net` (S-expr) → FlatSchematic. Reuse kicad-footprint.ts's tokenizer. Map part
   types from value/footprint; map pin electrical-types → terminal type/role/polarity. **Harden
   against a pile of real, varied KiCad exports before any UI** (format variety is the separable risk).
2. **Structural checks on import** — run Tier 1; render "here's your board as Electrace sees it" +
   the scary-but-safe findings. This is the pre-form moment; it must land before asking for rails.
3. **Transparent rail inference** — regex net names → candidate power/gnd nets, shown as
   "inferred — confirm/correct," never silently used.
4. **Confirm-rails form** — ~90s, one click per rail; on confirm, unlock the Tier-2 solver checks,
   findings labeled inferred-vs-confirmed.

## Riskiest unknown
Silent inference failure / format variety. Mitigation: parser proven against many real netlists
first; inference always visible + overridable; low-confidence → skip solver rules with a note.

## Effort
~3–5 days. Parser+mapping 1.5–2d · structural+UI 1d · inference+form 1.5–2d.
