# Electrace — spec/mockup gap to-do

A reconciliation of the specs (design.md, views.md, data-model.md, storage.md, lint.md, pcb.md,
validation.md, registry.md, ai.md, concept.md, demo-plan.md) and the mockups against what's actually
built. The goal is a clean backlog of the **gaps** — not perf/code-quality (that's [optimization.md](optimization.md)).

Reading guide: many spec deviations are **deliberate** (decided after real testing / to protect editor
work) — those are in §0 so they don't get "fixed" by mistake. Everything else is grouped by effort and
whether it depends on the deferred cloud backend. Size = rough effort (S/M/L). Items marked **⟂ decide**
need an owner intent call before building.

---

## §0 — Intentional / accepted deviations (NOT to-do; documented so we stop re-flagging)

- **Flat routes** (`/projects`, `/editor?p=`, `/welcome`) instead of the spec's `/app/*` prefix + `/app/editor/[id]`. *Deliberate.*
- **Direct write-back + universal undo** instead of ai.md's "reviewable structured diff." Encoded as "BIAS TO ACTION" in the system prompt. *Deliberate product choice.*
- **`multi-driver` is `warn` + acknowledgeable**, not lint.md's hard `error` — legitimate diode-OR/open-drain cases, handled by the acks system. *Sensible softening.*
- **Stress-test panel** (interactive what-if voltage vs declared limits) stands in for lint.md's automatic `voltage/limit-crossed` rule. *Better UX* — but see §2 for the still-missing *automatic* "already crosses limit" finding.
- **Local `electrace:profile` instead of real auth**, in-place user-block edits at a fixed `1.0.0` (no fork/immutability), hardcoded lint rules (no rule packs), localStorage→`.data/kv` store. *All interim until the Supabase/registry phase (§4).*
- **Tool-use + web search instead of RAG over `explain.md`** for assistant grounding. *Likely deliberate post-testing* — ⟂ confirm in §2.
- **Lint config UI / per-rule severity toggles** deferred (spec itself tags "Later"). *Accepted.*

---

## §1 — Quick wins (small, no backend, do soon)

- [ ] **`/privacy` + `/terms` pages** — T0 legal, and the signup form already references them as dead `<span>`s. Plain static pages. *(views.md; S)*
- [ ] **404 / 500 error pages** — no `not-found.tsx` / `error.tsx`; `/blocks/[slug]` `notFound()` falls back to the Next default. *(views.md, design.md; S)*
- [ ] **`/settings` page** — there is no post-onboarding home for prefs that are *already local* (theme, accent, ANSI/IEC, role, telemetry consent, Pro density). Dashboard/account gear links currently dead-end to `/projects`. *(views.md `/app/settings`; M)*
- [ ] **KiCad netlist + printable export from the schematic side** — `toKicadNetlist` exists in core but is wired nowhere; the editor's Export only dumps design JSON. The PCB side already exports KiCad PCB. *(design.md "schematic is the export source"; S — just a UI hook)*
- [ ] **`/blocks` search + category filter** — index shows `category` per card but no search box / grouping; spec calls it a "searchable hub by category." Cheap now, real once the library grows. *(views.md, registry.md; S)*
- [ ] **Brand logo SVG in nav/footer/auth** — the decided "open-C + resistor trace" mark (mockups/logo.html, electrace-logo.svg) is unused; chrome uses a wordmark + caret everywhere. *(design.md, mockups; S)*
- [ ] **Dashboard top bar niceties** — `⌘K` palette hint + a Help `?` affordance from the mockup (skip the notifications bell — needs backend). *(mockups/dashboard.html; S)*

---

## §2 — Core product gaps (the thesis features; medium–large, no backend)

These are the spec'd things that actually move the product, deferred while the editor was hardened.

- [ ] **⟂ Expand-to-discrete (IC ↔ discrete swap)** — concept.md's central pillar AND demo-plan's "money shot / the clip you post": a badged, reversible, net-preserving swap of an IC block for its discrete equivalent, with a tradeoff strip. **Entirely absent** (no UI, no data). Depends on the next item. *(concept.md, demo-plan.md, design.md; L)* — **⟂ decide priority:** the product leaned into agentic block-authoring instead; confirm whether this headline demo interaction is still in or deprioritized.
- [ ] **Discrete-equivalent data model (`discrete.yaml` / `Block.discrete`)** — prerequisite for expand-to-discrete; no field exists. *(data-model.md, concept.md; L)*
- [ ] **Spec-search / `find_blocks(spec)`** — "18 V → 5 V at 3 A" → matching blocks. Named core capability (the "WEBENCH answer" + editor autocomplete), absent in **both** the editor and the assistant (no `find_blocks` tool). *(registry.md, ai.md, concept.md; M)*
- [ ] **Tradeoff readout + cost/area data** — no declared cost/board-area fields, so no part-count/area/cost/perf delta on swaps or in the assistant's tradeoff suggestions. *(concept.md, ideas.md, ai.md; M — needs new declared fields)*
- [ ] **On-canvas block status** — block node cards are missing the **declared-spec line** (shows one word, not e.g. "9–18 V → 5 V · 3 A"), a **status chip** (icon+color+text), per-block **lint status/bubble**, and the **disc/IC tag**. The mockup leans hard on at-a-glance canvas status; today findings live only in side/bottom panels. *(design.md, mockups/editor.html; M)*
- [ ] **Flat "Schematic view" + Blocks|Schematic toggle** — read-only whole-design schematic (nets stitched across blocks), the export source, click-a-part-jumps-to-block, "edit in Blocks" banner. `flatten()` + a `SchematicView.tsx` shell exist but are **not wired into the editor** (only the per-block preview is). *(design.md; L)*
- [ ] **`declaration/missing` (severity `unknown`) findings** — lint.md Principle 4: when a check needs an undeclared value, say "can't check — X not declared," never a silent pass. The `unknown` severity has UI support but **no rule emits it**; rules silently `return []`. *(lint.md; M)*
- [ ] **Open-net visual flag on canvas** — open nets are detected + listed but not drawn as the dashed "open net" stub w/ warning dot at the terminal. *(design.md, mockups; S–M)*
- [ ] **Block prose + per-part "why" in the editor** — the authored explanation ("What it does" / "Why it checks out") and per-part `why` feed the AI/derived schematics but aren't shown or editable in the context panel / in-block inspector. *(design.md, block.html; M)* — ⟂ partly intentional if Sparky is meant to be the prose home; confirm.
- [ ] **Missing recommendation lint rules** — `grounding/sensitive-on-global` (💡 star-tie suggestion), `component/inductor-shielding` (💡), `connectivity/no-sink` (driven-but-unconsumed). Declared fields (`sensitive`, `groundClass`, `shielded`, `noisy`) exist but no rule consumes them. *(lint.md; M)*
- [ ] **JSON-Schema manifest gate for blocks** — `ajv` is in the lockfile but unwired; blocks load via `parseYaml` + a runtime `validateBlock()`, with no schema gate (matters for corpus quality once community publishing exists). *(data-model.md; S–M)*
- [ ] **⟂ Two assistant context modes + lazy `explain.md`** — `designContext`/`blockContext`/`blockBrief` projections are built in `context.ts` but the assistant route passes raw design+blocks and relies on tool-calls; confirm `explain.md`/`why` prose actually reaches the model. *(ai.md; S)*

---

## §3 — PCB (mostly shipped; remaining real gaps)

PCB is far more complete than pcb.md's "next phase" framing (placement, routing, vias, layers, DRC, board outline, KiCad-PCB export all shipped).

- [ ] **Gerber + drill (Excellon) export** — only KiCad `.kicad_pcb` is wired. KiCad is a fine interim handoff, but Gerber/drill are explicitly named. *(pcb.md; M–L)*
- [ ] **PCB layout persisted with the design record** (currently `localStorage:electrace:pcb:${id}`) — folds into the backend phase (§4). *(pcb.md; M)*

---

## §4 — Deferred cloud-backend phase (Supabase + Drizzle + registry)

Known-deferred, grouped so they aren't mistaken for oversights. This is the big "provision Supabase" milestone (DATABASE_URL + keys is the human step).

**Storage & accounts**
- [ ] Supabase + Drizzle + Postgres schema (`web/db/schema.ts`) — none exists today. *(storage.md; L)*
- [ ] Real auth: email/password + GitHub/Google OAuth (Auth.js) — `AuthForm` is faithful UI but all paths write a local profile. *(views.md, mockups/auth.html; L)*
- [ ] `/forgot-password`, `/reset-password`, `/verify-email` routes. *(views.md; M)*
- [ ] Ownership + RLS (`public OR owner = auth.uid()`); **enforce** `visibility` (public/private/unlisted) — the field is set but read by nothing; private-requires-Pro paywall/quota. *(storage.md; M–L)*
- [ ] `/api/designs` CRUD + fork + public-by-slug SSG share view (`/app/share/[id]`); projects are localStorage-only today. *(storage.md, views.md; L)*
- [ ] Telemetry ingestion `/api/events` + `events` table + consent→`users.settings` (client capture already exists, buffers locally). *(storage.md; M)*
- [ ] localStorage→account import on first sign-in. *(storage.md; S once accounts exist)*
- [ ] `design_revisions` history (spec tags P3). *(storage.md; M)*

**Registry & publishing**
- [ ] Hosted registry: publish pipeline + quality gate (schema-valid + self-lint + prose + license + preview), Official/Verified/Community trust tiers + badges. *(registry.md; L)*
- [ ] Block immutability/versioning + fork-on-edit-of-unowned (today: in-place edits at `1.0.0`; library blocks are edit-blocked, not forked). *(registry.md, data-model.md; M)*
- [ ] Lockfile + vendoring + opt-in "update available" diff (instances pin `block@version` but no lockfile/diff UX). *(registry.md; L)*
- [ ] Composite blocks / sub-block dependency tree (blocks are flat parts-only today). *(registry.md; L)* — ⟂ confirm if wanted.
- [ ] Rule packs (`@electrace/best-practices`, versioned, loaded by the lint engine) — rules are hardcoded today. *(registry.md; M)*

---

## §5 — Lower-priority ideas (from ideas.md; not commitments)

Noted for completeness — add-to-cart / BOM-aware sourcing (distributor PN), block-swap electrical diff, tradeoff sliders / parametric blocks, semantic zoom, live budget gauges ("watch the watts" — `railBudgets` data exists, no gauge UI), "explain this board" on import, pin-passport (overlaps `whats_on_net`). Pull into §2 individually if/when they earn it.

---

### Top of the list if optimizing for impact
1. **⟂ Decide expand-to-discrete** (§2) — it's the demo's headline; either build it (+ discrete data model) or formally retire it from the pitch.
2. **Spec-search / `find_blocks`** (§2) — named core capability, cheap-ish, helps both editor and Sparky.
3. **On-canvas block status + spec line** (§2) — closes the most visible mockup-vs-build gap.
4. **The §1 quick wins** — legal pages, error pages, `/settings`, netlist export: small, and they make the app feel finished.
