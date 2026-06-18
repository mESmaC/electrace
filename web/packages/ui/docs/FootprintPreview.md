---
category: Schematic & Symbols
---
# FootprintPreview
A small SVG of a footprint's land pattern — pads drawn to scale in mm, centred on the origin. SMD pads use the accent color; through-hole pads use amber with the drill hole knocked out.

**When to use:** To show a part's PCB footprint (in a library list, a part inspector, or a BOM row).

**Props:**
- `footprint` — `Footprint` — `{ id, kind: "smd" | "tht", pads: LandPad[], w, h }`; a pad is `{ num, x, y, w, h, round?, drill? }` (mm).
- `size` — `number?` — rendered px (square viewport). Defaults to `72`.

**Example:**
```tsx
import { FootprintPreview } from "@electrace/ui";

<FootprintPreview size={96} footprint={{
  id: "R0603", kind: "smd", w: 2.6, h: 1.5, pads: [
    { num: "1", x: -0.75, y: 0, w: 0.9, h: 0.95, round: 0.2 },
    { num: "2", x:  0.75, y: 0, w: 0.9, h: 0.95, round: 0.2 },
  ],
}} />
```
