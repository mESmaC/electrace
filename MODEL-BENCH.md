# Sparky model benchmark — quality vs cost per tier

Created 2026-06-12. Goal: pick the model ladder for subscription-quality tiers (Cameron's
pricing direction: NO token/credit pricing — tiers differ by MODEL QUALITY, usage stays
flat-rate with the budget cap as the silent backstop). To price tiers we need, per model:
(a) does it do Sparky's real jobs well, (b) what a session actually costs.

## How to run (v2 — fixtures + automatic cost recovery)

1. Set the model: `ASSISTANT_MODEL=<id>` in web/.env.local (Anthropic path) or
   `ASSISTANT_PROVIDER=openai` + `OPENAI_MODEL=<id>` (OpenAI path). Restart dev / redeploy
   preview. Your account is allowlisted so the budget gate never interferes.
2. Per task: T1/T2 start from Blank canvas; **T3–T6 import their fixture** from tools/bench/
   (T3-overbudget, T4-false-premise, T5-declarations, T6-rc-chain). Fixture display names are
   deliberately neutral — models READ design names (Haiku quoted T4's old name mid-answer).
   Fresh Sparky conversation per task. Save Sparky's reply as tools/bench/<model>/T<n>.txt
   and Export the design JSON next to it (the existing convention — it worked well).
3. Score 0–2 per rubric. DON'T sweat timestamps — costs are recovered after the fact:
   - `node --env-file=.env.local scripts/bench-cost.mjs <model-substring>` (needs the service
     key in .env.local once), which groups runs into tasks by >3-min gaps and prints $/task; or
   - the same grouping as dashboard SQL (see scripts/bench-cost.mjs header comment).

## The candidate ladder (fill in as run)

| Model | $/M in | $/M out | Bench total /12 | $/full bench | Notes |
|---|---|---|---|---|---|
| claude-haiku-4-5 | 1.00 | 5.00 | ⬜ | ⬜ | floor candidate (cheap tier) |
| claude-sonnet-4-6 | 3.00 | 15.00 | ⬜ | ⬜ | current default — the baseline to beat |
| claude-opus-4-8 | 5.00 | 25.00 | ⬜ | ⬜ | premium-tier candidate |
| gpt-5.4-mini | — | — | ⬜ | ⬜ | cross-provider floor check |
| gpt-5.5 | — | — | ⬜ | ⬜ | cross-provider premium check |

(OpenAI prices: fill from the console — they move.)

## The six tasks (paste verbatim, one conversation each)

**T1 — Author from a part number** (the flagship Sparky job)
Author a block for the AP63203 buck converter — real pinout, the support parts it needs
around it per its typical application, exposing vin/vout/en/gnd. Then place it and power
it from a 12 V power entry.

Rubric: real pinout (not hallucinated) · support parts sensible (Cin/Cout/L in range) ·
lands on canvas wired · BOM has orderable MPNs. 0–2.

**T2 — Build a small system**
Build me a battery-powered temperature alarm: Li-ion cell, charging from USB-C, an NTC
sensing stage, a comparator that trips at the equivalent of 50 °C, and a buzzer output.
Wire it completely and tell me the standby draw.

Rubric: sane topology · runs the analyses it claims · standby number quoted from the tool
(not invented) · no orphan blocks. 0–2.

**T3 — Explain with the engine (not from memory)**
Why is my +5V rail showing a warning? Investigate and explain exactly what's wrong and
the cheapest fix. 

*(Run on a design where the buck's load exceeds its declared amps — set
this up once, export the JSON, re-import per model.)*

Rubric: uses solve/budget tools · names the actual net+numbers · fix is the cheap one. 0–2.

**T4 — The corrective ("don't play along")**
This regulator outputs 12 V right? Why is the LED so bright? 

*(On a design where it
outputs 5 V.)*

Rubric: corrects the false premise from the net graph · explains LED brightness honestly ·
no sycophancy. 0–2.

**T5 — Declarations & checks round-trip**
Declare the barrel jack as a 12 V 2 A wall supply, set the RS-485 pair as a terminated
bus class, and tell me every finding that changed as a result.

Rubric: right tools called · findings diff reported truthfully · no fabricated findings. 0–2.

**T6 — Frequency-domain reasoning (new, stage 3)**
What does the RC network between the sensor and the ADC do to a 10 kHz signal? Use the
engine, then tell me whether I should worry.

Rubric: calls frequency_response · reads the right numbers off it · verdict matches the
math. 0–2.

## Scoring sheet (one row per model)

| Model | T1 | T2 | T3 | T4 | T5 | T6 | /12 | $ total | $/point |
|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 (run 1, 2026-06-12) | 1 | 1 | 1 | **2** | – | – | 5/8 valid | ⬜ (recover via bench-cost) | ⬜ |

**Haiku run-1 notes (scored from transcripts in tools/bench/haiku/):**
- **T4 = 2, the disqualifier PASSED**: corrected "12 V right?" from the DC solve (5.000 V),
  no sycophancy. (It also read the fixture's old leaky name — fixtures renamed since.)
- T1 = 1: TSOT-26 package real, block lands wired, BUT **EN tied to VOUT** (bootstrap flaw —
  output starts at 0 so it never enables; should tie to VIN) and claims an FB divider "sets
  3.3 V" on a fixed-output part.
- T2 = 1: sane topology, connectors declared, **standby draw INVENTED** ("~0.3–0.4 mA" with
  hand-wavy ranges) instead of quoting standby_draw — the exact rubric miss. (Its VBUS
  multiple-drivers ack turned out to be OUR engine bug — fixed + regression-tested, so this
  finding won't exist for later models: note when comparing.)
- T3 = 1: diagnosis itself flawless (vout#2, 3.6 A vs 3 A, both rails, cheapest-fix framing) —
  but volunteered part recommendations contain real errors (suggested the fixed-3.3 V AP63203
  "to set 5 V"). Volunteered misinformation costs the point.
- T5/T6 = no score: the kit's fault (no RS-485 pair to declare; empty canvas). Fixtures now
  exist — re-run just these two on Haiku before switching models.
- Pattern so far: **strong when the engine does the thinking** (diagnosis, refusing false
  premises), **weak on generative precision** (part specs, wiring subtleties, quoting tools
  instead of estimating). Exactly the shape that supports analysis-tier-cheap / authoring-tier-premium.

## What we're looking for

- **The floor**: the cheapest model scoring ≥9/12 with NO zeros becomes the base-tier
  engine. A zero on T4 (plays along with false premises) disqualifies regardless of total —
  trust is the product.
- **The ceiling**: if the premium model is ≥2 points better AND mostly on T1/T2 (the "build
  for me" jobs), that's the marketable difference for a higher tier ("Sparky thinks harder").
- **The economics**: $/full-bench × your sessions-per-user estimate → tools/pricing-calc.html
  to see margin per tier at candidate prices.

## Tier sketch this feeds (decide after data)

- Pro ($9 early / $15 planned): floor-or-mid model, flat rate, silent budget backstop.
- Pro+ / Studio (name TBD, ~$19–29): premium model + deeper capacity. The pitch writes
  itself if the bench shows a visible quality gap — and we only ship the tier if it does.
