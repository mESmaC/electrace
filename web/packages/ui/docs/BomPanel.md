---
category: Editor
---
# BomPanel
The bill-of-materials panel: every line is buyable. Rows link to a Digi-Key search (or a one-click cart when an exact part number is declared), with a CSV export and the FTC affiliate disclosure.

**When to use:** To show a design's BOM with purchase links. Network actions (cart, CSV gating, Sparky) only fire on click, so it renders fully static from the `rows` prop.

**Props:**
- `rows` — `BomRow[]` — `{ qty, type, value?, footprint?, part?, polarized?, refs: string[] }[]`.
- `designName` — `string` — used for the CSV filename and cart name.
- `pro` — `boolean | null` — gates CSV export (Pro feature); `false` shows the upgrade nudge, `null` passes.

**Example:**
```tsx
import { BomPanel } from "@electrace/ui";

<BomPanel
  designName="Bridge Rectifier"
  pro={false}
  rows={[
    { qty: 4, type: "diode", part: "1N4007", footprint: "DO-41", refs: ["D1", "D2", "D3", "D4"] },
    { qty: 1, type: "cap", value: "470µF", footprint: "radial-8mm", polarized: true, refs: ["C1"] },
  ]}
/>
```
