---
category: Calculators
---

# AcMotorCalculator
Three-phase AC induction-motor calculator on Electrace's `/calculators/ac-motor` page.

**When to use:** When sizing or analyzing an induction motor — to find synchronous speed, slip, rotor frequency, shaft torque, input power, and efficiency.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. Inputs cover line frequency (Hz), poles, rated speed (rpm), mechanical power out (W), line-to-line voltage (V), line current (A), and power factor; presets seed 60 Hz·4P·1750 and 50 Hz·2P·2880.

**Example:**
```tsx
import { AcMotorCalculator } from "@electrace/ui";

<AcMotorCalculator />
```
