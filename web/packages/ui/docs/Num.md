---
category: Form primitives
---
# Num
A controlled, labeled numeric input with an optional trailing unit, used across the Electrace calculator pages.

**When to use:** For any numeric field on a calculator form where you hold the value in state and want the design-system look (uppercase label, monospace field, focus ring).

**Props:**
- `label` — `string` — uppercase field label shown above the input.
- `value` — `number` — the current value (non-finite renders as empty).
- `onChange` — `(v: number) => void` — called with the parsed `parseFloat` value on edit.
- `unit` — `string?` — optional unit shown after the field (e.g. `"V"`, `"mm"`).
- `step` — `number?` — input step. Defaults to `0.1`.
- `min` — `number?` — minimum value. Defaults to `0`.

**Example:**
```tsx
import { Num } from "@electrace/ui";

<Num label="Supply Voltage" value={vin} onChange={setVin} unit="V" step={0.5} />
```
