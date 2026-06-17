---
category: Form primitives
---
# Out
A result row pairing a label with a monospace value, used to display computed outputs on Electrace calculator pages.

**When to use:** To show a calculated result beneath a form. Use `strong` to highlight the headline answer and `warn` to flag an out-of-spec value.

**Props:**
- `label` — `string` — the result's name, shown on the left.
- `value` — `string` — the formatted value, shown right-aligned in monospace.
- `strong` — `boolean?` — emphasizes the row in the accent color (bold value).
- `warn` — `boolean?` — styles the row as a warning (amber). Takes visual precedence over `strong`.
- `note` — `string?` — small muted note appended after the label.

**Example:**
```tsx
import { Out } from "@electrace/ui";

<Out label="Trace width" value="0.42 mm" strong note="for 2A @ 10°C rise" />
```
