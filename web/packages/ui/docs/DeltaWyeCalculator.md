---
category: Calculators
---

# DeltaWyeCalculator
Interactive Delta↔Wye (Δ↔Y) resistor-network converter on Electrace's `/calculators/delta-wye` page.

**When to use:** When you need to transform a three-resistor delta into its equivalent wye (star), or vice versa, to simplify a bridge or three-phase network.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. It has a Δ→Y / Y→Δ mode toggle and three resistance inputs (Ω); outputs the three equivalent legs formatted via `fmtOhms`, warning if any input is not positive.

**Example:**
```tsx
import { DeltaWyeCalculator } from "@electrace/ui";

<DeltaWyeCalculator />
```
