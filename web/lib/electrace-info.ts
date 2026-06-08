// Single source of truth for "what Electrace is / what's new" — rendered on the public /help page AND
// fed to the assistant (Sparky) via the electrace_help tool, so it can help users with the app itself,
// not just their design. Keep this current as features ship.

export interface ChangeEntry { date: string; title: string; items: string[] }

/** Reverse-chronological. `date` is an ISO day for shipped entries, or a label for the foundations. */
export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-06-07",
    title: "Clearer about what a check means",
    items: [
      "Help now spells out that the checks are **structural, not a simulation** — a clean result means structurally sane (typed + connected), not validated. New guidance on **what the checks do/don't catch** and **when to author a block vs use a library one**.",
      "The findings panel carries the same honest note inline.",
      "**Three themes** (Light / Mid / Dark, Mid default) with a selector; the editor themes too.",
    ],
  },
  {
    date: "2026-06-07",
    title: "Meet Sparky — the assistant grows up",
    items: [
      "The assistant is now **Sparky** ✨, with a name and a friendlier face (was the generic robot).",
      "Sparky opens into a **collapsible side pane** over the canvas instead of a small popup.",
      "**Multiple conversations** — start new chats, switch between them, delete; each is named from its first message and persists.",
      "Sparky's replies now render as **markdown** (tables, lists, code, headings).",
      "Sparky **bias-to-action**: it finishes obvious steps (landing board I/O on a connector, adding needed support parts) instead of asking permission for each.",
      "Sparky can now answer questions about **Electrace itself** and **what's new** (this page).",
    ],
  },
  {
    date: "2026-06-07",
    title: "Build real boards, not sketches",
    items: [
      "**Functional blocks** — a block is a real subcircuit (e.g. an oscillator = crystal + 2 load caps), with its support parts folded in, not one component per block.",
      "Authored **chips land their real PCB footprint** (a 32-pin ATmega → QFP-32 with all 32 pads, named pins on the right pad) — no more tiny stub packages.",
      "**Connectors for board I/O**: place USB / barrel / headers (incl. new **Mini-USB-B** and **Micro-USB-B**) and wire block terminals to their pins.",
      "**Relays**: SPDT plus new **SPST**, **DPDT**, and **solid-state (SSR)** variants.",
      "**Acknowledge** a correct-but-noisy warning (e.g. an intentional diode-OR) so it mutes with a reason instead of nagging.",
      "**Power budgets** surfaced — per-rail load draw vs source capacity, headroom, and over-budget flags.",
      "Re-authoring a block now **auto-reconnects renamed pins** instead of silently orphaning wires.",
    ],
  },
  {
    date: "Foundations",
    title: "The core idea",
    items: [
      "**Block-based, strictly-typed schematic design** — wire typed terminals (power / rail / signal / gnd, in / out); the type system catches the dumb-but-deadly mistakes.",
      "**Live deterministic linting** — open nets, two drivers fighting, undriven rails, over-current/voltage, polarity, empty blocks — without SPICE.",
      "**BOM** from the real parts inside your blocks, and a **PCB view** (footprints, ratsnest, routing, DRC, KiCad export).",
      "**Transparent** — every block can be cracked open to its real chip, footprint, and schematic; nothing hidden behind a magic box.",
    ],
  },
];

/** A user-facing guide to what you can do in Electrace — the answer to \"how do I…?\". */
export const FEATURES_MD = `# What you can do in Electrace

Electrace is the electrical engineer's IDE — a transparent, **block-based** schematic and PCB tool with
live checks, no SPICE required. Here's the lay of the land.

## Designing a schematic
- **Place blocks.** Drag from the palette (left) onto the canvas, or click to add. Blocks are grouped:
  *My blocks*, *Library*, and *Connectors*.
- **Wire terminals.** Drag from one terminal handle to another. Terminals are typed (**power / rail /
  signal / gnd**) and have a **role** (**in** = load, **out** = driver) — wiring two drivers onto a net
  flags a warning.
- **Functional blocks.** A block is a *subcircuit*, not one part — an oscillator block holds the crystal
  **and** its two load caps. Crack any block open (double-click) to see/edit its internal schematic.
- **Make your own blocks.** Create a block with the terminals you need, then draw its internal schematic
  (or have Sparky author it from a part number). Expose just the pins the rest of the design connects to.
- **Connectors** are the board-edge home for off-board nets — USB, barrel jacks, headers, screw
  terminals, RJ45. Dock a block terminal onto a connector pin.

## Checking your work
- **Live linting** runs on every change — errors, warnings, and notes appear in the bottom panel and on
  the selected block. Click a finding to jump to the block.
- **Acknowledge** a finding that's correct-but-noisy (e.g. USB + regulator legitimately sharing a rail)
  with the *mark intended* button — it mutes with your reason and stops counting.
- **Power budgets** (bottom bar) show each rail's load vs the source's capacity.

## What the checks mean (and what they don't)
Electrace's checks are **structural and deterministic — not a simulation.** They read your typed net
graph and declared values and catch the dumb-but-deadly mistakes cheaply: two drivers fighting on a net,
an undriven rail, an open/unconnected pin, a power pin tied to ground, a rail drawing more than its
source can supply, a polarized part wired backwards.

What they **don't** do: any analog or time-domain behaviour. No SPICE, no transient/inrush, no thermal,
no ripple-current-on-the-caps, no EMI or loop-stability. A clean result means your design is
**structurally sane — typed-correct and connected as intended — not that it's validated.** Component
values you (or Sparky) set are *starting points*; nothing here checks them against a real part's
datasheet. Treat a green check as "the first 80% is correct and BOM-ready," then take it to a simulator
and a real EDA/PCB review for the analog 20%. The **KiCad export** is that escape hatch — Electrace
never locks you in.

## Author a block vs. use a library block
- **Use a library block** when a stock part fits as-is (a header, a generic passive, a connector).
- **Author a block** when you need a real part or a functional grouping: an MCU/driver IC (author it
  from its part number → real footprint + BOM), or a subcircuit like a power stage or oscillator. A
  block should be a *functional unit* — fold its support parts (decoupling, gate resistors, shunts,
  load caps) inside it, and expose only the pins the rest of the design connects to. Don't scatter
  loose passives on the canvas, and don't leave a block as a hollow shell (it won't reach the BOM).

## Outputs
- **BOM** — built from the real parts inside your blocks; exportable.
- **PCB** — open the PCB view to get footprints + a ratsnest from your schematic, route traces, run DRC,
  and export to KiCad.

## The symbol library
Passives (R, C, L, crystal, ferrite, fuse…), diodes (incl. Zener, Schottky, TVS, LED), transistors
(BJT/MOSFET/JFET), ICs (with full pinouts → real footprints), sources, and electromechanical parts
including **switches and relays (SPST/SPDT/DPDT/solid-state)**.

## Sparky, your assistant ✨
Open Sparky (bottom-right) to build and reason about your design in plain language. Sparky can place and
wire blocks, **author a chip from its part number** (dropping the real IC into a block with its footprint),
add the support parts a block needs, place connectors, run the analysis, read the net graph and power
budgets, and explain what's on any net. Start a **new chat** any time; conversations are saved.`;

/** Render the changelog to markdown (for the page and the assistant). */
export function changelogMarkdown(): string {
  return ["# Changelog", ...CHANGELOG.map((e) =>
    `## ${e.title}\n*${e.date}*\n\n${e.items.map((i) => `- ${i}`).join("\n")}`,
  )].join("\n\n");
}

/** Combined reference handed to the assistant on demand (features + recent changelog). */
export function electraceHelpText(): string {
  const recent = CHANGELOG.slice(0, 3);
  const log = recent.map((e) => `### ${e.title} (${e.date})\n${e.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
  return `${FEATURES_MD}\n\n---\n\n# Recent changes\n\n${log}`;
}
