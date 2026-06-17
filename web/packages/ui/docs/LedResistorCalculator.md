---
category: Calculators
---

# LedResistorCalculator
LED series-resistor sizer on Electrace's `/calculators/led-resistor` page: from supply voltage, LED forward voltage, and target current it gives the exact resistance, the nearest E24 value (rounded up), actual current, and resistor dissipation.

**When to use:** Drop into the LED-resistor route when a user needs the current-limiting resistor for an LED, with forward-voltage presets for common LED colors.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { LedResistorCalculator } from "@electrace/ui";

<LedResistorCalculator />
```
