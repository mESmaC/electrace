---
category: Calculators
---

# NtcThermistorCalculator
NTC thermistor divider calculator on Electrace's `/calculators/ntc-thermistor` page.

**When to use:** When sizing an NTC-on-top voltage divider for temperature sensing and you want the resistance, Vout/Vcc ratio, and ADC counts across −20 to 100 °C.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. Inputs are the NTC resistance at 25 °C (Ω), Beta (B25/85), the fixed divider resistor (Ω), and ADC bits; it renders a per-10 °C table (highlighting 20 °C) using the B-equation, warning if any input is not positive.

**Example:**
```tsx
import { NtcThermistorCalculator } from "@electrace/ui";

<NtcThermistorCalculator />
```
