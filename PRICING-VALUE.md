# Feature value map — what things cost us vs what they're worth

Created 2026-06-12, the other half of COST-MODEL.md. Method: for each feature group,
(a) marginal cost-to-serve, (b) a concrete user-value anchor (what failure it prevents or
what the alternative costs), (c) its funnel role, (d) the tier implication. Pricing follows
from the table, not vibes.

## Market anchors (checked 2026-06-12)

| Comparable | Price | What it tells us |
|---|---|---|
| KiCad / EasyEDA / LTspice | $0 | full-featured EDA is free — we can't charge for *drawing*; we charge for *understanding + judgment* |
| CircuitLab (browser sim) | hobbyist from ~$24/yr | hobbyists DO pay small recurring for browser EE tools |
| Flux.ai Starter / Pro | $20 / $142 per mo, AI metered in credits | browser EDA + AI supports real price points; **everyone meters the AI** |
| Altium/pro suites | $100s/mo | the professional ceiling; not our segment yet |
| One burned proto board | $20–100 + days of waiting | the engine's value unit |
| One PCB respin | $50–500 + 1–3 weeks | the checks' value unit at the fab step |
| One evening of debugging | priceless to a hobbyist; $50–150/hr commercially | the explain-why value unit |

Our $9 sits in the empty space between CircuitLab (~$2–8/mo, sim-only) and Flux Starter
($20, full EDA + metered AI). That's a defensible position, and it means $9 is, if anything,
**low** once the feature set is verified — not high.

## Feature value table

| Feature group | Marginal cost | User-value anchor | Funnel role | Tier today | Implication |
|---|---|---|---|---|---|
| Block editor + explain-why + drill-in | ~$0 (client-side) | replaces hours of datasheet archaeology | **Acquisition** — the demo IS the product | Free | keep free forever; this is the top of every funnel |
| Checking engine (volts/amps/shorts/polarity) | ~$0 (client-side) | one caught over-voltage = a saved board = 1+ year of Pro | **Acquisition + trust** | Free | keep free — it's the credibility that sells everything else |
| DC solver, Thévenin, standby, diode honesty | ~$0 (client-side) | replaces hand analysis / a SPICE detour | Trust + retention | Free | free is right; this is the moat demo |
| AC / Bode (stage 3) | ~$0 (client-side) | replaces a sim setup for "what does my filter do" | Trust + retention | Free (new) | keep base free; **depth features** (data export, multi-trace compare, saved sweeps) are natural Pro later |
| SI classes + isolation verification | ~$0 | professional failure classes (field returns, safety) | **Conversion** — pros need it | Pro | correct as-is — value scales with user's stakes, not our cost |
| Private designs | ~$0 | non-negotiable for commercial work | **Conversion** (the classic) | Pro | correct; strongest Pro driver per SaaS norms |
| Exports (BOM CSV, .kicad_pcb) | ~$0 | the bridge to real manufacturing | **Conversion** — gates the "ship it" moment | Pro | correct; the moment of highest intent |
| Version history (5 free / 200 Pro) | storage cents | insurance: one bad edit recovered pays for itself | Retention + conversion teaser | Freemium | correct shape; depth is the paid part, taste is free |
| Sparky | **$0.10–1+/session — our ONLY real COGS** | an assistant that wires real circuits | Conversion + wow | Pro | must stay Pro + budget-capped (Flux meters theirs too — industry-validated). Future: usage tiers (DECISIONS #6) |
| Unlimited designs (vs 10) | storage cents | matters to power users only | Conversion (mild) | Pro | fine as a supporting bullet, never the headline |
| Calculators / glossary / check docs / videos | $0 marginal (fixed production cost) | free utility + education | **Acquisition** (SEO/YouTube) | Free | the content flywheel; monetizes indirectly via affiliates + funnel |
| PCB fab/affiliate placements (planned) | $0 | user already wants the thing at that moment | **Monetization w/o pricing** | n/a | revenue per free user without touching tiers |

## What the table says about pricing

1. **The current free/Pro split is fundamentally sound**: everything free costs ~nothing and
   builds trust; everything Pro is either a professional necessity (privacy, exports, SI),
   a depth upgrade (history), or the one real cost (Sparky). No mispriced rows found.
2. **$9 is an early-adopter price, and that's fine — say so forever.** The anchors support
   $12–15 once VERIFICATION passes and there's a testimonial or two. Grandfather early subs
   at $9 permanently: cheap loyalty, great story, zero lost revenue (they wouldn't churn-up).
3. **Sparky is the only feature whose cost scales with usage → it's the natural axis for a
   future higher tier** (more included capacity / better model), exactly as DECISIONS #6
   sketches and exactly as Flux prices ACUs. Don't bundle unlimited Sparky into anything.
4. **Don't gate stage-ladder analysis (DC/AC) on Pro.** It's free to serve and it's the
   differentiation engine — gating it would starve the funnel to protect $0 of cost. Gate
   *depth and workflow* (saved sweeps, comparisons, exports), never *understanding*.
5. **The "value unit" for all marketing copy**: one saved board / one avoided respin.
   Concrete, believable, and ≥ a year of Pro. Use it everywhere pricing is justified.

## Open questions (for DECISIONS.md when data arrives)

- Beta price point for NEW subs ($12? $15?) — decide after ~10 Pro subs + usd_per_user data.
- Sparky usage tier naming/sizing — after real usage distribution exists.
- Whether AC-depth features (sweep export, compare) are worth building AS Pro features
  vs letting the base be maximally impressive for acquisition. Lean: funnel first.
