# Positioning, Landing Page & Pitch

_The message we test in [validation.md](validation.md). Built on the verified wedge from
[competition.md](competition.md): author-declared transparency + deterministic checks, for
the learner-to-intermediate, discrete-friendly user, launched under US Nylon._

## Positioning one-liner

> **An electronics design tool where nothing is a black box.** Build your schematic from
> blocks that explain themselves — hover any block or chip and see exactly what it's doing
> and why — and get caught the moment your numbers don't add up. No simulation to set up,
> no AI guessing, no parts bin you don't understand.

## The name — DECIDED: **Electrace**

*electric* + *trace* — "trace" doubles as the PCB copper and as tracing/drilling into what
a block does. On-concept for the transparency pillar.

- **Hosting:** subdomain of US Nylon (e.g. `electrace.usnylon.com`) — no separate domain
  needed.
- **Name-clash check (done):** no EDA/schematic/PCB tool is named Electrace; the lane is
  open. Be aware of two non-blockers: **ELECTRA** (no "ce") is KONEKT's PCB autorouter —
  adjacent, worth knowing for search confusion; **Elec-Trace** (hyphenated) is a
  heating-cable company in a different industry. Neither is a real conflict given the
  subdomain hosting.

## Why us, in one breath (the differentiation that's verified)

| They | Us |
|---|---|
| **Flux Copilot / AllSpice** — AI *guesses* what your part does from datasheets; no accuracy guarantee | We show what the block author **declared**. Deterministic, auditable, yours. |
| **CELUS / JITX** — generate the design *for* you (you still don't understand it) | We make *you* understand it. Transparency, not automation. |
| **Falstad / Tinkercad** — simulate or toy-grade; don't graduate to real hardware | Real schematic → real PCB → real order, with the learning kept in. |
| **TI WEBENCH / ADI** — explain blocks, but only to sell *their* silicon | **Vendor-neutral.** We don't care whose part you use. |
| **Altium / KiCad** — powerful, cold, silent; a drafting table with no opinions | An IDE: hover docs, drill-in, linting, suggestions — it *talks back*. |

## Landing page structure

1. **Hero** — the one-liner headline + the demo GIF (hover a regulator block → plain-English
   explanation pops + a green "15W, input OK" lint badge). One CTA: **Join the waitlist.**
2. **The problem** (their words, from interviews): "You drop in an IC because it's easy. Six
   parts later you've got a schematic you can't actually explain. Discrete is clearer — but
   nobody's tooling rewards you for it."
3. **How it works — the three layers** (from concept.md):
   - Blocks that hold their own spec + intent
   - Hover to see inside — discrete *or* IC, no black boxes
   - Lightweight checks: just the math on the numbers you declared (no SPICE)
4. **The "see inside" moment** — a short clip drilling a block open into its parts with the
   "why each part is here" annotations. This is the product's soul; show it.
5. **What it's not** — "Not a simulator. Not an AI that designs for you. Not locked to one
   chipmaker." (Pre-empts the "is this just X?" comments.)
6. **The payoff** — design → PCB → "add to cart": build it yourself on perfboard, or order
   it made. (Frame as the horizon, waitlist for now.)
7. **CTA + credibility** — waitlist email capture, "built by US Nylon," your face/name. Solo
   builders convert better when they're a person, not a faceless "we."

## Headline options to A/B
- "Nothing is a black box."
- "The schematic tool that explains itself."
- "Stop placing parts you don't understand."
- "An IDE for circuits — hover docs, linting, and all."

## Short pitch (for yourself, partners, or a future "about")

> Most electronics tools are silent drafting tables (Altium, KiCad) or AI black boxes that
> design *for* you (Flux, CELUS). Both leave you not understanding your own board. We're
> building the opposite: a block-based schematic tool where every block — discrete or IC —
> explains what it does in plain language, and lightweight checks catch you the instant
> your declared voltages, currents, and power don't add up. No simulation, no AI guessing,
> vendor-neutral. It's the "IDE moment" electronics never had: hover docs, go-to-definition,
> and linting for circuits. We start with the hobbyist-to-intermediate maker stuck between
> toy simulators and cold pro tools, and grow into a design→PCB→order pipeline. Built and
> backed by US Nylon.

## Why this is honestly defensible (so the pitch isn't hype)
- The **moat is the self-explaining block library**, which compounds and which the
  AI/automation players architecturally don't build (they infer or generate instead).
- **Vendor-neutrality** is something TI/ADI *cannot* copy without abandoning their business.
- **Determinism/trust** is a real wedge against LLM copilots that can't promise correctness.
- The one company that proved the hardware dream (Geppetto) died from vendor-lock + zero
  transparency — the exact two things we're built to avoid.


---

## External validation + the agent-native angle (2026-06-09)

An unprompted assessment from a GPT-5.5 session that had just BUILT a design through Sparky
independently re-derived the wedge (intent layer + deterministic checks + functional blocks)
— and added two things our docs underweight:

1. **"Agent-native EDA" is a positioning asset in its own right.** Traditional EDA is
   coordinate-heavy, visually implicit, and unsafe to mutate; Electrace exposes blocks /
   terminals / nets / connectors / checks — "closer to what AI needs than normal CAD tools."
   Even for users who never think in those terms, the payoff is: ask in natural language,
   get a real design mutation. Rare, and worth saying out loud in positioning.

2. **A sharper pitch line** (verbatim, keep):
   > Electrace is a block-based electrical design IDE for embedded hardware: capture
   > circuits as reusable functional blocks, get live structural checks and power budgets,
   > use AI to assemble and wire real BOM-backed schematics, then export to KiCad when you
   > need full traditional EDA.

3. **Persona note (⟂ owner call, not a change):** it ranked "embedded firmware engineers
   who also make boards" as the strongest pull — adjacent to, but sharper than, our locked
   hobbyist-to-intermediate beachhead. Same tool either way; worth watching which persona
   actually converts once traffic exists.

4. Its risk list (trust framing, library quality over size, clean KiCad escape hatch,
   debuggability, never hiding too much) matches the existing strategy docs 1:1 — treat
   that convergence as confirmation the docs are aimed right.
