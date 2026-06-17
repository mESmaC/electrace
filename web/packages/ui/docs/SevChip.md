---
category: Status
---
# SevChip
A small pill badge for a lint check's severity — color, icon and text together. Used in the checks docs to label each rule's worst level.

**When to use:** When displaying a check/lint severity inline, e.g. next to a rule name or finding.

**Props:**
- `sev` — `CheckSeverity` (`"error" | "warn" | "info" | "recommendation" | "unknown"`) — selects the color, icon and label.

**Example:**
```tsx
import { SevChip } from "@electrace/ui";
<SevChip sev="warn" />
```
