# Demo Build Plan — the one-chain proof

_The smallest thing that proves the concept AND doubles as the validation artifact (see
[validation.md](validation.md)). Goal: something playable enough to screen-record in week 1,
not a product. Scope discipline is the whole game here._

## What the demo must show (and nothing more)

A single chain — **power entry → regulator → load** — that demonstrates the two pillars:

1. **Pillar (a) — transparency.** Hover any block → a panel shows its plain-language
   explanation ("Linear regulator: drops 9V to 5V; the divider sets output, the cap sets
   stability"). Click to **drill in** → see the block's internal parts with a one-line "why"
   on each. Works the same whether the block is discrete or an IC.
2. **Pillar (b) — deterministic lint.** Each block carries declared specs. The tool does
   pure arithmetic across the wired chain (watts, currents, efficiency) and flags when
   numbers don't add up or cross a declared limit — a green/amber/red badge per block, plain
   text: "Load wants 1.8A; input block rated 2A — OK" / "...rated 1.5A — OVER."

That's it. If a stranger watches a 60-second clip of *those two interactions* and says "I
want that," the concept is proven.

## Explicitly OUT of scope (resist all of these)
- ❌ Simulation / SPICE of any kind (it's the thing we're *not*)
- ❌ Real netlist export, PCB layout, routing, or ordering
- ❌ Arbitrary user-drawn blocks (ship ~5 hand-authored ones)
- ❌ Accounts, backend, persistence (static block library, in-memory state)
- ❌ Auto-inferring anything about pins (numbers come from declared metadata only)
- ❌ Mobile, theming, polish beyond "looks clean in a screen recording"

## The core design decision: the block data model

This is the one thing worth getting right, because everything hangs off it. A block is just
declared data:

```
Block {
  id, name, kind: "power-entry" | "regulator" | "load" | ...,
  terminals: [ { id, role: "in"|"out"|"gnd", net, declared: { vMin, vMax, iMax } } ],
  spec:      { vinMin, vinMax, vout, ioutMax, efficiency },   // author-declared
  explanation: "plain-language: what this block does and why",
  internals: [ { ref: "R1", value: "10k", why: "top of feedback divider" }, ... ],
  limits:    [ { field: "vinMax", value: 20, note: "input cap rating; exceed and it lets go" } ]
}
```

- **Terminals carry declared specs** (not inferred) → that's what the lint compares across a
  wire. Nets are just connectivity.
- **`explanation` + `internals[].why`** = pillar (a), authored text, no magic.
- **`limits[]`** = the author's "here's how it dies" notes, surfaced when a connected net's
  declared value crosses them.

The **lint engine is pure functions** over this data: `power = vout * iout`,
`inputCurrent = power / (vin * efficiency)`, compare against connected terminal's `iMax`,
compare net voltage against `limits`. Deterministic, trivially testable, no solver.

## Stack (decided — built on the real stack, see [stack.md](stack.md))
- **Next.js (App Router) + TypeScript** — same stack as production, so the demo is not
  throwaway. Deploys to **Vercel** → the shareable URL you drop in a Reddit thread.
- **React Flow** for the `/editor` canvas (client component, `ssr:false`) — draggable nodes
  with typed input/output **handles (ports)** out of the box. Custom node renders each block
  + its lint badge.
- **Zustand** for editor state. **Tailwind** for the UI.
- **Blocks as MDX** — each block is an MDX file: frontmatter (spec/terminals/limits) + body
  (plain-language explanation). The editor reads frontmatter for lint and renders the body
  in the hover/drill panel; the same file also powers a public `/blocks/[slug]` SEO page.
  One authored file → product + marketing + checks.
- **Hover/drill UI** — side panel renders the MDX body; drill-in shows `internals` with the
  "why" per part. No nested-canvas zoom in v1 (that's a concept.md dream, not a demo need).

_(`usn-elec-cad` is unrelated — ignored.)_

## Milestones (week 1, going-hard pace)
1. **Canvas + 3 placed blocks wired** (React Flow, custom node, terminals as handles). ~½ day
2. **Block data model + static library** of 5 blocks (2 regulators incl. a discrete vs. IC
   pair, power entry, a load, maybe a rectifier). ~½ day
3. **Hover panel** showing explanation; **drill-in modal** showing internals + why. ~1 day
4. **Lint engine** (pure functions) + per-block green/amber/red badge with plain-text
   reason. ~1 day
5. **The money interaction:** swap the regulator block (IC ↔ discrete), watch the
   explanation change and the lint re-run. ~½ day — *this is the clip you post.*
6. **Polish for recording** + deploy to a URL. ~½ day

## The one shot that sells it
Record: drop a load that draws too much → block goes red, plain-English "OVER" reason →
swap the regulator block for a beefier one → hover it to read what changed → badge goes
green. ~30 seconds. That single loop demonstrates transparency *and* linting *and* the
discrete/IC swap in one breath. Everything in this plan exists to make that clip possible.
