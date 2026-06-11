# The Electrical Engineer's IDE

## Core idea

A schematic capture tool organized around **blocks** that explain themselves.

You design a circuit the normal way, but the unit of organization is a block — a
power-entry block, a rectifier block, a regulator block, a gain stage. Each block is a
bounded region of a real schematic with defined input and output terminals that land on
real nets. Blocks are an organizational and explanatory layer over an ordinary
schematic — not a new language, not a programming metaphor.

The thing that doesn't exist today: **you can interrogate everything.** Hover a block,
or hover an IC inside it, and the tool tells you what's happening electrically — what
this part does, why it's there, what the block was designed to do. Nothing is a black
box you can't see into, whether it's built from discrete parts or from an IC.

## Why it matters

EE tools descend from the drafting table. KiCad, Altium, and the rest capture geometry
and connectivity faithfully but are agnostic about *meaning* — they'll let you wire a
3.3V part to a 5V net and say nothing, because a drafting table has no opinions. Nobody
rebuilt the schematic tool around **intent** the way code IDEs got rebuilt around the
AST.

The IDE mapping is nearly one-to-one:

- **hover docs** → hover a block/part and see what it's doing electrically
- **go-to-definition** → drill from a block into its internals (discrete or IC)
- **linting / red squiggles** → lightweight checks: declared numbers that don't add up,
  a limit you've crossed
- **autocomplete** → "you need 18V → 5V at 3A — here are blocks that fit"

This also reframes the discrete-vs-IC question. The instinct to go discrete is really an
instinct for transparency — discrete is currently the only way to *see inside*. Give the
designer x-ray vision into ICs too and the IC stops being the problem. You don't have to
avoid ICs; you just get to see inside them.

## What it is NOT

- **Not a circuit simulator.** No SPICE solve. It never tries to compute the behavior of
  the circuit from physics.
- **Not magic.** It does not know "what's going to be put on this pin." Nets are nets;
  they connect, that's all.
- **Not a tool for kids.** This is for engineers who want a faster, more transparent,
  more forgiving design surface.

## How the "smarts" actually work

Each block carries the **design intent the author typed in** — e.g. "buck-boost, Vin
9–18V, Vout 5V, 3A" — plus plain-language notes and stated limits ("exceed ~20V in and
the input cap is the thing that lets go").

The tool does **bookkeeping on numbers you supplied**, not analysis:

- arithmetic: 5V × 3A = 15W; at ~85% efficiency that's ~1.8A from a 9V input
- threshold checks: that ~1.8A is past the 2A you said the input block could give → flag
- limit notes: surface the author's warning when a connected net's declared value crosses
  a stated limit

Estimates, flags, and warnings — always from declared values, never from solving the
circuit.

## The three honest layers

1. **Blocks** that hold their own design spec and intent.
2. **Hover** that shows that spec plus a plain-language explanation of what's inside
   (discrete or IC — doesn't matter).
3. **Lightweight checks** that are just math and threshold comparisons across the numbers
   you've already declared.

## Breaking an IC into discrete

For *supported* ICs, you can do more than see inside — you can **expand the IC into an
equivalent discrete circuit you could actually build.** Click "Expand to discrete" on an
op-amp, a linear regulator, a 555, a logic gate, and the single chip is replaced by the
transistor/R/C version that does the same job. This is the literal endpoint of the thesis,
and it answers the two original reasons to prefer discrete: transparency, and *being more
likely to have the parts on hand.*

Honest constraints (this is why it works):
- **Authored, not generated.** The block author supplies the discrete equivalent. The tool
  swaps one authored representation for another — it never *derives* a circuit. Still no
  magic, still no SPICE.
- **Only "certain" ICs.** A 555, op-amp, linear regulator, comparator, logic gate, H-bridge
  have teachable, buildable discrete equivalents. An MCU, FPGA, or modern switcher does not —
  so expandable ICs are **badged**, and the rest simply don't offer it.
- **Functionally equivalent, not spec-identical.** A discrete 7805 ≠ an LM7805. The discrete
  version carries its *own* declared specs and a **tradeoff readout** (part count, board
  area, cost, performance) so you choose with eyes open. (Pairs with the tradeoff-assistant
  idea in [ideas.md](ideas.md).)
- **Reversible & net-preserving.** Collapse back to the IC anytime; the discrete version
  exposes the *same* terminals/nets, so it drops into the design without rewiring.

Why it matters: learning (see the guts you can build), **availability / vendor-neutrality**
(can't source the chip — build it from parts on hand), and the ultimate "nothing is a black
box."

## Where the real work is

The editor chrome is the easy 20%. The value and the moat is the **block library with
authored intent** — the corpus of self-explaining blocks with declared envelopes. Like
an IDE without its language server and ecosystem, the editor is nearly worthless without
it. And it compounds: every good block added makes the whole thing more useful.

## Smallest thing that proves it

One chain — power entry → rectifier → regulator → load — where each block holds its
declared spec, hovers to a plain-language "here's what's inside and why," and does the
watts/amps arithmetic to flag when you under-spec the input. If that feels as good to use
as imagined, the idea is real and the rest is scale.

## Longer-horizon ideas (parked, not core)

- Schematic → PCB → order flow.
- Kitted delivery: receive each block of your design separately packaged, assemble it
  yourself to learn, or get it pre-assembled.
