// Single source of truth for "what Electrace is / what's new" — rendered on the public /help page AND
// fed to the assistant (Sparky) via the electrace_help tool, so it can help users with the app itself,
// not just their design. Keep this current as features ship.

export interface ChangeEntry { date: string; title?: string; items: string[] }

/** Reverse-chronological, ONE entry per day — every functionality change that day, grouped by area.
 *  `date` is the ISO day (or "Foundations" for the original core). Keep current as features ship. */
export const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-06-09",
    items: [
      "**Net labels:** a block's internal schematic now has **net labels / power flags** (in the Power palette) — drop one on a pin and name it (`+5V`, `+3V3`, `GND`…), and **every label, port, or power symbol with that same name is the same net, with no wire between them**. So a row of bypass caps can fan out to a rail without a single wire crossing the whole row, and multiple ground symbols collapse to one ground — the way a real schematic tool works. Crucially, **differently-named labels stay separate even when drawn collinear**, so two rails laid out as one visual row don't short together.",
      "**Clearer short detection:** when a block's own internal wiring ties two incompatible terminals together (say a 5 V rail to a 3.3 V rail, or a rail to ground), the checker now flags the **block that's internally shorted** and names the two terminals — instead of blaming your top-level wiring — and it suppresses the cascade of phantom over-voltage / dueling-driver warnings that the one short was causing.",
      "**Findings highlight where they are:** a block with a live issue now **lights up in its severity color** — a red ring + glow for an error, amber for a warning — right on the canvas, and **clicking a finding jumps to that block** and highlights it. Inside a block, locating a problem pulses the affected part or wire in the same red/amber so you can see *exactly* what it's pointing at instead of hunting for it.",
    ],
  },
  {
    date: "2026-06-08",
    items: [
      "**Settings:** a proper **settings page** (from the account menu) to change your theme, accent, ANSI/IEC symbols, role, and local-capture preference — and edit your display name — any time after onboarding.",
      "**Block library:** the library index is now **searchable** and **filterable by category**.",
      "**Schematic export:** export a **KiCad netlist (.net)** of the whole stitched design straight from the editor toolbar (alongside Export and Report).",
      "**Polish:** friendly **404 and error pages**, and real **Privacy** and **Terms** pages (linked from sign-up and the footer).",
      "**Landing page:** a cleaner, roomier **hero animation** — the two-block preview is properly spaced with port-to-port wires, terminal labels no longer overlap the blocks, and the hover-to-explain tooltip and lint bubble sit clear of everything.",
      "**Site look:** a subtle **schematic dot-grid + ambient glow** backdrop across the pages, so the background has a bit more depth instead of reading flat.",
      "**Themed dialogs & right-click menus:** the browser's plain prompt/confirm boxes are replaced with **in-app themed dialogs** (Escape/Enter, click-away to cancel). **Right-click** now opens a themed menu — on a block (open · duplicate · delete), on empty canvas (fit to view · clear selection), and on a dashboard design (open · star · rename · delete).",
      "**Dashboard:** each design now shows its **lint status** at a glance (Ready / N issues / N warnings), an **Open issues** total across your designs, **sort** (last edited / name / issues) and a **grid ↔ list** toggle, plus **starring** designs with a working **Starred** filter (and a **Drafts** view for empty boards).",
      "**Hover-to-explain:** hover any block on the canvas to get a quick **tooltip** — its spec, inputs/outputs, what parts are folded inside, and a key limit note — the same at-a-glance read the home page shows off.",
      "**QFP blocks:** pin labels on big (QFP-style) chips no longer **overflow off the block** — top/bottom labels now read down/up into the chip and every label is clamped to stay on-body.",
      "**Brand:** the Electrace **logo mark** — the circuit-C with a resistor trace — now sits beside the wordmark in the nav, footer, sign-in, and onboarding, and shows up as the browser **favicon** (themed to the page).",
      "**Wire-to-wire junctions:** in a block's internal schematic you can now **end a wire on any point along an existing wire** — a junction tap — instead of only pin-to-pin. The two are electrically joined (a junction dot marks the tap), so you can branch a net without routing all the way back to a pin.",
      "**Footprint imports:** the PCB editor can now **import real KiCad `.kicad_mod` footprints** — a single file or a whole library's worth at once — into a browsable **footprint library** (with a land-pattern preview of each), and **assign one to a part**: select a component, open Footprints, hit **Use**. The part's pins map onto the imported pads and the ratsnest follows; **Use default** reverts. Or hit **Auto-match parts** to assign library footprints to every part that matches by package (e.g. an 0805 cap → the library's `C_0805`) in one go. It's undoable and saved with your board.",
      "**Pricing & tiers:** a **/pricing** page with three tiers — **Hobby** (free, up to 10 designs), **Pro** (unlimited + private designs + manufacturing exports), and **Team** — a founding early-adopter note, and an FAQ. The dashboard shows your **10-design Hobby allowance** with an upgrade prompt when you hit it. Linked from the nav, footer, and dashboard.",
      "**Sparky is a Pro feature:** the AI assistant (build/wire/explain) is now part of **Pro** — on the free Hobby plan the assistant pane shows an upgrade prompt. Everything else on Hobby is unchanged.",
      "**Accounts:** real **cloud accounts** — sign up with **email + password** (with email confirmation) or **continue with GitHub / Google**, and your session now follows you **across devices** instead of living only on one browser. The top bar shows **Log in / Sign up** when signed out and your **avatar menu** (your designs · settings · log out) when signed in. The **app requires signing in** — the editor, your dashboard, settings, and onboarding — while the **marketing pages, block library, and help stay public**.",
    ],
  },
  {
    date: "2026-06-07",
    items: [
      "**Sparky (assistant):** named **Sparky** ✨ with a friendlier face; opens into a **collapsible side pane** over the canvas (was a small popup); **multiple conversations** — new / switch / delete, each named from its first message and saved; replies render as **markdown** (tables, lists, code); shows **live progress while it works** instead of a static typing indicator; for a big multi-block build, Sparky fans the work out to its **sparks** and builds blocks in parallel, then places, wires, and reviews them; **bias-to-action** — finishes obvious steps instead of asking permission; can answer questions about **Electrace itself + what's new**; reads a block's details, sets values without re-authoring, exposes chip pins as a header, authors discrete/passive parts, places connectors, and reads power budgets.",
      "**Blocks & authoring:** a block is a **functional subcircuit** (multiple parts folded in), not one-part-per-block; re-authoring **auto-reconnects renamed pins** instead of orphaning wires; **shared-value guardrail** warns when one shared block can't carry per-instance values; values are **first-class** and editable.",
      "**Library:** **relay** variants (SPST / DPDT / solid-state); **Mini-USB-B** and **Micro-USB-B** connectors; connectors are placeable by the assistant.",
      "**Checks & analysis:** **acknowledge** a correct-but-noisy finding so it mutes with a reason (and grouped acknowledgements now mute every matching pin); a **connector-capacity** note when a header is maxed; **power budgets** surfaced (draw vs capacity, headroom); the findings panel and help now say plainly that checks are **structural, not a simulation** — clean = sane, not validated.",
      "**Declare loads & sources from the UI:** power/rail terminals now take a **voltage + current** in the block form and the right-hand inspector, so a source or static load shows up in the budget (instead of reading 0 W).",
      "**Appearance:** **three themes** — Light / Mid / Dark (Mid default) — from a selector, and the editor themes too; **user-assignable glyph colors** per block; an **accent color** you can pick.",
      "**Onboarding:** a first-run **welcome wizard** — pick your role, choose **ANSI vs IEC symbols** (a teaching picker that shows a resistor both ways), and your theme + accent — all applied live as you pick, then it opens a sample design to explore.",
      "**Dashboard:** the projects home is now a real dashboard — a workspace sidebar, **jump-back-in** recents, **start-from-a-template** cards, and a **searchable design grid** with live thumbnails + block counts (and a friendly empty state).",
      "**Account pages:** **login / sign-up** screens (GitHub / Google + email, split-layout with a product showcase).",
      "**Landing page:** a real home page — an **animated** hero with a live product-window preview (floating window, mini block schematics, a hover-to-explain cursor, a lint bubble), how-it-works, the see-inside transparency story, typed-nets, why-Electrace, the design → PCB → build path, scroll-reveal sections, and a start-free CTA.",
      "**PCB editor:** **connectors now land on the board** with real footprints (a 2×20 header is a proper 2-row grid, not a 100 mm row) and the ratsnest connects them; **size-aware auto-placement** so big parts don't overlap; **faster zoom**; authored **chips land their real package** (e.g. QFP-32 with all 32 pads).",
      "**Site:** a **Help & Changelog** page; social-share metadata (OpenGraph/Twitter card), sitemap + robots for the public block pages.",
      "**Fixes:** assistant reply truncation; authored blocks now reach the BOM/analyzer; light-mode contrast (white text/symbols on light); theme load flash + hydration warning.",
    ],
  },
  {
    date: "2026-06-06",
    items: [
      "**Connectors:** added as a first-class concept — place them on the canvas and **drag a block terminal onto a connector pin to dock** it as board-edge I/O.",
      "**Blocks:** **edit a user block after creating it**; **expose a chip's pins as block terminals** one at a time (as needed); **QFP-style rendering** for high-pin blocks; the assistant can **author a block's internal schematic with a real chip** (so it hits the BOM + footprints, not a hollow shell).",
      "**Palette:** reorganized into a **2-wide grid** with collapsible **My blocks / Library / Connectors** sections; drag blocks/connectors straight onto the canvas.",
      "**Fixes:** duplicate-terminal canvas crash; block persistence across refresh; live-edit refresh; orphan ports; net-markers wrongly becoming duplicate PCB components.",
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
Electrace's checks are **structural — not a simulation.** They look at how your design is connected and
the values you declared, and catch the dumb-but-deadly mistakes: two drivers fighting on a net, an
undriven rail, an open/unconnected pin, a power pin tied to ground, a rail drawing more than its source
can supply, a polarized part wired backwards.

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
    `## ${e.date}${e.title ? ` — ${e.title}` : ""}\n\n${e.items.map((i) => `- ${i}`).join("\n")}`,
  )].join("\n\n");
}

/** Combined reference handed to the assistant on demand (features + recent changelog). */
export function electraceHelpText(): string {
  const recent = CHANGELOG.slice(0, 2);
  const log = recent.map((e) => `### ${e.date}${e.title ? ` — ${e.title}` : ""}\n${e.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
  return `${FEATURES_MD}\n\n---\n\n# Recent changes\n\n${log}`;
}
