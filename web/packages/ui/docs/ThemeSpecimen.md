---
category: Foundations
---
# ThemeSpecimen
A reference card rendering the same mini-card across all three Electrace themes — Mid (default), Dark and Light — to show how markup re-themes via the `data-theme` attribute.

**When to use:** When verifying a design works across themes, or to demonstrate that switching is purely a matter of `data-theme` on an ancestor (omit it for Mid).

**Props:** None — self-contained; renders fully populated from internal state. Drop it in.

**Example:**
```tsx
import { ThemeSpecimen } from "@electrace/ui";
<ThemeSpecimen />
```
