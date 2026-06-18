---
category: Schematic & Symbols
---
# SchematicPreview
A static, non-interactive thumbnail of a block's internal schematic — real placed symbols and wires, with wires colored by net health. Used on block cards, the editor canvas, and share pages.

**When to use:** To render a finished schematic (a block's authored `layout`) as an inline SVG anywhere a read-only diagram is wanted.

**Props:**
- `blockId` — `string` — identifies the block (also used to pick up a saved editor draft, if any).
- `layout` — `SchematicLayout?` — `{ symbols: PlacedSymbol[]; wires: SchematicWire[] }`; the authored schematic to draw. Without it (and no draft) the card shows "no schematic yet".
- `height` — `number | "fit"` — pixel height, or `"fit"` to size to the drawing's natural extent. Defaults to `84`.

**Example:**
```tsx
import { SchematicPreview } from "@electrace/ui";

<SchematicPreview
  blockId="bridge-rectifier"
  height="fit"
  layout={{
    symbols: [
      { id: "D1", type: "diode", ref: "D1", x: 195, y: 101, rot: 270 },
      { id: "C1", type: "cap-pol", ref: "C1", value: "470µF", x: 438, y: 96, rot: 90 },
      // …ports + remaining diodes
    ],
    wires: [{ from: "D1.2", to: "C1.1" } /* … */],
  }}
/>
```
