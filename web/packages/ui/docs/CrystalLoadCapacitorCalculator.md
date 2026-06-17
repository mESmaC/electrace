---
category: Calculators
---

# CrystalLoadCapacitorCalculator
Crystal load-capacitor calculator on Electrace's `/calculators/crystal-load-capacitor` page.

**When to use:** When picking the two load caps for a quartz crystal so the oscillator sees its datasheet load capacitance once board strays are accounted for.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. Inputs are the crystal's rated load capacitance CL (pF) and board stray capacitance (pF); outputs the exact per-cap value (`C = 2×(CL − Cstray)`), the nearest E12 standard value, and the actual CL the crystal will see, warning if strays meet or exceed CL.

**Example:**
```tsx
import { CrystalLoadCapacitorCalculator } from "@electrace/ui";

<CrystalLoadCapacitorCalculator />
```
