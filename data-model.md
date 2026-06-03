# Data Model — blocks, schematics, designs, BOM

_How we store and represent everything. Refines the "blocks as MDX" note in
[stack.md](stack.md). Built on the package instinct: human-authored YAML + Markdown,
machine-written JSON, generated CSV._

## Principles
1. **Authored in human formats, compiled for the app.** Blocks are authored in YAML +
   Markdown, **validated against a JSON Schema**, then compiled to JSON the editor/lint
   consume fast. (YAML's friendliness + JSON's speed; the schema gates corpus quality.)
2. **Authored vs generated.** Blocks (corpus) = human/expert-authored, PR-reviewed → YAML +
   MD. Designs (user projects) = written by the editor → JSON.
3. **The BOM is a projection, never a source.** Always generated from a design's resolved
   parts; exported as CSV/JSON. Never hand-maintained.
4. **Versioned packages.** Every block is a semver'd package; designs pin `block@version`
   so updates never silently change someone's board. Sets up the registry/marketplace.
5. **One package feeds three.** The same block powers the editor canvas, the lint checks,
   and the public `/blocks/[slug]` SEO page.

## Formats at a glance
| Format | Used for | Why |
|---|---|---|
| **YAML** | authored block manifests (spec, terminals, schematic graph, limits, discrete-equiv) | human-diffable, PR-reviewable, registry-publishable |
| **Markdown** | block explanations (prose) | renders to the SEO page + hover panel; writer-friendly |
| **JSON** | user designs + the *compiled* runtime form of blocks | machine-written, DB-native (`jsonb`), fast |
| **CSV** | BOM **export** (also JSON BOM for APIs) | fab/distributor interchange; kitting + affiliate flow |
| _(later)_ | KiCad netlist, Gerbers | export targets, not our source of truth |

## A block is a package
```
buck-converter/
├── block.yaml      # manifest: metadata, declared spec, terminals/nets, schematic graph, limits
├── explain.md      # plain-language explanation → SEO page + hover (the prose)
├── discrete.yaml   # OPTIONAL: discrete-equivalent schematic → powers "Expand to discrete"
└── assets/         # OPTIONAL: custom symbol SVGs, images
```

### block.yaml (example)
```yaml
id: buck-converter
name: Buck Converter
version: 1.2.0
category: power
author: electrace
license: CC-BY-4.0
spec:
  vin:      { min: 9, max: 18, unit: V }
  vout:     { value: 5.0, unit: V }
  iout_max: { value: 3, unit: A }
  efficiency: 0.85
terminals:                       # the exposed nets (the block's interface)
  - { id: vin,     role: in,  type: power, v: { min: 9, max: 18 } }
  - { id: gnd_in,  role: in,  type: gnd }
  - { id: vout,    role: out, type: rail,  v: 5.0 }
  - { id: gnd_out, role: out, type: gnd }
limits:
  - { field: vin.max, value: 20, note: "Cin rated 25 V; exceed ~20 V and it lets go" }
schematic:
  parts:
    - { ref: U1,   type: ic,       part: buck-controller, why: "switches to hold 5 V" }
    - { ref: L1,   type: inductor, value: 10uH,  why: "stores/releases energy each cycle" }
    - { ref: Cin,  type: cap,      value: 22uF,  footprint: C0805, why: "bulk input" }
    - { ref: Cout, type: cap,      value: 47uF,  why: "output stability" }
    - { ref: R1,   type: res,      value: 39k,   why: "top of feedback divider — sets Vout" }
    - { ref: R2,   type: res,      value: 10k,   why: "bottom of divider" }
  nets:                            # netlist: each net lists the pins it ties together
    - { name: VIN,  connect: [U1.VIN, Cin.1, "@vin"] }      # "@vin" = the vin terminal
    - { name: SW,   connect: [U1.SW, L1.1] }
    - { name: "+5V", connect: [L1.2, Cout.1, R1.1, "@vout"] }
    - { name: FB,   connect: [U1.FB, R1.2, R2.1] }
    - { name: GND,  connect: [U1.GND, Cin.2, Cout.2, R2.2, "@gnd_in", "@gnd_out"] }
```
- **`terminals`** = the typed exposed nets (drives the connectors + the open-net check).
- **`schematic.parts` + `nets`** = a lightweight netlist (parts and what connects to what).
  `@terminal` references tie an internal net to an exposed terminal.
- **`why`** on each part = the authored reason → the hover/explainer content.
- **`limits`** = the "how it dies" notes the lint surfaces.

### explain.md
Markdown prose (overview, how-it-works, sizing math) → the public block page **and** the
hover panel. Author the prose here, the structure in `block.yaml`.

### Optional attributes that unlock richer lint
A few extra *declared* fields enable the deeper checks/recommendations in [lint.md](lint.md)
(omit them and those rules simply don't fire — never a false result):
```yaml
terminals:
  - { id: vin, role: in, type: power, polarity: "+", v: { min: 9, max: 18 } }
  - { id: agnd, role: in, type: gnd, groundClass: agnd, sensitive: true }  # analog/sensitive
block_attrs: { topology: switching, noisy: true }       # switcher → shielding/grounding hints
parts:
  - { ref: C3, type: cap, polarized: true }              # backwards-wiring check
  - { ref: L1, type: inductor, shielded: false }         # shielding recommendation
```
- `groundClass` / `sensitive` → grounding recommendations (sensitive ground on global plane).
- `polarity` on terminals + `polarized` on parts → reversed-polarity faults.
- `topology` / `noisy` → low-efficiency/thermal + shielded-inductor advice.
- net `role` (e.g. `main-power-entry`, often derived from the power-entry source) → test-point
  and rail-specific recommendations.

## A design is JSON (the user's project)
Written by the editor; lives in the DB (`jsonb`) and exports as a `.json` file. Pins block
versions; stores instances + the net-to-net wiring + canvas positions.
```json
{
  "id": "buck-supply", "name": "Buck Supply", "visibility": "public",
  "blocks": [
    { "ref": "PWR1", "block": "power-entry@2.0.1",   "pos": [40, 120] },
    { "ref": "REG1", "block": "buck-converter@1.2.0", "pos": [320, 128] }
  ],
  "connections": [
    { "from": "PWR1.vout",    "to": "REG1.vin",    "net": "VBUS" },
    { "from": "PWR1.gnd_out", "to": "REG1.gnd_in", "net": "GND" }
  ]
}
```
The lint engine walks this graph + the pinned blocks' declared specs → the watts/amps
checks and open-net detection. `visibility: public|private` drives the monetization line.

## BOM is generated → CSV
Flatten the design's resolved parts (every block instance's `schematic.parts`), merge
duplicates, and emit:
```csv
ref,qty,value,footprint,part,block,distributor_pn
Cin,1,22uF,C0805,,buck-converter,
R1,1,39k,R0603,,buck-converter,
U1,1,,SOT-23-6,buck-controller,buck-converter,
```
CSV for fabs/distributors and the kitting flow; a JSON BOM for the affiliate/order APIs.
Generated on demand — never stored as truth.

## Projections (derived views, never edited directly)
Several views are *generated* from the design graph — never separate sources of truth:
- **BOM** — flatten + merge resolved parts → CSV/JSON (above).
- **Flattened schematic** — expand each block's `schematic` netlist and **stitch nets across
  boundaries** (an internal net tied to `@vout` merges with whatever the design `connections`
  wire that terminal to). Produces the read-only full-design "Schematic view"
  ([design.md](design.md)) and the export netlist.
- **Lint results** — walk the graph + declared specs → flags.
Same principle as the BOM: derive, don't store. Edit the blocks; the projections follow.

## Versioning & registry (the npm-for-blocks angle)
- Blocks are **semver** packages published to a registry (the community library / marketplace).
- Designs pin `block@version`; "update available" is an explicit, opt-in action.
- The schema-validated YAML manifest is exactly the gate for community contribution + curation.

## Export targets (later, not source-of-truth)
KiCad netlist, Gerbers (via the PCB stage), manufacturing files. Our YAML/JSON is canonical;
these are exporters on top.

## Feeding it to an LLM
This same structured data is what the AI assistant reasons over — the design graph, declared
specs, `why` notes, lint results, and BOM, fed as a compact projection (or via query tools).
Structured + authored + deterministic = grounded AI. See [ai.md](ai.md).
