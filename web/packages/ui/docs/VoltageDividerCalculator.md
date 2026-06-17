---
category: Calculators
---

# VoltageDividerCalculator
Resistive voltage-divider tool on Electrace's `/calculators/voltage-divider` page: computes Vout, output impedance, and divider current, plus a reverse mode that finds R2 (and the nearest E24 part) for a target output.

**When to use:** Drop into the voltage-divider route when a user needs Vout for given R1/R2/Vin, or wants to size R2 to hit a target voltage with a real standard resistor.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { VoltageDividerCalculator } from "@electrace/ui";

<VoltageDividerCalculator />
```
