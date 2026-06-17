---
category: Schematic & Symbols
---
# SchematicSymbolGallery
The full Electrace schematic-symbol library laid out by group (Passive, Diode, Transistor, Integrated, Source, Power, Electromechanical, Connector), each symbol rendered via `SchematicSymbol` with its label.

**When to use:** As a palette or reference page when you want to show every available symbol at once. Empty groups are skipped.

**Props:**
- `standard` — `SymbolStandard` (`"ansi"` | `"iec"`) — drawing standard applied to every symbol. Defaults to `"ansi"`.

**Example:**
```tsx
import { SchematicSymbolGallery } from "@electrace/ui";

<SchematicSymbolGallery standard="iec" />
```
