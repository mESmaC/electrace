# Workflow walkthrough #1 — 555 LED flasher (2026-06-10)

Method: drove the real editor headless as a skeptical first-time user. Design: Power Entry
(9–18V) → 555 astable → LED Indicator — deliberately naive so the checks SHOULD fire.
Full path: entry → place → wire → checks → PCB → exports → reload.

## What worked (genuinely)

- Click-to-add from library; node drag; handle-drag wiring — all solid headless, no fights
- **Over-voltage caught**: "✕ vout can reach 18 V but T51.vcc accepts max 15 V" with the
  net detail line. The flagship check fires in the real flow with a clear message
- Autosave + persistence: "Saved ✓" appears; reload restores all nodes + wires exactly
- BOM: grouped refs, quantities, Digi-Key CTA, affiliate disclosure, CSV export valid
- Part-values consolidation insight ("fewer reels") — nice touch
- PCB editor opens with parts placed + ratsnest; Arrange works; KiCad .kicad_pcb export
  structurally valid; design JSON export round-trippable
- Test-point insight on power rails is a good idea (see P3 for its copy bugs)

## P1 — engine gaps — ALL FIXED 2026-06-10 (commit: DC propagation pass)

1. ✅ FIXED — **Signal output voltage doesn't propagate.** T51.out swings at VCC (≈18 V) into
   LI1.vin (declared max 5.5 V) — NOT flagged. Output terminals carry no voltage spec and
   the engine doesn't infer "out swings at supply." The vcc-side violation fired; the
   signal-chain one is invisible. → needs: declared/inferred output-voltage ranges +
   propagation through the net graph.
2. ✅ FIXED — **Current draw doesn't propagate.** Power budget shows 0 A / 0 W with a 555 + LED wired
   to the rail. Blocks without an explicit `i` on their power terminal are invisible to
   the budget, and downstream draw (LED via 555.out) never charges back to the rail.
   → needs: per-block supply-current declarations + chain accounting.
3. ✅ FIXED — **Stress test contradicts the checker.** What-if at 24 V says "Holds at 24 V — tightest:
   PE1 vin.max, 6 V headroom" while a 15 V-max 555 sits on the very rail being stressed.
   It only reads power-entry authored limits. Dangerously wrong conclusion presented
   confidently. → either propagate rail voltage to all attached input maxima, or relabel
   the feature honestly until it does.
4. ✅ FIXED — **Stale checks filter shows false all-clear.** CHECKS panel stayed pinned to deleted
   block LOAD1 showing "● No issues on this block" while three unwired blocks sat on
   canvas. Filter must clear when the block is deleted (and arguably when anything
   changes that makes the filtered view misleading). Trust-critical.

## P2 — funnel & workflow

5. ✅ FIXED 2026-06-10 — **No try-before-signup.** /editor is now public: anonymous users get the
   full free tier as a localStorage sandbox with a banner + signup-imports-your-work bridge.
6. **"New" gives the demo template, not a blank sheet** — and no visible blank option.
   User must delete three blocks to start clean.
7. **Gerber export unverified** in this pass — BOM CSV + KiCad PCB downloaded fine;
   Gerber either missing from the menu, Pro-gated (untested as anonymous), or my menu
   clicking missed it. Needs a dedicated check.
8. **Verify new-design visibility default.** Exported JSON of the (demo-derived) design says
   "visibility": "public"; privacy page promises new designs default to unlisted. Probably
   the demo's own setting — but verify a genuinely new design gets "unlisted".

## P3 — polish

9. Project kept the demo's name ("Buck Supply") through a complete redesign into a 555
   flasher — no rename prompt, exports inherit the wrong name (Buck_Supply.kicad_pcb).
10. Internal net name leaks into insight copy: "…test point on both vout#3 and ground".
11. Test-point insight duplicates per power-entry instance (two identical paragraphs).
12. in+/in− port handles sit 20 px apart on some blocks — workable but cramped targets.

## Next (agreed order)

Walkthrough #2 (PCB deep-dive: routing UX, DRC panel, Gerber) → **DC operating-point
solver** (fixes P1 #1–#3 at the root: node voltages + branch currents from declared specs)
→ lint wave on top of it (dissipation, regulator thermal, decoupling, shorts, GPIO sums).
