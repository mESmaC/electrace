# Business Setup — steps before shipping

_The non-development groundwork for launching **Electrace** as a US Nylon product line.
Staged by shipping phase — do NOT front-load all of it; match the work to the stage you're
actually at. (Not legal/tax advice — this flags **where** to get a professional, not a
substitute for one.)_

## Context (decided)
- US Nylon is a **formally founded entity with a written partner agreement.** ✓
- Partners split workload; **Cameron owns legal, finance, and software** — this is his lane.
- First users **mostly US.**
- Electrace launches as a **product line under US Nylon**, on a subdomain.

This means the heavy "form a company / personal-liability" work is already DONE. The
foundation is solid; what remains is mostly product-line hygiene and stage-gated compliance.

## Foundation — confirm once, then move on
- [ ] **IP/ownership check (5 min):** confirm the written agreement's treatment of
  company-created IP/assets covers a new software product line, and that partners are aligned
  Electrace is a US Nylon product (owned per the existing split). Most agreements cover this —
  just verify, no drama.
- [ ] **Code/brand owned by the entity:** make sure the Electrace repo, accounts, and the
  "Electrace" name are held by/under US Nylon, not floating in a personal account, before it
  has any value.

## Stage 0 — before the free demo + waitlist goes live (LIGHT — don't over-build)
- [ ] **Privacy policy** — the moment you collect waitlist emails you have obligations
  (CAN-SPAM for the emails; CCPA likely doesn't apply yet, it has revenue/volume thresholds
  you're well under). A solid template is fine at this stage.
- [ ] **Basic Terms + disclaimer** — short "no warranty, use at your own risk, this is an aid
  not professional engineering judgment." Template-level is fine for a free tool.
- [ ] **Compliant email capture** — use a provider (Resend, ConvertKit, Mailchimp) that
  bakes in unsubscribe + opt-in so you don't hand-roll compliance.
- [ ] **Know the community rules** before posting the demo — r/AskElectronics, EEVblog, etc.
  have self-promotion rules; getting banned on day one wastes your best channel.

That's the whole Stage 0 list. Resist doing Stage 1 work here.

## Stage 1 — before you charge money
- [ ] **Payments + sales tax.** Default is Stripe, but for a solo operator a **Merchant of
  Record** (Paddle, Lemon Squeezy) becomes the seller of record and handles US state
  sales-tax registration/remittance for you — and US SaaS sales tax is genuinely messy
  (taxability varies state-to-state, economic-nexus thresholds). Trade-off: higher % fee for
  near-zero tax/compliance burden. **Recommendation: start with an MoR**; revisit Stripe-direct
  only if fees become material at scale.
- [ ] **Lawyer-reviewed Terms of Service** (not a template now) — subscriptions, refunds,
  acceptable use, termination, and the liability limits below.
- [ ] **Bookkeeping:** track Electrace revenue/costs as a distinct line within US Nylon's
  accounting, so you can actually tell if it's profitable. (Your lane — finance.)
- [ ] **Pricing decided** — informed by the validation pricing probe (see validation.md).

## Stage 2 — before any hardware/kitting (heavy; its own project — keep OUT of v1)
- [ ] **Product liability** changes entirely once a physical good ships — warranty, returns,
  consumer-protection law.
- [ ] **Fulfillment-partner contracts** (AISLER/MacroFab) — terms, margins, who owns the
  customer relationship, what happens on defects.
- [ ] **Insurance** (general liability / E&O) becomes worth pricing here.
- This is where Geppetto got capital-heavy and vendor-locked. Deliberately deferred.

## The liability callout — specific to Electrace
Electrace gives **engineering guidance** (a green "input OK" / red "OVER" badge). If a user
trusts that, builds it, and it overheats — or they're working near mains voltage and get
hurt — that's real exposure. So before *anyone* relies on real outputs:
- Prominent, repeated **disclaimers**: aid not authority, no warranty of accuracy, user
  assumes all risk, verify against datasheets and professional judgment.
- This matters more for an EE tool than for most software, and warrants real lawyer attention
  at Stage 1 (paid), not just at Stage 2 (hardware).

## NOT blocking — don't let these stall you
Logo polish, a dedicated domain (subdomain is fine), trademark registration, separate entity
for Electrace, business insurance, formal investor docs. All wait for traction. Doing them
now is procrastination dressed as diligence.

## Sequenced punch list (going-hard pace)
1. IP/ownership confirmation glance + ensure repo/name held under US Nylon. *(this week)*
2. Stand up demo → landing page with privacy policy + disclaimer + compliant email capture.
3. Run the validation sprint (validation.md).
4. **Only if validation says go:** MoR payment setup, lawyer-reviewed ToS, pricing, bookkeeping
   line → then charge.
5. Hardware/kitting business work — later, separate effort.
