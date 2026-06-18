---
category: Editor
---
# DiscreteModal
The "break into discrete" modal — a read-only look at what a supported IC is, built from discrete parts: the drawn schematic (via SchematicPreview), a how-it-works note, and the parts table.

**When to use:** When the user expands an IC to its teaching equivalent. Driven by a `DiscreteEquivalent` from the part-keyed library (`@electrace/core`'s `DISCRETE_LIBRARY`).

**Props:**
- `eq` — `DiscreteEquivalent` — `{ ic, name, note?, schematic, layout? }`; the discrete equivalent to show.
- `partRef` — `string?` — the design ref being expanded (shown in the subtitle).
- `onClose` — `() => void` — close handler (also bound to Escape / backdrop click).

**Example:**
```tsx
import { DiscreteModal } from "@electrace/ui";
import { DISCRETE_LIBRARY } from "@electrace/core";

<DiscreteModal eq={DISCRETE_LIBRARY["ldo-3v3"]} partRef="U1" onClose={() => {}} />
```
