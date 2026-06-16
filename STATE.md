# Electrace — current state

Internal "where everything actually is" snapshot, grounded in the code as of 2026-06-15.
Written cleanly enough to share selectively. This is the **synthesis layer** — for the
per-area depth and the rationale behind decisions, see the companion docs:

- **[FEATURES.md](FEATURES.md)** — the feature inventory by tier (the authoritative checklist)
- **[VERIFICATION.md](VERIFICATION.md)** — the alpha→beta gate + the open findings table (F1–F13)
- **[ROADMAP.md](ROADMAP.md)** — what's next + the beta exit criteria
- **[DECISIONS.md](DECISIONS.md)** — architectural calls and their trade-offs
- **[MODEL-BENCH.md](MODEL-BENCH.md)** — Sparky model benchmark (Haiku/Sonnet/Opus)
- **[design.md](design.md)** — the design-system source of truth

Public-facing copy lives in `web/lib/electrace-info.ts` (changelog + FEATURES_MD) and
`web/lib/plans.ts` (tier claims). Keep this honest — it includes the warts.

---

## 1. What Electrace is

A **block-based, transparent electrical design tool that runs in the browser** — "the
electrical engineer's IDE." You assemble a design from functional blocks (each a real
subcircuit, not one-part-per-block), wire typed terminals, and a deterministic engine
checks the design **on every change, client-side, in milliseconds** — no simulation.
Every block can be cracked open to its real schematic and, for reducible ICs, its discrete
transistor-level equivalent. The moat: **every block carries its reasoning, every finding
names the exact part and the arithmetic, and nothing is guessed.**

Maturity: **alpha, beta-gated on the VERIFICATION pass.** Production-deployed (Vercel +
Supabase, electrace.net), real users, first organic signup 2026-06-12. The Hobby/Pro paths
are live end-to-end (auth, sync, billing, RLS, Sparky).

Three-tier model: **Hobby (free)** · **Pro ($9/mo early-adopter, $15 planned)** · **Team
(defined on the pricing page, no backend yet)**.

---

## 2. Repository shape

- **`electrace/`** — `@electrace/core`, the pure analysis engine (TypeScript, no UI). ~5k LOC
  across 31 files. Published to the web app via `file:../electrace`; after editing core,
  rebuild (`npm run build` in electrace) then sync `dist` into `web/node_modules/@electrace/core/dist`.
- **`electrace/blocks/`** — 30 library blocks as `block.yaml` (+ optional `explain.md`).
- **`web/`** — Next.js 16 app (React 19, @xyflow/react, Supabase, Stripe). The editor,
  marketing/content surface, APIs, and billing.
- **`shorts/`** — the YouTube Shorts production pipeline (config → TTS → render → upload).
- **Root `*.md`** — the doc set above.

> Next.js 16 here has breaking changes vs. training data — `web/AGENTS.md` mandates reading
> `node_modules/next/dist/docs/` before writing app code.

---

## 3. The analysis engine (`@electrace/core`)

The differentiator. A deterministic ladder — closed-form math on declared values, **no SPICE**.

**Pipeline** (`analyze(design, blocks)` in `electrace/src/index.ts`):
1. **resolve** (`resolve.ts:75`) — stitch block boundaries via wires, connector pins, net
   labels; build the connectivity graph; net typing (precedence gnd>power>rail>signal) and
   naming; DC voltage propagation (`v.follows` outputs swing with their rail).
2. **flatten** (`flatten.ts:17`) — expand every block's internal schematic into one global
   netlist; flat net names deduped ("VOUT"/"VOUT#2") so distinct nets never fuse.
3. **lint** (`lint.ts:677`) — run the rules, most-severe-first; suppress derivative noise on
   shorted nets; apply user acknowledgements.
4. **DC solve** (`solve.ts:93`) — MNA over each linear subcircuit.
5. **AC / Thévenin / standby** (`ac.ts:156`, `solve.ts:415/449`) — on demand.

**The check rules** — **23 rule functions** in the `RULES` array (`lint.ts:677`); several emit
multiple finding kinds (e.g. `dcOperatingPoint` produces resistor-dissipation, cap-rating,
diode-PIV, diode-leakage, missing-value, nonlinear-open), so there are **29 documented
finding types** (one `/docs/checks/<rule>` page each, `web/lib/checkDocs.ts`). By category:

- **Connectivity:** danglingWire, openNet, multipleDrivers, undrivenRail, internalShort
  (block bridges two incompatible terminals; exempts author-declared internal ties so
  passthrough blocks like usb-c-power don't false-fire — F11 fix).
- **Voltage / current:** overVoltage, underVoltage, overCurrent (rail budget, warn>85%/err>100%),
  connectorPinCurrent (per-contact rating), usbInrush (bulk-C vs ~10µF hard-attach), signalOverCurrent,
  diode-PIV, diode-leakage (declared `rating.leak` → real reverse-resistance backflow).
- **Thermal / power:** resistor dissipation (solved P vs package rating), regulatorDissipation
  (linear (Vin−Vout)·I), lowEfficiency.
- **Polarity:** polarityConflict (polarized part backwards).
- **SI (Pro):** busTermination (finds the actual 120Ω bridging the pair), i2cRiseTime
  (τ≈0.847·R·C vs mode limit, fix in message).
- **Isolation (Pro):** isolationBridged (conduction-graph BFS names the bridging net).
- **Completeness:** emptyBlock, underUtilized, connectorFull, testPoints (recommendation),
  plus block **self-asserts** (a block declares "R2.1 ≈ 1.02V"; the solver verifies its own
  claim every change — agent-authored blocks must prove themselves).

**The DC solver** (`solve.ts`): Modified Nodal Analysis. R conductance stamps; ideal V-sources
from declared terminals (referenced to block gnd); declared draws as constant-I sinks (worst-case
load); L/ferrite/fuse short at DC; C open; **diodes/LEDs as fixed-drop elements** with ON/OFF
assumption-flipping iteration (Vf from value or type default 0.7/0.3/2.0). **Honest boundaries:
transistors, ICs, zeners, TVS stay open with a note — never guessed.** Per-subcircuit solve
(union-find partition), 300-node cap, singular-matrix → "unsolvable" finding. Whole pipeline
incl. solver: ~4 ms at 50 blocks (`bench/pipeline.mjs`). Built on this: `theveninAt()` (Vth/Rth/Isc,
two solver runs), `standbyDraw()` (off-state floor — dividers/pull-ups/leakage never sleep, battery
life from declared capacity), AC phasor response (complex MNA, −3 dB corner).

**Data model** (`types.ts`): `Block` {terminals (id/role/type/v/i/iStandby/aliases), schematic
(parts+nets), limits, transform, asserts, isolation, irreducible}. `Design` {blocks, connections,
labels, connectors, isolation, signals, acks}. A block's authored `layout` (placed symbols + wires)
is projected to its semantic `schematic` by `deriveBlockSchematic` — what you draw is what's
analysed. Terminal **aliases** canonicalize across resolve/flatten/Sparky (`gnd` answers for `gnd_in`).
Declared `rating` {watts, volts, leak} beats footprint inference.

**Tests:** ~117 core tests (10 files, ~2.4k LOC) — resolve, lint rules, flatten, derive, DRC,
KiCad export, footprints, value parsing.

**Engine gaps / honesty boundaries** (deliberate, stated in copy):
- No transient/time-domain simulation, no thermal sim, no parasitics, no nonlinear modeling, no SPICE.
- Worst-case sink model — a regulator's input doesn't load its source.
- **F13 (open, P2):** `si/termination-missing` silently no-fires for an RS-485 class declared on
  **connector-pin** pairs — suspected pin→net resolution bug in the SI rules. Trust-damaging; the
  one known engine no-fire.

---

## 4. The editor (`web/app/editor/`)

Three distinct schematic surfaces, one PCB surface.

**Main canvas** (`Editor.tsx`, ~2.2k LOC) — React Flow graph of block + connector nodes.
Place/drag from palette (snap to 22px rows), handle-drag wiring (direction-agnostic;
`isValidConnection` always true — lint enforces driver/load roles), spec-search
("18V→5V at 3A" filters to blocks whose declared specs satisfy it), typed-net edge coloring,
connectors (auto-flip toward bulk-connected blocks), live findings panel (severity glow on
blocks, click-to-locate, clears stale filter when the selected block is deleted), drill-in,
stress test, per-rail power budget + Thévenin/standby on net select, debounced undo/redo
(survives block edits), ANSI/IEC global toggle, Light/Mid/Dark themes, in-app bug report
(Shadowplay buffer). **Semantic memoization:** analysis is keyed on topology, so dragging never
re-runs resolve/lint.

**In-block schematic editor** (`BlockSchematic.tsx`) — the symbol/wire canvas behind a drilled-in
block. Model in `schematic-model.ts`: `Sym` {type, ref, value, x, y, rot, chip?, scale?}, `Wire`
{a, b, mid} where endpoints are `PinRef | Pt | WireTap`. **Wire endpoints are symbolic PinRefs**
resolved dynamically, so moving/scaling a symbol moves its wires; **WireTap junctions are bound to
their host wire** by arc-length fraction so they ride along. 50+ symbol types (ANSI/IEC), parametric
chip profiles (DIP/SOIC/QFP/QFN/BGA), grid-snap, collision detection, auto-snap-on-load (the old
Align button is gone), `set_mpn`/scale support.

**FlatSchematic** (`FlatSchematic.tsx`) — read-only full-design sheet: every block's drawing side by
side, net-name **flags** carrying cross-block connectivity by name, per-instance dashed frame +
title, **EDA-style border + bottom-right title block** (name/author/date/rev/blocks/sheet), LED glow
∝ solved forward current, SVG download. (Recently reworked: label-inclusive bounds so frames enclose
labels + honest spacing; sits on a "desk" surround.)

**PCB editor** (`PcbEditor.tsx`, ~750 LOC) — footprints auto-matched from schematic, octolinear
routing (2 layers, widths, vias), MST ratsnest + unrouted count, DRC (clearance/overlap/short/
unrouted + si-long/si-skew), KiCad `.kicad_mod` footprint import, board outline + auto-arrange,
localStorage-persisted. ~55 footprint families with real land patterns.

**Editor state vs. the 2026-06-13 sweep** (VERIFICATION's "13 issues"): #1,2,4,5,6,7,8,9,10,12
**done**; #11 (wire-behind-symbol shadow) **first pass, wants a human eye on strength**; #3
(relay NO wire reads red) **needs repro** (couldn't reproduce from code — no relay *block* in the
library, ambiguous surface); #13 (user-controlled symbol scaling) **design decision pending** —
main-canvas card scaling is safe (React Flow reconnects handles); block-editor symbol scaling is a
real rework (pins must stay grid-aligned or wires detach).

**Editor gaps:** desktop-first (touch untested); USB connector PCB lands are header stand-ins
(F7, P2 open); "New" gives a demo template, no blank-sheet option (F1, P3); a couple of net-name/
copy leaks (F3/F4, P3); `AcDialog` AC analysis is scaffolded; `DiscreteModal` swap-in-place is "coming."

---

## 5. Sparky (the AI assistant)

A genuinely agentic assistant — **Pro-only, server-gated**. The differentiator vs. a generic
chatbot: it reads the real design, runs the real solver/checks, and **modifies the actual
schematic**, then verifies the change landed.

- **31 tools** (`web/app/api/assistant/route.ts:870`): workspace (list/find/get/create/update/
  delete_block), authoring (author_block, author_schematic, expose_pins, set_value, **set_mpn**),
  placement/wiring (add/remove_block, connect/disconnect, list/remove_invalid_wires), connectors
  (list/add/declare_connector_pins), analysis (analyze_design, list_nets, power_budget, **solve_dc,
  thevenin, frequency_response, standby_draw, stress_test**), declarations (set_isolation,
  set_signal_class, set_net_label), acknowledge/unacknowledge, electrace_help, web_search, and
  **delegate** (fan out to parallel "sparks" for big multi-block builds). `SPARK_TOOL_NAMES` is the
  10-tool authoring-only subset the sparks get.
- **Grounded by prompt:** "call get_block to CONFIRM the change landed rather than assuming it did,"
  "a block is a functional subcircuit not a single component," bias-to-action (finish the build, don't
  leave work dangling), web-search datasheets instead of guessing pinouts. It corrects false premises
  from the net graph.
- **Model/providers:** default `claude-sonnet-4-6`; provider switch to OpenAI (`gpt-5.5`) for A/B;
  optional cheaper `SPARK_MODEL` for delegate sparks; per-model price cards. (MODEL-BENCH: Opus 12/12
  and *cheaper* than Sonnet on the bench due to zero retries — informs a future Pro+ tier.)
- **Context:** 12-turn verbatim window + rolling per-conversation summary; prompt-cache hygiene
  (system+tools cached, volatile design rides in the latest user message); live NDJSON progress
  (status + last tools + narration + token counts).
- **Metering/gating:** every run appended to `sparky_usage` (priced per token, even on error);
  monthly budget env-gate `SPARKY_MONTHLY_BUDGET_USD` (0 = unlimited, the early-adopter default);
  `canUseSparky()` Pro check (interim `SPARKY_PRO_EMAILS` allowlist → DB plan when billing matures);
  anonymous → 401, free → 403.

**Sparky gaps:** **no free tier** (Pro-only, shipped or planned — confirmed); per-tier budget caps
not yet built (one global env today); diagnoses over-budget but won't auto-fix; the wrong-chat-on-
drill-out bug is **fixed** (F6).

---

## 6. Persistence, accounts, billing

**Auth** (`web/lib/auth.ts`, `web/lib/supabase/`): Supabase email+confirmation, GitHub, Google,
password reset; **local-profile fallback** when Supabase is unconfigured (dev). Sessions in httpOnly
cookies, refreshed by middleware; `/projects` `/settings` `/welcome` are server-protected (redirect
to `/login?next=` — the benign GSC "page with redirect" entries, correctly disallowed in robots).

**Persistence** is **local-first**: all editing writes to `electrace:*` localStorage keys;
`installMirror()` wraps setItem/removeItem and debounce-syncs each key to the server; `pullAll()` on
startup backfills absent keys (cross-device + cache recovery), dispatches `electrace:hydrated`.
Designs route to `/api/designs` (Postgres + RLS); other KV to `/api/store` (`user_kv` table, or a
`/tmp` file store for anonymous). **Tombstones** make deletes durable. Reconciliation is
last-write-wins by `updatedAt` — **no live cross-device merge** (accepted interim; CRDT is future).

**Accounts/visibility:** public / unlisted (free default) / **private (Pro, RLS-enforced)**.
Design cap **10 free** (server-enforced on create; autosaves of existing designs exempt), unlimited Pro.

**Billing** (`web/app/api/billing/*`, `web/lib/stripe.ts`): Stripe checkout (client_reference_id =
user.id) → webhook (the only service-role route, signature-verified, idempotent) flips `users.plan`
→ portal. Entitlements (`web/lib/entitlements.ts`): `planForEmail` checks `SPARKY_PRO_EMAILS` then
DB. Live-tested with a real card (F8 verified).

**Migrations** (`web/db/migrations/`): 0001 init (users, designs, RLS, auth trigger) · 0002 stripe_customer_id
· 0003 user_kv · 0004 sparky_usage · 0005 bug_reports · 0006 client_errors · 0007 design_versions
(Git-shaped DAG — auto checkpoints, named snapshots, loss-proof restore; Hobby keeps 5, Pro 200).
RLS owner-only on users/designs/user_kv/sparky_usage/design_versions; bug_reports + client_errors are
write-only via service role.

**Google Ads:** global gtag (`AW-18168363239`) site-wide via `next/script` (`layout.tsx`); a signup
**conversion** fires once per new account across all auth paths (`web/app/SignupConversion.tsx` →
`web/lib/gtag.ts`, created-within-60s window, localStorage-guarded). The conversion-action **label**
isn't wired yet (`NEXT_PUBLIC_GADS_SIGNUP_LABEL` unset) — fires a generic `sign_up` event until set.

**Gaps:** self-serve account deletion is "coming" (manual via email today); Team plan is UI-only
(no schema/routes).

---

## 7. Exports

| Format | Exists | Tier | Notes |
|---|---|---|---|
| KiCad netlist (.net) | ✅ | Free | `export-kicad.ts` — S-expr, ref re-annotation, block traceability |
| Routed PCB (.kicad_pcb) | ✅ | **Pro** | `export-kicad-pcb.ts` — inline footprints, traces, vias, outline |
| Schematic SVG | ✅ | Free | full sheet + title block (`FlatSchematic.tsx`) |
| BOM | view ✅ / CSV **Pro** | mixed | `bom.ts`; connectors included; Digi-Key buy links + one-click cart (free, affiliate) |
| Design JSON | ✅ | Free | import/export round-trip |
| Gerber / pick-and-place | ❌ | — | **do not exist** — copy honestly says "plot Gerbers in KiCad"; native is roadmap |
| Footprint generation | ❌ | — | imports `.kicad_mod`, no native generation |

The Digi-Key cart correctly excludes connectors and family-placeholder part ids (only rows with a
real MPN go to the cart; everything keeps a working "buy ↗" search) — the 502 fix + `set_mpn`.

---

## 8. Content / SEO surface

- **30 block pages** (`/blocks/<slug>`) — explainer + schematic + discrete section + paired video.
- **16 calculators** (`web/app/calculators`) — E-series snapping, block links (led-resistor, dividers,
  555, rc-filter, ohms-law, motor-winding, filter-designer Butterworth 2–8, ac-power/ac-motor, …).
- **4 /vs comparison pages** — Fritzing, Tinkercad, EasyEDA, KiCad (KiCad framed as the export
  destination, not a rival). Honest "when them" on each.
- **33 glossary terms** (`web/lib/glossary.ts`) — def + working-engineer "in practice" + links.
- **29 /docs/checks pages** — one per finding type, linked from every finding card.
- **sitemap.ts** (www host, image-sitemap for block schematics) + **robots.ts** (disallows auth/api/
  shorts-stage; blocks training-corpus crawlers — "the explainer corpus is the product") + IndexNow.
- **Changelog** (`web/lib/electrace-info.ts`) — daily entries, feeds /help + Sparky's context.

---

## 9. Shorts pipeline (`shorts/`)

Config (`configs/<slug>.mjs`: script + anchor-driven `tracks()`) → `build-short.mjs` (ElevenLabs
River TTS with word-synced captions + timeline) → `render.mjs` (frame-by-frame over `/shorts-stage/
<blockSlug>`, 1080×1920, puppeteer + ffmpeg, synthesized SFX) → `upload.mjs` / `comment.mjs` (YouTube
Data API). The stage renders any block's `layout` and supports `fault` (red glow), `gone` (✕),
`highlight`, `wireProgress`, `symbolsShown`, camera zoom — so it can show the checker firing, not just
clean schematics.

**11 shorts shipped + paired** (`web/lib/blockVideos.ts`, embed + VideoObject JSON-LD on the block
page): timer-555, usb-c-power, opamp, liion-charger, comparator-hysteresis, relay-driver,
reverse-polarity, tl431, led-color-sensor, rf-field-detector, dielectric-soakage. Retention
architecture ~43–50s, payoff ~75–86%, CTA inside median watch.

**Automated:** render + upload. **Manual:** YouTube API uploads are locked private until the audit
form clears (manual Studio upload bridges it); comment-pinning has no API. The `why-electrace`
"product short" was built but judged not a real promo — the plan is **Cameron records real B-roll of
using the app → edited into a short** (not the schematic-stage format).

---

## 10. Honest gaps & open risks (consolidated)

**Engine/trust:**
- **F13 (P2, open):** SI termination rule silent no-fire on connector-pin-anchored RS-485.
- DC solver leaves all nonlinear parts open (by design) — bias networks solve, active devices don't.

**Editor/PCB:**
- **F7 (P2, open):** USB connector PCB lands are header stand-ins, not real patterns.
- Symbol scaling (#13) and wire-behind-symbol shadow strength (#11) — pending decisions/polish.
- Relay red-wire (#3) — unreproduced; no relay block exists to test against.
- Desktop-first; touch untested. P3 copy leaks (F3/F4).

**Product/commerce:**
- No native Gerber / pick-and-place (export .kicad_pcb, plot in KiCad).
- Sparky has no free tier; per-tier budget caps not built; billing is allowlist-interim.
- Self-serve account deletion + Team plan are stubbed.
- Google Ads signup conversion fires a generic event — needs the conversion-action label wired.
- Cross-device is pull-on-startup + last-write-wins, not live merge.

**Process:**
- The **VERIFICATION pass is the beta gate** and is still in progress — most areas untested-in-
  product (the 117 engine tests + headless scripts cover the math/happy-paths, not the product walk).
- Block license (CC-BY-4.0) is "pending decision."

---

## 11. Beta exit (from ROADMAP/VERIFICATION)

Every VERIFICATION area dated as passed · all P1+P2 findings closed (F7, F13 are the open P2s) ·
P3s triaged with explicit defer/fix calls · automation added for any check that regressed twice.
