`# Views / Screens — information architecture

_Planning the screens before code. Routes map to the Next.js App Router stack in
[stack.md](stack.md). Each view is tagged with a **tier** so we build in the right order
(validation first, product second, expansion later)._

## Tiers (build order)
- **T0 — Validation:** the minimum to test demand. Public, no accounts. (See
  [validation.md](validation.md).)
- **T1 — MVP product:** accounts + saving + the real editor. The first thing people sign in to.
- **T2 — Later:** monetization, sharing, marketplace, kitting.

## Sitemap

```
PUBLIC (marketing + SEO, no login)
├── /                       Landing                              [T0]
├── /blocks                 Block library index (SEO hub)        [T0/T1]
├── /blocks/[slug]          Block explainer page (SEO content)   [T0/T1]  ← the flywheel
├── /pricing                Pricing                              [T1/T2]
├── /docs , /docs/[...]     Docs / learn                         [T1]
├── /about                  About (by US Nylon)                  [T1]
├── /blog , /blog/[slug]    Blog (SEO)                           [T2]
├── /privacy , /terms       Legal                                [T0]   ← needed at waitlist
└── AUTH
    ├── /login                                                   [T1]
    ├── /signup                                                  [T1]
    ├── /forgot-password , /reset-password                       [T1]
    └── /verify-email                                            [T1]

APP (authenticated, /app)
├── /app                    Dashboard — your projects            [T1]
├── /app/welcome            First-run onboarding                 [T1]   ← ANSI/IEC picker
├── /app/editor/[id]        The editor (block canvas)            [T0*/T1]  ← the heart
├── /app/blocks             My blocks / block manager            [T1/T2]
├── /app/settings           Account + preferences                [T1]
│   ├── (profile, theme, ANSI/IEC default)
│   └── /app/settings/billing  Subscription                      [T2]
└── /app/share/[id]         Read-only / shared design view       [T2]

SYSTEM
├── 404 , 500               Error pages                          [T1]
└── (empty states baked into dashboard/editor)                   [T1]
```
\* The **editor demo** for validation (T0) is a standalone, no-login version of
`/app/editor` — the mockup we already built.

---

## Public views

### Landing `/` — [T0]
The pitch in one scroll. Content/structure already drafted in [pitch.md](pitch.md): hero +
demo clip, the problem, the three layers, "see inside" moment, what-it's-not,
design→order horizon, waitlist/signup CTA, "by US Nylon" footer. **The most important T0
page** — it's what the validation traffic hits.

### Block index `/blocks` + explainer `/blocks/[slug]` — [T0/T1]
The SEO flywheel from [business-strategy.md](business-strategy.md). `/blocks` is a
browsable, searchable hub (by category: power, regulation, amplifier…). Each
`/blocks/[slug]` is a server-rendered explainer page for one block — what it does, the
schematic, why each part is there — authored as MDX (one file feeds the page, the editor
hover, and the lint). These pages ARE the marketing; ship a handful at T0 to seed search.

### Pricing `/pricing` — [T1/T2]
Free vs. paid tiers. Real once we charge; a "free, paid coming" placeholder is fine at T1.

### Docs / Learn `/docs` — [T1]
How to use Electrace + electronics learning content. Reinforces the learner audience and
adds SEO surface.

### Legal `/privacy`, `/terms` — [T0]
Needed the moment we collect waitlist emails (see [business-setup.md](business-setup.md)).
Plain pages.

### Auth pages — [T1]
`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`. Standard,
via Auth.js (NextAuth). Email + OAuth (GitHub/Google — devs expect it). Not needed until
there's something to sign into (T1).

---

## App views (authenticated)

### Dashboard `/app` — [T1]
Landing pad after login. Grid/list of the user's **projects** (designs), each a card with
name, thumbnail, last-edited, open-net/issue count. Primary action: **New project**.
Empty state: a friendly "start your first design" with a sample to open.

### Onboarding `/app/welcome` (or first-run modal) — [T1]
The first-run experience from [design.md](design.md): the **ANSI vs IEC teaching picker**
(resistor shown both ways — teaches while it asks), theme intro (Mid default), and a
**pre-loaded sample chain** so the tool demonstrates itself immediately.

### Editor `/app/editor/[id]` — [T0*/T1] — THE HEART
The mockup we built: block canvas, single-click select, double-click to edit a block's
internal schematic, net-to-net connectors, AI speech-bubble lint, per-card schematic
previews, persistent context/explanation panel, ANSI/IEC + theme + accent. T1 adds: real
persistence (save/load), project state, block library palette wired to real blocks.
(The T0 demo is this view, standalone and no-login.)

### Block manager `/app/blocks` — [T1/T2]
Browse/search the block library inside the app, see your own/saved blocks, (T2) publish
or pull community blocks. Bridges to the marketplace later.

### Settings `/app/settings` — [T1]
Profile, password, and **preferences**: default symbol standard (ANSI/IEC), default theme
(Dark/Mid/Light), accent. `…/billing` (T2) for subscription + the Merchant-of-Record
portal.

### Shared view `/app/share/[id]` — [T2]
Read-only (or hover-only) view of a design for sharing a link — naturally SEO-adjacent and
viral (someone shares a design, viewers see the self-explaining blocks).

---

## Shared chrome / components
- **Public navbar** (logo, Blocks, Pricing, Docs, Login/Sign up) + **footer** (legal, by
  US Nylon).
- **App shell** — top bar (logo, project breadcrumb, budget/lint summary, theme/symbol/
  accent, account menu) + the editor's left palette / right context panel.
- **Error/empty states** — 404, 500, empty dashboard, empty canvas.

## What this means for build order
1. **T0 (validation):** Landing + standalone Editor demo + a few `/blocks/[slug]` pages +
   Privacy/Terms. No auth, no DB. This is the whole validation surface.
2. **T1 (MVP):** Auth, Dashboard, persistent Editor, Onboarding, Settings, Docs, error
   pages. The first real product people log into.
3. **T2 (expansion):** Pricing/Billing, Block marketplace, Sharing, Blog, kitting/order
   flow (a whole sub-project — see [concept.md](concept.md) parked ideas).

## Views worth mocking next (like we did the editor)
- **Landing** — highest leverage (drives validation); the demo clip lives here.
- **Dashboard** — sets the "logged-in home" tone.
- **Onboarding / ANSI-IEC picker** — small but it's the first impression and very on-brand.
- **A `/blocks/[slug]` explainer page** — proves the "one MDX file → page + editor + lint"
  flywheel concretely.
