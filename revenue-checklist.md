# Revenue-ready checklist

_The ordered path from today's build to "a stranger can sign up, pay, and Electrace earns
on the parts they order." Companion to [business-strategy.md](business-strategy.md)
(the why) and [todo.md](todo.md) (the full gap backlog — items here reference its
sections). This list is deliberately the *minimum* revenue path, not everything._

**Definition of revenue-ready:** a stranger can discover a public block page from search
or an ad → sign up → build → hit the design cap or want a private project → pay via
Stripe → and the BOM "Buy" links earn affiliate commission. Two revenue streams live:
Pro subscriptions + BOM affiliate.

**Marketing constraint (locked):** all channels are no-outreach — SEO, paid ads, YouTube
Shorts, embeds, one-way submissions. Nothing below depends on community engagement.

---

## Phase A — Finish the thesis features (current sprint)

The demo has to be true before anyone pays for it.

- [ ] Merge the `expand-to-discrete` branch to main (it's the headline; todo.md §2 marks
      it absent — update todo.md when merged)
- [ ] Fill internals + layouts for the 6 shell blocks (wave 0 of the block plan —
      hollow blocks contradict the "nothing is a black box" pitch)
- [ ] Fix the wire-junction tap binding bug (todo.md §6 — it silently breaks
      connectivity, which is a correctness-moat violation)
- [ ] On-canvas block status + declared-spec line (todo.md §2 — the most visible
      build-vs-mockup gap; this is what screenshots/ads will show)
- [ ] Spec-search / `find_blocks` (todo.md §2 — cheap, and it's the "WEBENCH answer"
      used in marketing copy)

## Phase B — Cloud backend (the gate for everything paid)

All of todo.md §4's storage/accounts half. Nothing can be sold without accounts.

- [ ] Provision Supabase: create project, set `DATABASE_URL` + keys in Vercel (human step)
- [ ] Drizzle schema (`web/db/schema.ts`): users, designs, design_revisions, events
- [ ] Real auth via Auth.js: email/password + Google + GitHub OAuth (watch the OAuth
      redirect gotchas in memory `deployment`)
- [ ] `/forgot-password`, `/reset-password`, `/verify-email` flows
- [ ] `/api/designs` CRUD with ownership + RLS (`public OR owner = auth.uid()`)
- [ ] **Enforce** `visibility` (public/private/unlisted) — the field exists, nothing
      reads it; private must actually be private before it can be a paid feature
- [ ] localStorage → account import on first sign-in (don't strand existing local work)
- [ ] PCB layout persisted with the design record (today: localStorage only)
- [ ] Public design share pages (`/share/[id]`, SSG, good OG images) — every public
      design becomes marketing surface

## Phase C — Monetization rails

### Subscriptions (Pro)
- [ ] Stripe: Pro monthly + annual products, Checkout, customer portal, webhook handler
      (subscription created/updated/canceled → user tier)
- [ ] Server-enforced gates: private designs = Pro; free tier = 10 public designs
      (cap on designs, never on blocks — locked in business-strategy.md)
- [ ] Pro-only: version history once `design_revisions` exists; keep the rest of the
      free tier generous (the understand-loop is the marketing)
- [ ] Pricing page — value-framed copy only (memory `ip-protective-copy`); launch price
      in the $9–10/mo band, annual discounted, revisit with real conversion data
- [ ] Billing terms added to `/terms`; upgrade/downgrade/cancel flows tested end-to-end

### BOM affiliate
- [ ] MPN (manufacturer part number) as a first-class field on parts; backfill the library
- [ ] Server-side route: MPN → Digi-Key product URL/price/stock via the Product
      Information API (free registration, OAuth2 client-credentials; cache with TTL,
      keys never client-side)
- [ ] BOM view: per-line "Buy" links + whole-BOM "Send to Digi-Key cart" via the
      MyLists third-party endpoint (no auth required, returns single-use cart URL)
- [ ] FTC disclosure near the BOM: "Electrace may earn a commission on parts ordered
      through these links, at no extra cost to you. Links never influence part
      recommendations." (the second sentence is vendor-neutrality positioning)
- [ ] **After Phase D content is live:** apply to the Digi-Key affiliate program through
      its network (Impact) — programs reject empty sites, so sequence matters
- [ ] **Open question to resolve before relying on cart-push revenue:** does a
      MyLists-API-created cart credit the affiliate? Ask Digi-Key affiliate support
      whether the single-use URL can be wrapped/tagged with tracking

## Phase D — Content engine (the no-outreach marketing)

The corpus IS the distribution (business-strategy.md). This phase is also the affiliate
application prerequisite.

- [ ] Public, statically-generated block explainer pages — indexable, one per block,
      titled as the question learners search ("how does a buck converter work"),
      proper meta + OG images + structured data
- [ ] `sitemap.xml` + Google Search Console + indexing verified
- [ ] Author wave 1 blocks (power spine): USB-C 5V input, Li-ion charger,
      reverse-polarity protection, boost converter, input protection (fuse+TVS),
      voltage divider/reference
- [ ] Author wave 2 blocks (GPIO-to-world): MOSFET low-side switch, relay driver,
      H-bridge (+ discrete equivalent), I2C level shifter, debounced button,
      constant-current LED driver
- [ ] Every block ships with: filled internals, explanation prose, a failure-mode note,
      and a discrete equivalent where reducible (each block = product content + SEO
      page + expand-to-discrete demo, all at once)
- [ ] Execute the domain-recategorization checklist
      ([domain-reputation.md](domain-reputation.md)) — FortiGuard et al. blocking
      electrace.net throttles every channel including ads

## Phase E — Launch ops + paid channels

- [ ] Error monitoring (e.g. Sentry) + uptime check on electrace.net
- [ ] Privacy-friendly analytics (e.g. Plausible) with conversion events:
      sign-up, cap-hit, checkout-started, checkout-completed, BOM-link-click
- [ ] Verify Supabase backups/PITR; test a restore once
- [ ] Changelog current in `electrace-info.ts` (per standing habit)
- [ ] Shorts pipeline (no face/voice needed): screen recording + captions/auto-TTS;
      30s clips of expand-to-discrete on a 555, finding-highlight on canvas,
      parametric Vout re-derivation; 1–2/week, each linking a block page
- [ ] Google Search ads — small test budget ($150–300/mo), exact/phrase match on
      high-intent queries ("online schematic maker", "circuit design tool free",
      "kicad alternative beginner"); judge by sign-up cost, not clicks
- [ ] Reddit ads as a cheap second test (interest targeting reaches r/electronics-type
      audiences without posting)
- [ ] Optional, one-way only: Hackaday tips-line submission (a form, no conversation)

---

## Sequencing notes

- A → B → C(subscriptions) is strictly ordered. C(affiliate) and D can interleave with B —
  block authoring is editor-side work and needs no backend.
- The affiliate *application* is gated on D (live content), so wire the code path early
  and flip links on when approved.
- Ads (E) are a thermometer, not the engine: at hobbyist price points, paid acquisition
  roughly breaks even at best. Their job is to test conversion and generate early users
  while SEO compounds. The durable engine is Phase D.
