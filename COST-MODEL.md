# Cost model — what running Electrace actually costs

Created 2026-06-12 (Cameron: "we don't have a cost model; we don't know how much to charge").
Half of this is derivable from the codebase and is filled in below; the other half is six
numbers from dashboards — placeholders marked ⬜. Update quarterly or when a tier changes.

## The shape of the answer (read this first)

1. **The checking engine costs us ~nothing per user.** resolve/lint/solve run **client-side**
   in the browser. The heaviest, most differentiating feature has zero marginal server cost.
   This is the structural reason the free tier is safe to scale.
2. **The only cost that can drown a subscription is Sparky** (Anthropic API), and it is
   Pro-gated with a fully built but **currently UNSET budget gate**. One env var stands
   between us and a heavy user burning more API than their $9.
3. Everything else (storage, bandwidth, auth) is cents per user per month, with **cliffs**
   where free infra tiers end — the "offline in a day" risk is those cliffs, not the slope.

## Revenue per Pro sub (known)

| | monthly | yearly (if added at $90) |
|---|---|---|
| Sticker | $9.00 | $90.00 |
| Stripe fee (2.9% + $0.30) | −$0.56 | −$2.91 |
| **Net** | **$8.44/mo** | **$87.09 ≈ $7.26/mo** |

## Variable costs per user

### Sparky (Pro users only) — THE number that matters

- Model: Sonnet-class (`ASSISTANT_MODEL`, default claude-sonnet-4-6): $3/M in, $15/M out,
  $0.30/M cached-in. Every run is metered into `sparky_usage` with computed `cost_usd`.
- Rough per-session cost (build-a-circuit conversation, heavy tool use, caching working):
  $0.10–0.50 typical, $1+ for big multi-spark ports. A daily heavy user can plausibly burn
  **$15–30/month — more than the $8.44 net sub**.
- **Real data beats estimates — we're already collecting it.** Run monthly:
  ```sql
  select date_trunc('month', created_at) as mo, count(distinct owner_id) as users,
         count(*) as runs, round(sum(cost_usd), 2) as usd,
         round(sum(cost_usd) / nullif(count(distinct owner_id), 0), 2) as usd_per_user
  from sparky_usage group by 1 order by 1 desc;
  ```
- **ACTION (the one that matters): set `SPARKY_MONTHLY_BUDGET_USD`.** Recommended **4–5**
  (≈ half of net sub revenue, resets monthly, friendly out-of-capacity message already built,
  allowlist override exists for us). Until set, Sparky is unlimited per Pro user.
- ⬜ Anthropic console actual month-to-date spend: $____

### Storage (all signed-in users)

- A design graph: ~20–200 KB JSONB (typ ~50 KB). Free: ≤10 designs + 5 versions each
  → worst case ~10 MB, typical **~1–3 MB per active free user**.
- Pro: unlimited designs, 200 versions kept → a heavy Pro design can reach ~20 MB.
  (Lever if it ever matters: store version diffs instead of full graphs.)
- At Supabase Pro's 8 GB: roughly **2,500–8,000 active free users** or ~400 heavyweight
  Pro design-piles. Not a today problem; a four-digit-users problem.

### Bandwidth / requests

- Content pages are static/SSG on Vercel CDN; editor bundle ~ a few MB once, then cached.
- Auth traffic (the "204 requests" reading): session refreshes, ~free at Supabase's
  50k-MAU free allowance.
- ⬜ Vercel bandwidth this month: ____ GB of ____ included
- ⬜ Supabase egress this month: ____ GB of ____ included

## Fixed costs & THE CLIFFS

| Service | Today | First cliff | Cost after |
|---|---|---|---|
| Vercel | ⬜ plan? ($0 Hobby / $20 Pro) | **Hobby ToS disallows commercial use** + 100 GB bandwidth | $20/mo Pro |
| Supabase | ⬜ plan? ($0 Free / $25 Pro) | 500 MB DB · 5 GB egress · project PAUSES after 1 wk inactivity on Free | $25/mo Pro |
| Domain | ~$1/mo amortized | — | — |
| ElevenLabs (content, not platform) | ⬜ plan $____ | per-character quota | next tier |
| **Fixed floor once both cliffs crossed** | | | **~$45/mo ≈ 6 Pro subs** |

⚠️ If we're on Vercel Hobby with Stripe checkout live, the commercial-use term is already
a compliance risk — verify the plan and upgrade if needed *before* any traffic push.

## Per-user unit economics (the ad-spend question)

- **Free user**: storage cents + bandwidth cents − $0 revenue ≈ **−$0.02 to −$0.10/month**,
  bounded (Sparky gated, engine client-side, design cap 10). 10k free users ≈ −$200–1,000/mo
  *plus* forced tier upgrades — survivable but real; this is the number ads multiply.
- **Pro user**: +$8.44 − Sparky (⬜ real avg, capped at $4–5 once env set) − cents
  ≈ **+$3.50–8/month** with the cap; **unboundedly negative without it**.
- Break-even Pro subs vs fixed floor: **~6** (post-cliffs), **~1** today (free tiers).

## What to charge (first pass, revisit with real Sparky data)

$9 holds IF the Sparky budget is set. The price isn't the problem; the unlimited API is.
Yearly at $90 improves cash flow not margin. Raising price before having conversion data
optimizes the wrong variable — get 10 Pro subs, read `usd_per_user`, then decide.

## The six dashboard numbers (Cameron)

1. Vercel plan + bandwidth used this month
2. Supabase plan + DB size + egress month-to-date
3. Anthropic console month-to-date spend
4. `sparky_usage` query above (usd_per_user)
5. ElevenLabs plan + usage
6. Stripe: confirm no other fees active (e.g. tax tooling)
