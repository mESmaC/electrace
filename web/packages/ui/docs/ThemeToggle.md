---
category: Brand
---
# ThemeToggle
A three-way Light / Mid / Dark theme selector. Sets `<html data-theme>` and persists the choice to localStorage; the layout's no-flash script applies the stored theme before first paint. Used in the app chrome.

**When to use:** When users need to switch themes. Mid is the default.

**Props:** None — self-contained; renders fully populated from internal state. Drop it in. (Client component — uses localStorage and the DOM.)

**Example:**
```tsx
import ThemeToggle from "@electrace/ui";
<ThemeToggle />
```
