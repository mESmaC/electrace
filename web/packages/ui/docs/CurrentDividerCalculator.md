---
category: Calculators
---

# CurrentDividerCalculator
Two-branch current-divider tool on Electrace's `/calculators/current-divider` page: from total input current and R1/R2 it gives the current through each branch, the parallel resistance, and the voltage across the pair.

**When to use:** Drop into the current-divider route when a user needs to know how an input current splits between two parallel resistors.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { CurrentDividerCalculator } from "@electrace/ui";

<CurrentDividerCalculator />
```
