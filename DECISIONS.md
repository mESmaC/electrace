# Open decisions — awaiting Cameron's call

Created 2026-06-11. The ideas that need a decision, collapsed from ideas.md, todo.md,
business-setup.md, and session discussions — one place, so nothing gets re-litigated from
scratch or silently forgotten. When decided: record the call + date here, move the work
to ROADMAP.md, and (if it changes standing behavior) note it in the relevant spec doc.

## Needs deciding before BETA

1. **Block library license.** Currently CC-BY-4.0 on authored blocks. The explainer corpus
   is the moat (robots.txt already blocks training crawlers) — keep CC-BY for community
   goodwill, or sweep to proprietary before the library gets big? *Standing note: sweep
   planned "on your word" — that word hasn't been given.*
2. **Lawyer-reviewed ToS.** business-setup.md Stage 1 requires it before charging; Stripe
   is live. Self-drafted ToS/privacy are good but unreviewed. Spend the money now, or
   accept the risk until revenue exists?
3. **Version history scope.** It's promised on the Pro card ("coming soon") and gates beta.
   v1 = snapshot-on-save with restore (~one session). Approve the build slot?
4. **Stripe live test.** $9 promise vs live price — needs your real card once. (Also a
   VERIFICATION.md P1.)

## Needs deciding before 1.0

5. **Native Gerber export.** Today we honestly say "plot in KiCad." Building our own
   generator is very doable but fab-correctness-critical (a bad Gerber burns someone's
   board run + our trust). In 1.0, or stay honest-KiCad-path forever?
6. **Sparky model tiers.** Plan: Pro keeps flagship, higher tier gets better models /
   more capacity. Price point and naming undecided. Decide alongside first real usage data.
7. **Design-cap number.** 10 free is a guess pending real cost data (business-strategy
   explicitly says tune it). Revisit when there are users.
8. **"Explain this board" placement.** Strongest promote in ideas.md (import KiCad → we
   explain it). Roadmapped for 1.0 — pull forward to beta if cold-start hurts, or hold?

## Standing / no deadline

9. **Protoboard store + branded kits.** Parked by your call until the engine was solid —
   engine's solid now. Vinyl trace stencils + AI protoboard-mapping guide concept. When?
10. **Team plan.** "Let's talk" card exists; no backend. Leave as lead-gen, or remove
    until real?
11. **Product Hunt.** Highest-impact single listing; launch day expects maker interaction
    (your no-contact line). Deferred — revisit only if you choose to.
12. **Sandbox telemetry tagging.** Anonymous sessions currently indistinguishable in
    analytics. Five-minute fix when conversion numbers start mattering.
13. **Paid ads experiment.** Recommendation on file: $100–200 once, cheap calculator
    long-tails, as instrumentation not growth. Run it or skip it?
14. **Embedded-firmware-engineer persona.** pitch.md flags it as possibly stronger than
    hobbyist-to-intermediate. Watch sandbox/signup behavior for signal before re-aiming copy.
15. **MoR vs Stripe for sales tax.** Stripe chosen; revisit if international volume appears
    (business-setup.md line 44 trade-off).
16. **Silicon CAD north star.** Owner's long-horizon vision, exempt from triage. No action;
    recorded so it never falls out of the docs.

## Decided (log — newest first)

- **2026-06-10 — SI + isolation are Pro; core checks free forever.** No "never paywall"
  self-binding promises. (pro-tier-gating; pricing restructure shipped.)
- **2026-06-10 — Sandbox: editor open without account**, localStorage-only + signup import.
- **2026-06-10 — Manufacturing artifacts (BOM CSV, .kicad_pcb) are Pro**; Digi-Key cart
  stays free (it earns affiliate revenue). Gerber claims reworded to KiCad-path truth.
- **2026-06 — Revenue strategy: layer stack over subscriptions** (tiers → store → affiliates),
  engine-first redirect until foundation solid.
- **2026-02 — Freemium SaaS + BOM affiliate; public-free/private-paid; $9 early-adopter.**
- **2026-01 — Stack: unified Next.js/TS, YAML blocks → product+marketing+checks.**
