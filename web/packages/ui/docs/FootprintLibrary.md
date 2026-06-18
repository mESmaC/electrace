---
category: Schematic & Symbols
---
# FootprintLibrary
The footprint-library modal — browse imported KiCad `.kicad_mod` land patterns (each shown via
FootprintPreview with pad count / package kind / size), import more, and optionally assign one to a
selected PCB part. Import/remove are localStorage/API-backed in the app.

**When to use:** The "Footprints" overlay in the PCB editor. With no `assignTo` it's a browse/manage
library; with `assignTo` set, clicking a footprint assigns it to that part.

**Props:**
- `onClose` — `() => void` — close handler.
- `assignTo` — `string?` — the PCB part ref being assigned (switches to assign mode).
- `currentId` / `onAssign` / `onClear` / `onAutoMatch` — assignment callbacks (optional).

**Example:**
```tsx
import { FootprintLibrary } from "@electrace/ui";

<FootprintLibrary onClose={() => {}} />
```
