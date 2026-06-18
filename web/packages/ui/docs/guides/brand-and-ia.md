# Electrace — brand & information architecture

Electrace is an electronics design tool: a block-based schematic/PCB editor with live electrical
checks. Build designs that feel **modern + warm, calm by default** — Linear/Figma calm with warmer
neutrals. Credible to pros, friendly to learners; never a toy, never cold CAD.

## Themes
Three, switched by `data-theme` on an ancestor: **mid** (default — slate-dusk), **dark**, **light**.
All color comes from the semantic tokens (`bg-surface`, `text-dim`, `text-accent`, …) so any layout
re-themes for free. Accent is blue `#4c8dff`. Use the `Foundations` cards (ColorTokens, TypeScale,
ThemeSpecimen) as the source of truth.

## Layout / information architecture
- **Page frame:** wrap pages in `AppShell` (sticky top nav + ambient `SiteBackdrop` + `Footer`).
- **Top bar:** logo · section links · theme toggle · account; on a design, also a design-wide lint
  summary (total power, cost, errors).
- **Editor is three panes:** a collapsible **block-library palette** (left) · the **canvas** (center,
  blocks + terminals + wires) · a **persistent right context panel** (selected block's explanation,
  declared spec, lint reasoning, drill-in). Detail is *pinned* in the panel, not a fleeting hover.
- **Progressive disclosure:** calm by default; depth (raw values, the math behind a check) one
  interaction away. One adaptive UI — no beginner/pro mode switch.

## Status = color + icon + text (never color alone)
Accessibility rule (≈8% red/green colorblind). Use **`SevChip`**:
- OK → green · ✓ · "OK"  · Tight/near-limit → amber · ▲ · short reason
- Over/error → red · ✕ · short reason · Not declared → gray · ○ · "not specified" (honest empty state)

## Net colors (wires/connectors — a family separate from status)
power = **amber**, rail = **green**, gnd = **gray**, signal = **blue**. Connections are net-to-net
(5 V→5 V, GND→GND); wires inherit the net color; unwired exposed nets show as dashed "open nets".

## Typography
**Inter** for UI (`font-sans`); **JetBrains Mono** for every value, net, and spec (`font-mono`) —
numbers reading as precise is core to the credibility.

## Schematic symbols
Support **ANSI/IEEE** and **IEC 60617** (the `SchematicSymbol` / `SchematicSymbolGallery` `standard`
prop). Component bodies inherit the text token; leads/pins are the blue accent.

## Block node visual
Rounded rectangle, warm-charcoal fill (`bg-surface-2`), subtle border, **function glyph + name**
header, one **declared-spec line** (e.g. "9–18 V → 5 V · 3 A"), a **status chip**, and net handles on
the edges. A subtle chip-vs-discrete-parts glyph shows the discrete-friendly ethos at a glance.

## Tone & microcopy
Plain language, no unexplained jargon (define a term inline on first use). **Conversational status** —
"Plenty of headroom — 15 W of 25 W", not just "OK". The explanations do the learner-friendliness; the
clean surface keeps pro credibility.
