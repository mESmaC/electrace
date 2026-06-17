---
category: Calculators
---

# OpAmpGainCalculator
Op-amp gain tool on Electrace's `/calculators/op-amp-gain` page: from the feedback (R1) and ground/input (R2) resistors it reports non-inverting gain, inverting gain, and gain in dB, plus a reverse mode that picks R1 (nearest E24, R2 fixed at 10 kΩ) for a target gain.

**When to use:** Drop into the op-amp-gain route when a user needs the gain of an inverting or non-inverting amplifier, or wants resistor values for a target gain.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { OpAmpGainCalculator } from "@electrace/ui";

<OpAmpGainCalculator />
```
