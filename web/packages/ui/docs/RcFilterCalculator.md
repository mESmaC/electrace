---
category: Calculators
---

# RcFilterCalculator
RC filter cutoff tool on Electrace's `/calculators/rc-filter` page: computes the −3 dB cutoff from R and C, plus a reverse mode that picks R (and nearest E24) for a target cutoff once you choose C.

**When to use:** Drop into the RC-filter route when a user needs the cutoff frequency of an RC low/high-pass, or wants to size R for a target cutoff with a standard resistor.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { RcFilterCalculator } from "@electrace/ui";

<RcFilterCalculator />
```
