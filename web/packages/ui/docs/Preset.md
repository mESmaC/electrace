---
category: Form primitives
---
# Preset
A small selectable chip button used on Electrace calculator pages to quickly load preset values.

**When to use:** For a row of one-tap presets (e.g. common voltages or footprints) where one chip can show an active/selected state.

**Props:**
- `label` — `string` — text shown in the chip.
- `onClick` — `() => void` — fired when the chip is clicked.
- `active` — `boolean?` — when true, renders in the selected (accent-outlined) state.

**Example:**
```tsx
import { Preset } from "@electrace/ui";

<Preset label="3.3V" active={vin === 3.3} onClick={() => setVin(3.3)} />
```
