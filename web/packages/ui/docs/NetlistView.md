---
category: Schematic & Symbols
---
# NetlistView
A net-graph visualization that turns a normalized netlist (`parts[]` + `nets[]`) into an auto-laid-out diagram of parts, nets, and boundary terminals, using xyflow with a left-to-right dagre layout. Used in the Electrace editor.

**When to use:** To render a read-only graph of how parts connect through named nets. Net members are pin refs like `"U1.VIN"`, or `"@vin"` for a boundary terminal/port. The view is non-interactive (no drag/connect/select) and auto-fits.

**Props:**
- `parts` — `NLPart[]` — `{ ref; type; value?; part?; why? }`; each becomes a part node (`why` shows as a tooltip).
- `nets` — `NLNet[]` — `{ name; members: string[] }`; each net node links to every member's part or `@`-prefixed port.

Default export.

**Example:**
```tsx
import NetlistView from "@electrace/ui";

<NetlistView
  parts={[{ ref: "U1", type: "ic", part: "LM317" }, { ref: "R1", type: "res", value: "240Ω" }]}
  nets={[{ name: "VOUT", members: ["U1.OUT", "R1.1", "@vout"] }]}
/>
```
