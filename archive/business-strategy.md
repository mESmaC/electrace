# Business Strategy — how Electrace makes money

_The commercial strategy (not the admin — that's [business-setup.md](business-setup.md)).
Decisions locked where marked. Builds on the verified wedge in
[competition.md](competition.md)._

## Locked decisions
- **Primary revenue engine:** Freemium SaaS **+ BOM affiliate** revenue.
- **Paywall axis: public-free, private-paid** (GitHub / Thingiverse model), **plus a free
  design-count cap**. The cap is on **designs, not blocks**: designs carry real per-user
  storage cost, while blocks are mostly text (cheap), so blocks are never capped. Set the
  design cap generous enough to learn and prototype freely. Teams/commercial tier is *planned
  now, built later.*
- **Beachhead customer:** individual **hobbyist-to-intermediate makers** who want to
  *understand* their circuits, not just place parts.
- Marketplace and hardware/kitting are **later expansion layers**, not launch.

## The revenue engine (detail)

### The paywall: public-free, private-paid (+ a free design cap)
The line is drawn on **privacy and commercial value**, plus a **generous design cap** that
keeps free storage cost bounded. The balance to hold: **don't lose money on free users, but
don't limit them so hard the understand-loop stops feeling like a gift.** Real value *and*
perceived value both matter — a cap high enough to learn and prototype without friction reads
as generous while still protecting unit economics. Blocks are never capped (cheap text, and
free users authoring blocks *strengthen* the product).

- **Free (Hobby) — generous, forever.** The whole understand-loop (blocks, hover/drill,
  expand-to-discrete, lint, ANSI/IEC, themes), **up to 10 public designs**, community blocks,
  basic export, and **no cap on blocks**. Passively funded by BOM affiliate.
  - *Public = discoverable like a public repo* → feeds the SEO flywheel, the community, the
    marketplace, and social proof. Free hobbyists who design in the open make the corpus
    bigger and the product better.
  - The **10-design cap** is the one real limit. Designs carry per-user storage cost, so the
    cap bounds what a free user costs us; it's set high enough that hitting it means you're a
    real user, not a tinkerer being taxed — the natural, fair nudge toward Pro. *(Tune the
    number from cost + conversion data.)*
- **Pro (individual) — for privacy + shipping.** **Unlimited designs (cap lifted) + private
  projects**, manufacturing-grade exports (Gerber / BOM / CPL), version history, advanced
  checks, a private block library, priority. The people who pay are the ones with commercial
  intent or who need to actually ship. *Price TBD — set from the validation pricing probe.*
- **Team / Org — planned, built later.** Shared workspaces, collaboration, roles, SSO,
  admin/billing. Likely the largest recurring line eventually; not a launch concern.
- **Transactions — all tiers, from launch.** BOM affiliate commissions now; PCB/kitting
  order margin and the marketplace cut later. Money flows when hardware gets built,
  regardless of tier.

**Risks to manage:** (1) public-by-default can spook makers worried about IP — make the
*value* of sharing obvious and ship clear licensing/attribution; private projects are the Pro
answer. (2) Tune the 10-design cap so it reads generous, not coercive — high enough that
hitting it means you're a real user, not a tinkerer being taxed — and watch that free
storage cost stays comfortably below BOM-affiliate revenue per free user.

> **Internal only — do not leak into user-facing copy.** The reasoning here (storage
> economics, that blocks are cheap to store, the affiliate engine, the AI provider, the
> data/corpus flywheel, anything about how the backend works) is competitive IP. Public
> copy — pricing, FAQ, marketing, privacy, changelog — stays **value-framed**: users see what
> they get, never the cost model or the moat. Disclose only what's legally/ethically required,
> and generalize sub-processors (e.g. "a third-party AI provider", not the vendor name).

### Second stream from day one: BOM affiliate
- Because Electrace is **vendor-neutral** and helps pick parts, it can earn referral
  commissions from distributors (Digikey, Mouser, etc.) on the parts users order from a BOM.
- **This monetizes even free users without charging them** — and it's a stream the
  LLM/automation competitors are less cleanly positioned to take. Wire affiliate links into
  the BOM/"add-to-cart" path early.

### Later layers (don't build at launch)
- **Block marketplace** — take a cut of premium/community blocks. Needs a corpus + community
  that don't exist yet.
- **Hardware/kitting margin** — partner-based (AISLER/MacroFab), capital-light, last.

## The strategic core: the corpus IS the distribution

**The single most important strategic insight.** The self-explaining blocks are also SEO
content — every block's "what a buck converter does and why" page can rank for exactly what
learners search. So the product's content is *also* its top-of-funnel marketing:

> more blocks → more search traffic → more users → more contributed blocks → repeat

This ties the **moat** (the trustworthy corpus) directly to the **growth engine** (organic
search). Build every block with that dual purpose: it teaches a user inside the tool AND
ranks as a public explainer page outside it. This is the flywheel that compounds while you
sleep — prioritize it over paid/one-shot channels.

## Distribution (repeatable, beyond the one-time validation drop)
1. **Content/SEO flywheel** (above) — the durable, compounding primary engine.
2. **Community-led** — be genuinely useful in EE communities; let the demo spread. Not spam.
3. **Education as fast-follow** — once makers are working, the "explains itself" pitch sells
   to teachers/makerspaces and brings cohorts, not individuals. (Beachhead stays individual
   makers; education is the next segment, not a launch distraction.)

## Building the corpus (the real cost center)
The editor is cheap; the trustworthy library is the work and the moat.
- **Phase 1 — you seed it:** author ~20-50 high-value blocks (power entry, regulation, common
  stages, discrete↔IC pairs). These double as the launch SEO content.
- **Phase 2 — community contribution WITH curation:** trust is the whole product, so
  contributions must be reviewed/curated — you can't let garbage dilute the explanations.
- **Phase 3 — pay experts** for marquee/complex blocks if needed.

## Unit economics & resourcing
- SaaS serving cost is trivial; **the real cost is your time authoring the corpus.**
- Bootstrapped through US Nylon — no raise needed to start.
- **The runway question that actually matters:** can you sustain authoring the library while
  it's pre-revenue, and for how long? That's the real constraint, not valuation. Answer it
  before going all-in.

## Defensibility (why this is a business, not a feature)
Corpus + community + vendor-neutrality + the content flywheel — a stack none of the
near-competitors can copy without abandoning their own pitch:
- **Flux/AllSpice** would have to abandon LLM-inference for authored determinism.
- **CELUS/JITX** would have to stop automating and start explaining.
- **TI/ADI** can never be vendor-neutral.
- **Geppetto** proved the demand and died from vendor-lock + opacity — the two things we're
  built to avoid.

## What to decide AFTER validation (don't pre-guess)
- Exact free/paid feature line and price point (validation pricing probe informs this).
- Which distributor affiliate program(s) to integrate first.
- When to open community contribution vs. stay curated-only.

## Pre-ship business punch list
1. Lock the free-tier scope = the full understand-your-circuit loop (it's the marketing).
2. Identify the first distributor affiliate program(s) to wire into the BOM path.
3. Seed plan for the first ~20-50 blocks (which ones, in what order — power first).
4. Set up the SEO-content structure so block explanations are publicly indexable pages.
5. Answer the personal runway question (how long can you author pre-revenue).
