---
category: Pages
---
# BlocksBrowser
The block-library browser — a searchable, category-filtered grid of block cards (glyph, name, category, and the first few declared specs). Search also matches declared numbers (e.g. "18V → 5V at 3A").

**When to use:** As the `/blocks` catalog page. Renders the full grid from its `items` prop; spec-search only runs when a query is typed.

**Props:**
- `items` — `{ slug: string; explain?: string; block: Block }[]` — the blocks to show. `block` carries `name`, `category`, `glyph`, and a `spec` map (rendered as the card chips).

**Example:**
```tsx
import { BlocksBrowser } from "@electrace/ui";

<BlocksBrowser items={[
  { slug: "buck-converter", block: { name: "Buck Converter", category: "power", glyph: "⇄",
    spec: { vin: { min: 9, max: 18, unit: "V" }, vout: { value: 5, unit: "V" }, iout: { value: 3, unit: "A" } } } },
]} />
```
