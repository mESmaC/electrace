---
category: Editor
---
# AssistantBubble
Sparky — the floating design assistant. Collapsed it's a sparkle bubble; open it slides a chat pane in over the canvas (conversations switchable like any chat app, markdown replies, typed-out animation).

**When to use:** Drop it into an editor/canvas surface to give users the in-context assistant. It positions itself absolutely against the nearest positioned ancestor — wrap it in a `relative` container.

**Props:** None — self-contained. It reads its own chat store and checks access via `/api/me` (fails open). External code can open it and pre-fill a prompt by dispatching `window` event `electrace:sparky-ask` with `detail: { text }`.

**Example:**
```tsx
import { AssistantBubble } from "@electrace/ui";

<div style={{ position: "relative", height: 560 }}>
  {/* your canvas */}
  <AssistantBubble />
</div>
```
