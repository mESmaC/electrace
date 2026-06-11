# Electrace — spec/mockup gap to-do

A reconciliation of the specs (design.md, views.md, data-model.md, storage.md, lint.md, pcb.md,
validation.md, registry.md, ai.md, concept.md, demo-plan.md) and the mockups against what's actually
built. The goal is a clean backlog of the **gaps** — not perf/code-quality (that's [optimization.md](optimization.md)).

Reading guide: many spec deviations are **deliberate** (decided after real testing / to protect editor
work) — those are in §0 so they don't get "fixed" by mistake. Everything else is grouped by effort and
whether it depends on the deferred cloud backend. Size = rough effort (S/M/L). Items marked **⟂ decide**
need an owner intent call before building.

> **GTM / ops, not a spec gap:** ~~corporate web filters block `electrace.net`~~ **resolved
> 2026-06-09** — FortiGuard recategorization confirmed open + mail records in DNS. Remaining
> vendor submissions are opportunistic; see [domain-reputation.md](domain-reputation.md).

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

- [x] **`/privacy` + `/terms` pages** — done; sign-up's dead spans + the landing footer now link to them. *(views.md; S)*
- [x] **404 / 500 error pages** — done; themed `not-found.tsx` + `error.tsx`. *(views.md, design.md; S)*
- [x] **`/settings` page** — done; theme/accent/ANSI-IEC/role/capture + editable display name, wired from the dashboard account row. *(views.md `/app/settings`; M)*
- [x] **KiCad netlist export from the schematic side** — done; "Netlist" button in the editor toolbar via `toKicadNetlist`. (Printable PDF still open.) *(design.md; S)*
- [x] **`/blocks` search + category filter** — done; searchable + category-filterable index. *(views.md, registry.md; S)*
- [ ] **Brand logo SVG in nav/footer/auth** — the decided "open-C + resistor trace" mark (mockups/logo.html, electrace-logo.svg) is unused; chrome uses a wordmark + caret everywhere. *(design.md, mockups; S)*
- [ ] **Dashboard top bar niceties** — `⌘K` palette hint + a Help `?` affordance from the mockup (skip the notifications bell — needs backend). *(mockups/dashboard.html; S)*
- [ ] **Printable / PDF export from the schematic side** — the KiCad netlist is done; the spec also names a printable PDF handoff. *(design.md; S–M)*

---

## §2 — Core product gaps (the thesis features; medium–large, no backend)

These are the spec'd things that actually move the product, deferred while the editor was hardened.

- [x] **Expand-to-discrete (IC → discrete swap)** — ✅ **SHIPPED 2026-06-09** (data model + `discrete.ts` library + editor swap with disc/IC badge + honesty strip + break-into-discrete modal). Remaining tail: only ONE discrete equivalent authored (ldo-3v3) — growing the discrete library is corpus work, tracked in revenue-checklist.md Phase D. Original scoping kept below for the authoring work:
    - **Reducibility spectrum** — block is either **`irreducible`** (CPU/MCU/FPGA/large ASIC → silicon IS the primitive, NEVER offer expand), carries an authored **`discrete`** equivalent (the target: power entry, LDO, buck/boost, charge pump, 555, gate driver, comparator, reference — the small ICs that hide *basic electrical concepts*), or is **already discrete** (passive subcircuit, nothing to reduce).
    - **Honesty framing** (fits the "structural, not validated" ethos): the discrete form is for *understanding + implementation*, not production-optimal — "efficiency may vary, but you can see what it's doing." Surface it, don't hide it.
    - **Authoring** = corpus work; a discrete equivalent is just a block schematic, so it can lean on the existing agentic `author_block`/`author_schematic` path.
    - See memory `expand-to-discrete`. *(concept.md, demo-plan.md, design.md; L)*
- [x] **Discrete-equivalent data model** — ✅ shipped with the above (`Block.irreducible` + the authored-equivalent path in `discrete.ts`).
- [x] **Spec-search / `find_blocks(spec)`** — ✅ shipped 2026-06-09: core matcher (`spec-search.ts`, tested — parses "18 V → 5 V at 3 A", gates on DECLARED specs only, every match carries the why built from declared numbers, missing declarations reported per lint.md principle 4), a `find_blocks` Sparky tool, and the editor palette's spec-search box (also name-filters connectors). The `/blocks` index search stays name/category for now — wire `searchBlocks` in there when touching that page.
- [ ] **Tradeoff readout + cost/area data** — no declared cost/board-area fields, so no part-count/area/cost/perf delta on swaps or in the assistant's tradeoff suggestions. *(concept.md, ideas.md, ai.md; M — needs new declared fields)*
- [x] **On-canvas block status** — ✅ shipped 2026-06-09: declared-spec line ("9–18 V → 5 V · 3 A"), status chip (icon+colour+text with error/warning counts, fed by live findings), and IC/DISC tag on every card (incl. the QFP many-pin variant). Verified live against the sample design.
- [x] **Flat "Schematic view"** — ✅ 2026-06-09: FlatSchematic.tsx renders the whole design as one
      traditional sheet — per-instance regions with real internals, NET-NAME FLAGS at ports for
      cross-block connectivity (no global routing needed), per-part why tooltips, double-click →
      edit in Blocks, SVG download (also covers part of §1's printable handoff). Toolbar
      "Schematic" button. Verified live on the sample design.
- [ ] **`declaration/missing` (severity `unknown`) findings** — lint.md Principle 4: when a check needs an undeclared value, say "can't check — X not declared," never a silent pass. The `unknown` severity has UI support but **no rule emits it**; rules silently `return []`. *(lint.md; M)*
- [ ] **Open-net visual flag on canvas** — open nets are detected + listed but not drawn as the dashed "open net" stub w/ warning dot at the terminal. *(design.md, mockups; S–M)*
- [ ] **Block prose + per-part "why" in the editor** — the authored explanation ("What it does" / "Why it checks out") and per-part `why` feed the AI/derived schematics but aren't shown or editable in the context panel / in-block inspector. *(design.md, block.html; M)* — ⟂ partly intentional if Sparky is meant to be the prose home; confirm.
- [ ] **Missing recommendation lint rules** — `grounding/sensitive-on-global` (💡 star-tie suggestion), `component/inductor-shielding` (💡), `connectivity/no-sink` (driven-but-unconsumed). Declared fields (`sensitive`, `groundClass`, `shielded`, `noisy`) exist but no rule consumes them. *(lint.md; M)*
- [ ] **JSON-Schema manifest gate for blocks** — `ajv` is in the lockfile but unwired; blocks load via `parseYaml` + a runtime `validateBlock()`, with no schema gate (matters for corpus quality once community publishing exists). *(data-model.md; S–M)*
- [ ] **⟂ Two assistant context modes + lazy `explain.md`** — `designContext`/`blockContext`/`blockBrief` projections are built in `context.ts` but the assistant route passes raw design+blocks and relies on tool-calls; confirm `explain.md`/`why` prose actually reaches the model. *(ai.md; S)*

---

## §3 — PCB (mostly shipped; remaining real gaps)

PCB is far more complete than pcb.md's "next phase" framing (placement, routing, vias, layers, DRC, board outline, KiCad-PCB export all shipped).

- **Standardized footprints (real land patterns).** Decision: **hybrid, `.kicad_mod` import first.** Progress:
  - [x] **Core `.kicad_mod` parser** (`parseKicadFootprint`) — S-expression → Footprint, SMD/THT, all pad shapes, tested incl. a real file.
  - [x] **Import + library UI** — PCB editor "Footprints" button imports single files or a whole library at once into a local library (with previews).
  - [x] **Assign an imported footprint to a part/component** — per-component override (saved with the board, undoable); pins map to imported pads by pad number, else by order; ratsnest re-keyed to follow. Select a part → Footprints → Use. *(Needs live break-testing — odd pad counts, BGA pad names, etc.)*
  - [ ] **Footprint storage = server-side** ✅ done (`/api/footprints` → `web/.data`), the shared-registry shape. Future: a curated standard set + per-user scoping when accounts land.
  - [ ] **IPC-7351 generation** for the common families (chip/SOIC/SOT/QFP/QFN/headers) to replace the rough procedural geometry — the generated-but-standard half of the hybrid. *(L.)*
- [ ] **Gerber + drill (Excellon) export** — only KiCad `.kicad_pcb` is wired. KiCad is a fine interim handoff, but Gerber/drill are explicitly named. *(pcb.md; M–L)*
- [x] **PCB layout persisted with the design record** — ✅ 2026-06-09: `designs.pcb` JSONB column, synced with the design.

---

## §4 — Deferred cloud-backend phase (Supabase + Drizzle + registry)

Known-deferred, grouped so they aren't mistaken for oversights. This is the big "provision Supabase" milestone (DATABASE_URL + keys is the human step).

**Storage & accounts**
- [x] Supabase + Drizzle + Postgres schema (`web/db/schema.ts`) — ✅ 2026-06-09: users + designs (P1 scope), migration in `web/db/migrations/0001_init.sql` **(human step: paste into the Supabase SQL editor, or set DATABASE_URL and `npx drizzle-kit push`)**.
- [x] Real auth — ✅ shipped 2026-06-08 via **Supabase** (not Auth.js): email/password with confirmation + GitHub/Google OAuth, cross-device sessions, app routes require sign-in. Pricing page + tier UI shipped too; entitlements are an email-allowlist interim (`web/lib/entitlements.ts`) until billing lands.
- [x] `/forgot-password` + `/reset-password` — ✅ 2026-06-09 (login's Forgot? link wired; recovery flows through /auth/callback). `/verify-email` not needed as a route — Supabase confirmation lands on /auth/callback directly.
- [x] Ownership + RLS + visibility enforcement — ✅ 2026-06-09: RLS policies in the migration enforce `public/unlisted OR owner = auth.uid()` and **private-requires-Pro in Postgres itself**; the free 10-design cap is enforced in the API route.
- [x] `/api/designs` CRUD + share + fork — ✅ 2026-06-09: list/upsert/get/patch/delete (queries run AS the user so RLS enforces), `/share/[id]` public read-only view (anon-rendered, RLS-gated, with stats + block cards + sign-up CTA), client-side fork ("Open a copy"), and the editor's Share menu (visibility control + link; autosaves deliberately never touch visibility). Slug-based URLs deferred to P2 with the registry.
- [ ] Telemetry ingestion `/api/events` + `events` table + consent→`users.settings` (client capture already exists, buffers locally). *(storage.md; M)*
- [x] localStorage→account import — ✅ 2026-06-09: `reconcileDesigns()` merges both directions on startup (newer updatedAt wins); pre-account local work is pushed up automatically.
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

## §5.5 — Live bug reports + agent-API feedback (2026-06-09, owner-reported — NEXT UP)

- [ ] **Sparky chat loses its stream when you drill OUT of a block schematic mid-response.**
  Repro: open chat, send a message, exit the schematic while it's processing → chat shows the
  user message with no reply (the server-side run COMPLETES; only the client loses it).
  DIAGNOSIS v2 (later same session): the breadcrumb is a BUTTON (setDrillRef(null)) — NOT
  navigation. And the owner confirms the run COMPLETES. Refined hypothesis: conversation
  identity — drill-in may switch the ACTIVE conversation id (block-scoped thread), so
  appendChat writes the reply into the drilled thread while drill-out shows the previous
  thread (reply exists, but in the other conversation; status/progress also reset). VERIFY:
  check getActiveId()/setActive calls around drill-in/out and whether sendMessage captures
  the conversation id at SEND time (it should append to the ORIGINATING conversation, not
  whatever is active at completion). Fix: bind the run to its conversation id when sent.
  Earlier diagnosis kept below for context:
  DIAGNOSIS v1 (2026-06-09 session): sendMessage + its stream reader are MODULE-LEVEL in
  lib/assistant.ts — a component unmount can NOT kill them. Therefore the drill-out path must
  be a real PAGE NAVIGATION (suspect: the "← <project>" breadcrumb in the BlockSchematic header
  is a Link, killing the fetch wholesale; server run completes). Fix in two layers:
  (1) make drill-out a state change, not a navigation (or intercept the breadcrumb while a run
  is active); (2) resilience for ANY reload mid-run: set an `electrace:chat:pending` flag when
  sendMessage starts, clear on completion — on mount, pending+no-live-progress ⇒ append a
  "reply was interrupted by a page change" notice (or, better later: persist run ids server-side
  and fetch the completed reply). *(M — start at BlockSchematic's exit affordance)*

- [ ] **Agent-API hardening (verbatim feedback from a GPT-5.5 Sparky session — excellent list):**
    1. [x] **Connector pins missing from net summaries** — ✅ 2026-06-09: CONFIRMED REAL BUG in
       core resolve(): connector pins were used for union-find + the external flag but DROPPED
       from the net record. Fixed: ResolvedNet.connectorPins carries them (tested); surfaced in
       list_nets (`connectors=[J1.1]`) and the editor's net passport ("Board I/O" section).
    2. [x] **list_connections tool** — ✅ 2026-06-09: raw wire list with INVALID endpoints marked.
    3. [x] **Dangling-wire findings** — ✅ 2026-06-09, and deeper than asked: resolve() used to
       THROW on one stale wire (killing the whole analysis — the real reason the graph went
       untrustworthy after re-authoring). It now skips + records invalid connections, and a new
       `connectivity/dangling-wire` error names the missing endpoint AND its instance's valid
       terminals. Tested: healthy nets survive alongside the finding.
    4. [x] **remove_invalid_wires** — ✅ 2026-06-09 (drop-invalid; lists what it removed).
    5. [x] **author_schematic terminal DIFF** — ✅ 2026-06-09: result now reports added /
       removed(unwired) / auto-reconnected renames / orphaned-with-fix, every authoring call.
    6. [x] **connect errors name the valid terminals** — ✅ 2026-06-09 ("DRV1.GATE doesn't
       exist — DRV1's valid terminals are: PWM, GND, VMOT, MOTOR-").
    7. **Stable terminal IDs vs display labels** (rename ≠ delete+add) — bigger data-model
       question; design before building. *(L, decide)*

## §6 — Known limitations (shipped features with rough edges)

- [x] **Wire-to-wire junction taps don't track their host wire.** ✅ fixed 2026-06-09: taps are now BOUND endpoints (`{ wire, t }` — arc-length param along the host's path) resolved at render time, so they follow the host through drags and Align; deleting the host detaches the tap to a fixed point (visibly floating, not silently broken). Legacy fixed-coordinate taps in saved drafts still work via the old geometric path.

---

### Top of the list if optimizing for impact
1. **⟂ Decide expand-to-discrete** (§2) — it's the demo's headline; either build it (+ discrete data model) or formally retire it from the pitch.
2. **Spec-search / `find_blocks`** (§2) — named core capability, cheap-ish, helps both editor and Sparky.
3. **On-canvas block status + spec line** (§2) — closes the most visible mockup-vs-build gap.
4. **The §1 quick wins** — legal pages, error pages, `/settings`, netlist export: small, and they make the app feel finished.
