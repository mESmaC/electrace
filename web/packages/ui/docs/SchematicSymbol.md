---
category: Schematic & Symbols
---
# SchematicSymbol
A single themed schematic symbol rendered as inline SVG, drawn from Electrace's real editor symbol library (`SYMBOLS`). Body strokes inherit the text token; leads/pins use the blue accent.

**When to use:** To drop one schematic symbol (resistor, capacitor, NPN, LED, etc.) into a design or doc, in either drawing standard. Returns `null` for an unknown `type`.

**Props:**
- `type` — `SymbolType` (string) — which symbol to draw; see `SYMBOL_TYPES` / `SYMBOL_GROUPS`.
- `standard` — `SymbolStandard` (`"ansi"` | `"iec"`) — drawing standard (ANSI zigzag vs IEC boxed). Defaults to `"ansi"`.
- `size` — `number?` — rendered width in px; height follows the symbol's aspect ratio. Defaults to `56`.
- `showLabel` — `boolean?` — show the symbol's label beneath it. Defaults to `false`.
- `className` — `string?` — applied to the `<svg>`.

**Example:**
```tsx
import { SchematicSymbol } from "@electrace/ui";

<SchematicSymbol type="resistor" standard="iec" size={64} showLabel />
```
