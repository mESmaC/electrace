# Design verification — the alpha → beta gate

Created 2026-06-11. The plan: walk every shipped feature against its intended behavior,
record findings, fix what blocks beta. **Primarily Cameron, manually, in the real product
(production site, real account, real card where relevant)** — automated coverage backs it
up but doesn't substitute: the 117 core tests prove the engine math, the headless scripts
prove the happy paths; this pass proves the product.

## How to run a pass

- Work an area top to bottom. For each line: do the steps, compare against *intended*,
  set Status: ☐ untested · ✅ pass · ⚠ friction (works, but you paused) · ❌ fail.
- Every ⚠/❌ gets a row in the Findings table at the bottom with a severity:
  **P1** broken/wrong (blocks beta) · **P2** misleading or trust-damaging (blocks beta) ·
  **P3** polish (triage; doesn't block).
- Anything that surprises you — even passing — gets a note. Surprises are the data.
- When an area is done, date it. Re-verify an area after any major change to it.

Automated coverage already standing: 117 core engine tests (propagation, isolation, SI,
connector declarations, lint rules) · headless scripts for sandbox entry, export gates,
pro-path regression, connector pin UX. Gaps in automation worth adding during this pass
are findings too — tag them **AUTO**.

### In-product capture (editor-based checks)

For anything tested inside the editor, record the verdict in-product: hit **Report Bug**
and write the note as `[VERIFY] [P]` or `[VERIFY] [F]` plus a short description of what was
tested — the capture buffer (last 300 events) and a design snapshot ride along as evidence
backing the verdict. Example:

> [VERIFY] [P]
> Created a block and added symbols to it without issues. Validates the first part of the
> block CRUD cycle.

Harvest them back out with `cd web && node --env-file=.env.local scripts/verify-report.mjs`
(needs the Supabase service key in .env.local once — or run the equivalent in the Supabase
dashboard: `select created_at, description from bug_reports where description ilike '[VERIFY]%'`).
Fold ❌ entries into the Findings table below; the doc stays the single source of truth,
the table just gains evidence-backed rows. Non-editor surfaces (landing, auth, pricing,
emails) still get checked off directly in this doc — no capture exists there.

---

## 1. First contact (anonymous, fresh browser)

| Check | Intended | Status |
|---|---|---|
| Landing → "Try it — no account" → editor loads with demo design | no login bounce, sandbox banner explains browser-only saving | ☐ |
| Build something small in sandbox, close tab, return | work persists; banner still accurate | ☐ |
| Sandbox → sign up → first visit signed in | pre-signup work imported automatically, visible in dashboard | ☐ |
| Landing claims vs what you just experienced | "free, no card, no catch" felt true | ☐ |
| Mobile/narrow window on landing + block pages | readable, no broken layout (editor explicitly desktop-first) | ☐ |

## 2. Accounts & auth

| Check | Intended | Status |
|---|---|---|
| Email+password signup incl. confirmation email | confirm flow works; ToS/privacy presented plainly | ☐ |
| GitHub OAuth, Google OAuth | both complete; profile name sane | ☐ |
| Password reset end-to-end | email arrives, reset works, old password dead | ☐ |
| Session across two devices | designs + settings follow | ☐ |
| Sign out | local cache behaves; no ghost session | ☐ |

## 3. Editor core loop

| Check | Intended | Status |
|---|---|---|
| Place blocks (click + drag from palette), wire terminals | handles hit reliably; typed nets color correctly | ☐ |
| Spec-search ("12 to 3.3v 500ma", "buck") | only blocks whose declared specs satisfy; why-it-fits shown | ☐ |
| Block cards | spec line, live status chip, IC/DISC tag all correct vs the block's truth | ☐ |
| Drill into a block, edit internal schematic, drill out | edits persist; design-level checks refresh | ☐ |
| Net labels / power flags in block editor | same name = same net, no wire; different names stay separate | ☐ |
| Undo/redo through a multi-step edit incl. a block edit | no resurrection of stale terminals | ☐ |
| Autosave + tab close + reload | nothing lost, incl. the last seconds | ☐ |
| Import: valid design JSON / garbage file | round-trips clean / clear error, no silence | ☐ |
| Custom block: create, expose pins, author with Sparky or by hand | appears in palette; terminals usable | ☐ |

## 4. Checking engine (the trust core — be adversarial)

| Check | Intended | Status |
|---|---|---|
| Over-voltage through a chain (supply → chip out → low-max input) | fires at the pin that dies, names net + numbers | ☐ |
| Power budget with several loads incl. one through a signal chain | rail draw adds up; headroom correct | ☐ |
| Short: hot output into gnd-typed pin (block AND connector side) | short-circuit finding, not a cascade of noise | ☐ |
| Reverse polarity on a polarized part | caught, plain language | ☐ |
| Stress test at a voltage that should fail / barely hold | names the tightest limit with real margin numbers | ☐ |
| Acknowledge a noisy finding, then un-acknowledge | mutes with note; returns cleanly | ☐ |
| Delete the flagged block while checks panel is filtered to it | filter clears — no green lie (regression: walkthrough P1#4) | ☐ |
| Isolation (Pro): declare, then bridge it via shared ground | violation names the exact bridging net immediately | ☐ |
| SI (Pro): RS-485 unterminated / terminated / pull-ups too weak I2C | each verdict matches the physics; fix-in-message correct | ☐ |
| Connector pins: declare 12 V wall wart on barrel + wire to 5 V-max block | over-voltage across the board edge; contact rating enforced | ☐ |
| A check you KNOW should not fire | it doesn't (false-positive sweep on a clean design) | ☐ |

## 5. Expand-to-discrete & block pages

| Check | Intended | Status |
|---|---|---|
| All 10 breakdowns open from the editor | render clean, no wires through bodies, notes read honestly | ☐ |
| mcu-load / other irreducibles | honestly labeled, no fake breakdown offered | ☐ |
| Public block pages (spot-check 6+ incl. opamp, liion-charger) | explainer + schematic + discrete section + video where paired | ☐ |
| og:image when sharing a block link (Discord/Slack paste) | schematic card shows | ☐ |

## 6. Pro gates & billing (real card)

| Check | Intended | Status |
|---|---|---|
| Free account: Isolation…, Signal class…, BOM CSV, PCB export | soft upsell every time — visible, warm, never a silent wall | ☐ |
| Upgrade flow: monthly AND yearly shown; price matches $9 promise | Stripe checkout completes; plan flips to Pro promptly | ☐ |
| Pro: all four gates now pass without friction | incl. 11th design (cap lifted, meter shows Pro) | ☐ |
| Private design as Pro; open link signed-out + as another user | server denies; not just hidden in UI | ☐ |
| Cancel; check behavior at period end | Pro runs out the paid period; designs never deleted; private designs handled per ToS | ☐ |
| Free user at 10 designs | dialog + meter; autosaves of existing designs never blocked | ☐ |

## 7. Sparky (Pro account)

| Check | Intended | Status |
|---|---|---|
| "Build me X" small (regulator + load) | places, wires, analyzes; claims match the canvas | ☐ |
| Author a real chip from part number | real pinout, lands on BOM with footprint | ☐ |
| New tools: declare connector pins / isolation / SI / stress test via chat | declarations land on canvas + persist; isolation verifies on declare | ☐ |
| Drill into a block while Sparky is mid-reply | reply lands in the right conversation (known bug: todo.md §2.5.5) | ☐ |
| Long conversation (15+ turns) | compaction kicks in; no amnesia about the design | ☐ |
| Ask it something false ("why is this 12V?" when it's 5V) | corrects you from the net graph, doesn't play along | ☐ |

## 8. BOM & buy path

| Check | Intended | Status |
|---|---|---|
| BOM contents vs blocks on canvas | every real part, correct values/qty/refs; hollow shells flagged not silently absent | ☐ |
| Digi-Key buy links + send-to-cart | search hits the right part; cart list correct; affiliate disclosure visible | ☐ |
| CSV export (Pro) | opens clean in a spreadsheet; matches the view | ☐ |

## 9. PCB → manufacturing handoff

| Check | Intended | Status |
|---|---|---|
| Open PCB from a real schematic | all parts have footprints (no generic-0805 stand-ins on knowns), ratsnest sane | ☐ |
| Route a small board fully; DRC clean run + deliberately violate clearance | violations precise; clean board says clean | ☐ |
| SI classes declared → si-long / si-skew DRC | fires at lengths the class math predicts | ☐ |
| .kicad_pcb export (Pro) opened in real KiCad | loads without errors; parts/traces/outline match; plot Gerbers in KiCad as the docs claim | ☐ |
| KiCad netlist (free) into KiCad | imports clean | ☐ |

## 10. Content surfaces & SEO claims

| Check | Intended | Status |
|---|---|---|
| All 9 calculators: correct math spot-check + E-series snapping | verify one against hand calculation each | ☐ |
| /vs pages claims | every "us" claim true of the live product (post-Gerber-honesty sweep) | ☐ |
| Pricing page vs enforcement | each bullet demonstrably true (the claims-audit found 2; should now be 0) | ☐ |
| Help/changelog | renders, current, no stale promises | ☐ |
| Footer on content pages, absent in app; links all live | no 404s | ☐ |

## 11. Resilience & abuse-adjacent

| Check | Intended | Status |
|---|---|---|
| Design with a stale wire (re-authored block) | analysis survives; invalid wire listed, repairable | ☐ |
| Absurd design (50 blocks, all unwired) | editor + checks stay responsive | ☐ |
| Import a design claiming visibility:"public" as free user | server default/gates hold (DB defaults unlisted) | ☐ |
| Hit /api/assistant signed-out & as free user (curl) | 401 / upgrade-gate; never burns tokens | ☐ |
| Bug report flow | confirm dialog shows exactly what's sent; lands in bug_reports | ☐ |

---

## Findings

Add rows as the pass produces them. Severity per the header rules. This table IS the
bug-fix + adjustment list that takes us to beta; ROADMAP's beta gate references it.

| # | Area | Finding | Sev | Status |
|---|---|---|---|---|
| F1 | Editor | "New" gives demo template, no blank-sheet option (walkthrough P2 #6) | P3→fix at beta | open |
| F2 | Editor | Project keeps template name through redesign — no rename prompt (P3 #9) | P3 | open |
| F3 | Checks copy | Internal net name leaks into insight copy ("vout#3") (P3 #10) | P3 | open |
| F4 | Checks copy | Test-point insight duplicates per power-entry instance (P3 #11) | P3 | open |
| F5 | Editor | in+/in− handles 20 px apart — cramped targets (P3 #12) | P3 | open |
| F6 | Sparky | Reply lands in wrong chat when drilling out mid-stream (todo §2.5.5) | P2 | open |
| F7 | PCB | USB connector lands are header stand-ins, not real land patterns | P2 | open |
| F8 | Billing | Stripe price vs page promise unverified with a live purchase | P1 until tested | open |
| F9 | Pro card | Version history promised "coming soon" — must exist by beta | P2 | open |

## Beta exit criteria (mirrors ROADMAP)

Every area dated as passed · all P1+P2 findings closed · P3s triaged with explicit
defer-or-fix calls · automation added for any check that regressed twice.
