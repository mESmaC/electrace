---
category: Calculators
---

# AcPowerCalculator
AC power and power-factor-correction calculator on Electrace's `/calculators/ac-power` page.

**When to use:** When you need real/apparent/reactive power and phase angle for a single- or three-phase load, plus the correction capacitor to hit a target power factor.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. A single/three-phase toggle drives inputs for voltage (V), current (A), and power factor; further sections take target PF and line frequency (single-phase only) for the correction cap, and power in/out for efficiency.

**Example:**
```tsx
import { AcPowerCalculator } from "@electrace/ui";

<AcPowerCalculator />
```
