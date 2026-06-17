---
category: Calculators
---

# LcResonanceCalculator
LC resonance tool on Electrace's `/calculators/lc-resonance` page: from L, C, and a test frequency it reports the resonant frequency, reactances XL and XC, and characteristic impedance — plus a section for series/parallel L and C combinations.

**When to use:** Drop into the LC-resonance route when a user needs an LC tank's resonant frequency, the reactances at a given frequency, or combined values of series/parallel inductors and capacitors.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { LcResonanceCalculator } from "@electrace/ui";

<LcResonanceCalculator />
```
