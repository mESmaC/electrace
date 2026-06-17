---
category: Calculators
---

# ParallelResistorCalculator
Parallel/series resistor tool on Electrace's `/calculators/parallel-resistor` page: add any number of resistors to get the parallel and series totals, plus a reverse mode that finds what to parallel with a resistor you have (nearest E24) to hit a target combined value.

**When to use:** Drop into the parallel-resistor route when a user needs the combined value of resistors in parallel or series, or wants to trim a value they already have toward a target.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { ParallelResistorCalculator } from "@electrace/ui";

<ParallelResistorCalculator />
```
