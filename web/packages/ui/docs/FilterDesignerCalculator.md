---
category: Calculators
---

# FilterDesignerCalculator
Sallen-Key Butterworth filter designer on Electrace's `/calculators/filter-designer` page.

**When to use:** When designing a 2nd–8th-order active low- or high-pass filter and you want per-stage E-series component values for cascaded unity-gain Sallen-Key biquads.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. Inputs are filter order (2–8), cutoff frequency (kHz), and a per-stage base value (C2 in nF for LP, R1 in kΩ for HP), with a low-pass/high-pass toggle; outputs rolloff, stage count, and a stage-by-stage parts table with achieved fc/Q.

**Example:**
```tsx
import { FilterDesignerCalculator } from "@electrace/ui";

<FilterDesignerCalculator />
```
