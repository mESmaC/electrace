---
category: Calculators
---

# Timer555Calculator
Astable (free-running) 555-timer calculator on Electrace's `/calculators/555-timer` page.

**When to use:** When designing a 555 oscillator and you need frequency, duty cycle, and HIGH/LOW times from your Ra, Rb, and timing-cap values.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. Inputs are Ra (Ω), Rb (Ω), and timing capacitor C (nF); outputs frequency, duty cycle (HIGH share), HIGH/LOW time, and a parts summary, warning when duty climbs past 95%.

**Example:**
```tsx
import { Timer555Calculator } from "@electrace/ui";

<Timer555Calculator />
```
