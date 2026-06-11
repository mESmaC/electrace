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

## Phase A — Finish the thesis features — ✅ COMPLETE 2026-06-09

- [x] Merge the `expand-to-discrete` branch to main
- [x] Shell blocks — were already complete (all 7 validated: every terminal exposed)
- [x] Wire-junction tap binding bug — taps now bound `{wire, t}`, survive moves/Align
- [x] On-canvas block status + declared-spec line + IC/DISC tag — verified live
- [x] Spec-search / `find_blocks` — core matcher (tested) + Sparky tool + palette box

## Phase B — Cloud backend — ✅ COMPLETE 2026-06-09

- [x] Supabase provisioned + migrations 0001/0002 applied (user ran the SQL)
- [x] Drizzle schema: users + designs (P1 scope; revisions/events deferred per storage.md)
- [x] Real auth — shipped earlier via Supabase (email + GitHub/Google OAuth)
- [x] `/forgot-password` + `/reset-password` (confirmation lands on /auth/callback)
- [x] `/api/designs` CRUD, queries run AS the user → RLS enforces; verified live
- [x] Visibility enforced IN POSTGRES (public/unlisted read; private = owner + Pro)
- [x] localStorage → account import (reconcileDesigns, both directions, newer wins)
- [x] PCB layout persisted with the design (`designs.pcb`)
- [x] `/share/[id]` public read-only page + editor Share menu + open-a-copy fork

## Phase C — Monetization rails

### Subscriptions (Pro)
- [x] Stripe: products + Checkout + portal + webhook → users.plan — ✅ live in prod
      (env verified 2026-06-09: checkout 401s for anon, webhook rejects unsigned)
- [x] Server-enforced gates: private = Pro (in Postgres RLS), 10-design cap at create
- [ ] Pro-only version history — deferred with `design_revisions` (P3, storage.md)
- [ ] Pricing page shows no Pro number yet (deliberate) — set it when the price is locked
- [ ] Billing terms blurb in `/terms` + the end-to-end test purchase (owner: test-mode
      or live+cancel — pending)

### BOM affiliate
- [x] MPN as a first-class field — ✅ already existed (`PartSpec.part` = "mpn / family", chips carry `chip.mpn`); flows into BOM rows. Library backfill happens with the Wave-1 authoring (Phase D)
- [ ] Server-side route: MPN → Digi-Key product URL/price/stock via the Product
      Information API (free registration, OAuth2 client-credentials; cache with TTL,
      keys never client-side) — v2; v1 ships search links + cart push without any API keys.
      Affiliate wrapping is ready: set NEXT_PUBLIC_AFFILIATE_LINK_TEMPLATE once approved
- [x] BOM view — ✅ 2026-06-09: per-line "buy ↗" links (part number, else value+package), CSV
      download, and whole-BOM "Send to Digi-Key" via the MyLists endpoint (verified live:
      real BOM → working cart URL). Note: live API returns a bare short-URL string, not the
      documented `{singleUseUrl}` — the route accepts both
- [x] FTC disclosure — ✅ shown under the BOM panel, exactly as drafted
- [ ] **After Phase D content is live:** apply to the Digi-Key affiliate program through
      its network (Impact) — programs reject empty sites, so sequence matters
- [ ] **Open question to resolve before relying on cart-push revenue:** does a
      MyLists-API-created cart credit the affiliate? Ask Digi-Key affiliate support
      whether the single-use URL can be wrapped/tagged with tracking

## Phase D — Content engine (the no-outreach marketing)

The corpus IS the distribution (business-strategy.md). This phase is also the affiliate
application prerequisite.

- [x] Public SSG block explainer pages — ✅ 2026-06-09: question-form titles ("Buck
      Converter — what it does and how it works"), meta descriptions from explain.md,
      TechArticle JSON-LD, canonical URLs, the actual schematic rendered, per-part whys,
      an "Inside the chip" discrete-equivalent section, related-block links, signup CTA.
      Spec-search wired into the /blocks index too. (Per-block OG images: later polish)
- [ ] `sitemap.xml` ✅ (already lists block pages) → **human step: add the site to Google
      Search Console + submit the sitemap + verify indexing**
- [x] Wave 1 blocks — ✅ 2026-06-09: USB-C 5V input, Li-ion charger (TP4056), reverse-polarity
      protection, boost converter, input protection (fuse+TVS), voltage divider. All validated
      (terminals exposed, drawn layouts render); each with explainer prose + failure-mode notes.
      Also FIXED a real bug in power-entry (P-FET was input-to-source; correct is input-to-drain).
      Discrete equivalents for the boost/charger ICs: deferred to the 555/comparator batch
- [ ] Author wave 2 blocks (GPIO-to-world): MOSFET low-side switch, relay driver,
      H-bridge (+ discrete equivalent), I2C level shifter, debounced button,
      constant-current LED driver
- [ ] Every block ships with: filled internals, explanation prose, a failure-mode note,
      and a discrete equivalent where reducible (each block = product content + SEO
      page + expand-to-discrete demo, all at once)
- [x] ~~Execute the domain-recategorization checklist~~ — ✅ the observed blocker is clear:
      FortiGuard recategorization submitted + confirmed open, mail records (SPF/DKIM/DMARC)
      in DNS (2026-06-09). Remaining vendors in [domain-reputation.md](domain-reputation.md) §1
      are opportunistic; the NRD window also ages out ~2026-07-07 on its own

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
