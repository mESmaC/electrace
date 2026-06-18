---
category: Templates
---
# EditorScreen
The signature Electrace editor — a full three-pane screen: a block-library palette (left), the canvas
(center, the net graph), and a persistent context panel (right: the selected block's explanation,
internal schematic, lint status, and BOM), with a top bar (logo, design name, Blocks/Schematic toggle,
design-wide lint summary) and Sparky floating.

**When to use:** As a starting point for the editor screen. It's assembled from the real components
(NetlistView, SchematicPreview, BomPanel, SevChip, AssistantBubble) — the live Editor is too stateful
to ship, so this template is how to build an editor-like screen from the parts.

**Props:** None (carries demo data).

**Example:**
```tsx
import { EditorScreen } from "@electrace/ui";
<EditorScreen />
```
