# Electrace — screen composition templates

Recipes for assembling whole on-brand screens from `@electrace/ui`. Wrap pages in `AppShell` (it
brings the nav, ambient backdrop, and footer); style your own layout glue with the semantic token
utilities (`bg-surface`, `text-dim`, `border-border`, …). Mid is the default theme.

## Calculator / tool page
```tsx
import { AppShell, OhmsLawCalculator } from "@electrace/ui";

<AppShell>
  <main className="mx-auto max-w-3xl px-6 py-10">
    <h1 className="text-[26px] font-extrabold tracking-tight">Ohm's law</h1>
    <p className="mt-2 text-dim">Solve for resistance, voltage or current.</p>
    <div className="mt-6"><OhmsLawCalculator /></div>
  </main>
</AppShell>
```

## Block library page
```tsx
import { AppShell, BlocksBrowser } from "@electrace/ui";
<AppShell><main className="mx-auto max-w-5xl px-6 py-10"><BlocksBrowser items={items} /></main></AppShell>
```

## Dashboard / projects grid
A grid of project cards on the page surface — each `rounded-2xl border border-border bg-surface p-5`,
with the design name, a spec line in `font-mono text-dim`, and a `SevChip` for its lint status.
```tsx
import { AppShell, SevChip } from "@electrace/ui";
<AppShell>
  <main className="mx-auto max-w-5xl px-6 py-10">
    <h1 className="text-[26px] font-extrabold tracking-tight">Your designs</h1>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <a className="rounded-2xl border border-border bg-surface p-5 hover:border-accent">
        <div className="font-semibold">USB-C 5V supply</div>
        <div className="mt-1 font-mono text-xs text-dim">9–18 V → 5 V · 3 A</div>
        <div className="mt-3"><SevChip sev="warn" /></div>
      </a>
    </div>
  </main>
</AppShell>
```

## Editor screen (three panes)
The signature surface: a collapsible block-library palette, the canvas, and a persistent right
context panel. Use the real pieces in the panes.
```tsx
import { NetlistView, SchematicPreview, BomPanel, AssistantBubble } from "@electrace/ui";

<div className="relative grid h-screen grid-cols-[220px_1fr_340px]">
  <aside className="overflow-y-auto border-r border-border bg-surface p-3">{/* block palette */}</aside>
  <section className="relative bg-bg">{/* canvas */}<AssistantBubble /></section>
  <aside className="overflow-y-auto border-l border-border bg-surface p-4">
    {/* selected-block detail: explanation, spec, lint reasoning */}
    <SchematicPreview blockId="…" layout={layout} height="fit" />
    <BomPanel designName="…" rows={rows} pro={false} />
  </aside>
</div>
```

## Auth page
`AuthForm` is a full-bleed two-column screen on its own (form + brand showcase) — render it directly,
**not** inside `AppShell`:
```tsx
import { AuthForm } from "@electrace/ui";
<AuthForm mode="signup" />
```

## Rules of thumb
- Page background `bg-bg`; panels `bg-surface` / `bg-surface-2`; borders `border-border`.
- Every number/net/spec in `font-mono`. Status via `SevChip` (color + icon + text).
- Schematic visuals: `SchematicSymbol`/`SchematicSymbolGallery`, `SchematicPreview`, `NetlistView`.
