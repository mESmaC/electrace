---
category: Layout
---
# SiteBackdrop
A subtle, theme-aware page backdrop — a faint schematic dot-grid plus soft ambient color glows, so a page never reads as a flat empty canvas. Fixed, behind everything (`-z-10`), and pointer-events-none.

**When to use:** Behind page content for ambient depth (AppShell already includes it). The editor covers it with its own opaque canvas.

**Props:** None.

**Example:**
```tsx
import { SiteBackdrop } from "@electrace/ui";

<div className="relative">
  <SiteBackdrop />
  {/* page content on top */}
</div>
```
