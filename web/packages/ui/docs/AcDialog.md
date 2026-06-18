---
category: Editor
---
# AcDialog
The frequency-response (Bode) dialog — pick two points of a resolved design and get the real H(jω):
magnitude + phase across a log sweep, the −3 dB corner marked, and the solver's honesty notes. All
client-side exact math (closed-form on R/C/L), not simulation.

**When to use:** To show a design's AC behavior. Driven by a `ResolvedDesign` (`@electrace/core`'s
`resolve(design, blocks)`); `frequencyResponse(rd, from, to, sweep)` computes the curve on demand.

**Props:**
- `rd` — `ResolvedDesign` — the resolved design whose terminals populate the In/Out pickers.
- `onClose` — `() => void` — close handler (backdrop click).

**Example:**
```tsx
import { AcDialog } from "@electrace/ui";
import { resolve } from "@electrace/core";

const rd = resolve(design, blocks); // a resolved RC low-pass, regulator, filter, …
<AcDialog rd={rd} onClose={() => {}} />
```
