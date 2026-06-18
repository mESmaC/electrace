---
category: Layout
---
# AppShell
The Electrace page frame — ambient backdrop + sticky top nav (logo, section links, theme toggle, account) + your content + footer. Composed from the real components exactly as the app assembles them.

**When to use:** Wrap a page's body in it to get the full on-brand Electrace chrome. The nav account control shows Log in / Sign up when signed out (its real signed-in state is an avatar dropdown).

**Props:**
- `children` — `ReactNode` — the page content rendered between the nav and the footer.

**Example:**
```tsx
import { AppShell, OhmsLawCalculator } from "@electrace/ui";

<AppShell>
  <main className="mx-auto max-w-3xl px-6 py-10">
    <h1 className="text-[26px] font-extrabold tracking-tight">Ohm's law</h1>
    <OhmsLawCalculator />
  </main>
</AppShell>
```
