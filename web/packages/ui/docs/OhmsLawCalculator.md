---
category: Calculators
---

# OhmsLawCalculator
Interactive Ohm's-law solver on Electrace's `/calculators/ohms-law` page: pick which of R, V, or I to solve for, then read back the third value plus power and Joule's-law energy over time.

**When to use:** Drop into the Ohm's-law calculator route when a user needs to find resistance, voltage, or current from the other two — and see power dissipation and energy-as-heat over a running time.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { OhmsLawCalculator } from "@electrace/ui";

<OhmsLawCalculator />
```
