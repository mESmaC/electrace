---
category: Calculators
---

# MotorWindingCalculator
BLDC motor winding calculator on Electrace's `/calculators/motor-winding` page.

**When to use:** When characterizing or rewinding a brushless motor — to relate Kv/Kt, predict a rewind's new Kv from turns and termination, and estimate cogging steps and phase resistance.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. Inputs cover Kv (rpm/V), supply voltage, current, old/new turns per tooth with a termination toggle (same / wye↔delta), stator slots, magnet poles, AWG, parallel strands, and wire length per phase; presets seed a drone 2207 and an e-skate 6374.

**Example:**
```tsx
import { MotorWindingCalculator } from "@electrace/ui";

<MotorWindingCalculator />
```
