# Design & UX Direction

_Visual + interaction decisions, made before code so they're cheap to change. Serves the
three audiences (learners, hobbyists, pros) without picking a side. Pairs with
[stack.md](stack.md) and [pitch.md](pitch.md)._

## Locked decisions
- **Visual direction:** **Modern + warm hybrid.** Clean-modern base (Linear/Figma calm), but
  warmer neutrals, a function glyph per block, and conversational status text. Credible to
  pros, friendly to learners — not a toy, not cold CAD.
- **Themes:** **three** — Dark / **Mid** / Light, chosen from a triple selector. **Mid is
  the default** — a slate-dusk middle ground (medium blue-gray, bright text): calmer than
  stark dark, softer than bright white. Dark and Light both ship as alternates.
- **Audience strategy:** **One adaptive UI with progressive disclosure** — no beginner/pro
  mode switch. Calm by default; depth on demand. The *explanations and guardrails* serve
  learners; the clean surface serves pros.
- **Symbol standards:** support **both ANSI/IEEE and IEC 60617**, chosen on first run via a
  teaching picker (resistor shown as zigzag vs. box, labeled "ANSI" and "IEC"). Remembered,
  switchable later. The setting itself teaches — on-ethos.

## The central tension, resolved
Learners and pros pull opposite ways: friendly tools read as toys to pros (credibility
death); pro tools intimidate learners. We don't compromise to a bland middle — we use
**progressive disclosure**: one interface, calm by default, where transparency (the
explanations) does the learner-friendliness and the clean modern surface keeps pro
credibility. Depth (raw values, internals, the math behind a check) is one interaction away,
never in your face.

## Color system

### Status colors are UX, not decoration — and accessibility-first
The lint badges are core. **Rule: color + icon + text, never color alone** (~8% of men have
red/green colorblindness). States:
- **OK** — green · check icon · "OK"
- **Tight / near limit** — amber · triangle icon · short reason
- **Over / error** — red · octagon-x icon · short reason
- **Not declared** — neutral gray · dashed · "not specified" — *honest state for when no spec
  was declared, so a badge never implies a check we didn't actually do.*

### Brand palette (starting direction — to refine)
- **Warm neutrals carry the "warm"**: warm-toned charcoal for dark mode (a hair of warmth,
  not cold blue-gray or pure black); a cream-tinted off-white for light mode (paper-like).
- **Brand accent:** lean into the name — **copper/amber** ("Electrace" = electric + *trace*,
  i.e. copper PCB traces). Thematically perfect for logo + primary actions.
  - ⚠️ **Caveat:** copper/amber sits near the "warning" status hue. Keep them distinct (push
    brand toward red-bronze copper, warning toward pure yellow) and rely on the icon+text
    rule so they never read ambiguously. *Safe fallback if it clashes in practice: a warm
    teal brand accent, reserving amber strictly for status.* Decide with real pixels.

## Typography
- **UI:** Inter (or similar clean humanist sans).
- **Values / nets / specs:** a monospace (e.g. JetBrains Mono) — numbers and nets read as
  precise/technical, reinforcing credibility.

## Layout & information architecture
```
┌─ top bar: project · theme toggle · symbol standard · design-wide lint summary ─┐
├──────────┬──────────────────────────────────────┬──────────────────────────────┤
│ block    │                                      │  context panel (persistent)  │
│ library  │            canvas (dark)             │  - selected block explanation │
│ palette  │     blocks + terminals + wires       │  - declared spec              │
│ (collap- │                                      │  - lint reasoning (the math)  │
│  sible)  │                                      │  - drill-in: internals + "why"│
└──────────┴──────────────────────────────────────┴──────────────────────────────┘
```
- **Persistent right-hand context panel**, not a fleeting hover popover — better for
  learning (you can read while you work). Hover still highlights; selection pins detail here.
- **Design-wide lint / budget summary** in the top bar (ties to the budget-gauges idea):
  total power, cost, etc., tallied from declared numbers.

## Block node visual (modern + warm hybrid)
- Rounded rectangle, warm-charcoal fill, subtle border, **function glyph + name** header,
  one **declared-spec line** (e.g. "9–18V → 5V · 3A"), a **status chip** (icon+color+text),
  input/output **handles (terminals)** on the sides.
- **Discrete vs. IC at a glance:** a subtle indicator (chip glyph vs. discrete-parts glyph)
  so the discrete-friendly ethos is visible on the canvas.

## Nets as connectors (core interaction)
Each block exposes named, typed nets on its edges (power / rail / ground / signal),
color-coded (power=amber, rail=green, gnd=gray, signal=blue — a family separate from lint
status). **Connections are net-to-net** — 5 V to 5 V, GND to GND — and wires inherit the net
color. Because nets are typed connectors, the tool can:
- **flag forgotten nets** — any exposed net wired to nothing is shown as a dashed "open net"
  and counted, so nothing is silently dropped;
- (future) **catch mismatches** — warn when an output net's declared voltage doesn't match
  the input it's wired to.
Both the card (edge ports) and the side panel ("Exposed nets") show a block's interface
without opening it.

## Views: Blocks (edit) vs Schematic (read-only)
A view toggle in the editor — **Blocks | Schematic** (PCB/BOM later).
- **Blocks** — the editable design surface: the top-level block graph + net connectors.
  Editing happens here (and by drilling into a block to edit *its* internals). The only
  editable paradigm.
- **Schematic** — a **read-only, fully-laid-out** traditional schematic of the *entire*
  design: every block flattened into its real parts and wires, nets stitched across block
  boundaries. Generated, not authored (a projection — see [data-model.md](data-model.md)).
  - **Read-only on purpose:** edits have a clear home (a block); a flat schematic doesn't.
    A banner makes it explicit: "Read-only — edit in Blocks view."
  - **Click a part → jumps to its owning block** in Blocks view (where you can edit). Hover-
    to-explain works here too.
  - **Composes with "expand to discrete":** toggle it and the flat schematic becomes the
    *fully discrete* schematic of the whole board — the "build it from parts" / handoff view.
  - **It's the export source** (KiCad netlist, printable PDF, fab handoff).
  - **Layout** composes each block's *authored* internal layout (arrange sections + draw
    inter-block nets) rather than auto-placing loose parts from scratch — tractable, and it
    looks intentional.

## "Expand to discrete" (supported ICs)
Expandable IC blocks carry a small **badge** and an **"⇲ Expand to discrete"** action
(alongside the normal drill-in). Triggering it swaps the chip for its authored
discrete-equivalent schematic *in place*, preserving the block's exposed nets so nothing
re-wires. A **collapse** control returns to the IC, and a **tradeoff strip** (part count /
board area / cost / performance notes) shows what the swap costs. ICs without a meaningful
discrete equivalent (MCU, FPGA, modern switchers) show no badge. See concept.md.

## Progressive disclosure — what's shown when
- **Default on canvas:** glyph, name, one spec line, status chip. Calm.
- **On select → context panel:** full explanation, all declared values, the lint *reasoning*
  ("Load wants 1.8A; input rated 2A → OK").
- **Drill-in:** internals with per-part "why."
- **Pro density option:** a setting to show raw values inline / pin panels open — pros get
  density without forcing it on learners.

## Tone & microcopy (a visible design choice)
- Plain language, **no unexplained jargon**; define a term inline on first use (link to its
  own explainer block).
- **Conversational status** ("Plenty of headroom — 15 W of 25 W"), not just "OK". This is
  much of what makes it feel friendly to learners without changing the visuals.

## First-run experience (ease of use)
1. **Symbol-standard picker** (ANSI vs IEC, shown via the resistor — teaches while it asks).
2. **Pre-loaded sample chain** (power entry → regulator → load) so the tool demonstrates
   itself immediately — hover a block, see it explain itself, see a lint badge.
3. Theme defaults to dark (respect system pref if set).

## Logo / brand (decided)
**Electrace** mark = an open **"C"** (circuit + C-language IDE heritage) with a **resistor
trace** running through it that terminates in two **net-terminal dots** — the same connector
motif as the editor. Wordmark is **monospace** (JetBrains Mono) with a **code caret**, to
signal "IDE / dev tool." Accent is **blue** (matches the app). Assets:
[mockups/electrace-logo.svg](mockups/electrace-logo.svg) (vertical lockup) and
[mockups/logo.html](mockups/logo.html) (lab: backgrounds, accents, icon sizes, horizontal
lockup). _Production TODO: convert the wordmark `<text>` to outlined paths so the final
asset is font-independent._

## Open design decisions (next)
- ~~Accent~~ **DECIDED: blue** (`#4c8dff`). Mid theme carries a blue-tinted dusk. (Copper
  was dropped — too brown against the palette.)
- Block previews are colorized: traces in the accent, component bodies as bright filled
  boxes for contrast.
- Logo / wordmark for "Electrace."
- The block glyph set (function icons) — needs a consistent visual language.
- Wire/net styling (color-by-net? color-by-voltage-domain?).
