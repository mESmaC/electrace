# Electrace design system — how to build with it

Electrace is an electronics design tool (block-based schematic/PCB editor with live electrical
checks). The visual language is **modern + warm, calm by default** (Linear/Figma calm, warmer
neutrals) — credible to pros, friendly to learners. Build with the real components below; for your
own layout glue, use the Tailwind token utilities listed here so everything re-themes correctly.

## Theming & setup (no provider needed)

Styling is pure CSS: `styles.css` ships the tokens, the three themes, and the brand fonts — there is
**no provider component to wrap**. Components are styled out of the box in the default **Mid** theme.
To switch themes, set `data-theme` on any ancestor:

```jsx
// Mid is the default (no attribute needed); set data-theme to switch to dark or light.
<div data-theme="mid" className="bg-bg text-text font-sans p-6">
  <OhmsLawCalculator />
</div>
```

- **Three themes**: `data-theme="mid"` (default, slate-dusk), `"dark"`, `"light"`. Tokens re-theme live.
- **Fonts ship with the bundle**: **Inter** (`font-sans`, all UI) and **JetBrains Mono** (`font-mono`).
  Use `font-mono` for every number, net name, spec, or measured value — it signals precision and is
  core to the brand.

## The styling idiom: Tailwind v4 semantic-token utilities

Style with **semantic** token utilities, never raw palette colors. They map to CSS variables and
re-theme automatically. Real names (read `styles.css` for the full set):

| Purpose | Utilities |
|---|---|
| Surfaces (page → panel depth) | `bg-bg` · `bg-bg2` · `bg-surface` · `bg-surface-2` · `bg-surface-3` |
| Text | `text-text` (primary) · `text-dim` (secondary) · `text-faint` (labels/captions) |
| Borders | `border-border` · `border-border-strong` |
| Brand accent (blue `#4c8dff`) | `text-accent` · `bg-accent` · `border-accent`; with opacity: `bg-accent/10`, `border-accent/40` |
| Status & links | `text-amber` (warn `#f7b13c`) · `text-green` (ok `#46dca6`) · link: `text-[var(--color-link)]` |
| Type | `font-sans` (Inter) · `font-mono` (JetBrains Mono — values/nets/specs) |

Common patterns: panels are `rounded-2xl border border-border bg-surface-2 p-4`; labels are
`text-[12px] font-semibold uppercase tracking-wide text-faint`; values are `font-mono`.

## Brand rules (don't violate these)

- **Status = color + icon + text, never color alone** (accessibility — ~8% red/green colorblind).
  Use **`SevChip`** for lint severities (error/warn/info/recommendation/unknown).
- **Net colors** (for schematic/wire UIs): power = amber, rail = green, gnd = gray, signal = blue —
  a family separate from status colors.
- **Schematic symbols**: use **`SchematicSymbol`** (one part) or **`SchematicSymbolGallery`** (the
  library), each supporting both **ANSI/IEEE** and **IEC 60617** standards via the `standard` prop.
- Tone is plain-language and conversational; prefer "Plenty of headroom — 15 W of 25 W" over "OK".

## Where the truth lives

- **`styles.css`** (and its imports) — the exact tokens, themes, and fonts. Read it before styling.
- **Per-component docs** (`<Name>.prompt.md`) and **`<Name>.d.ts`** — the API contract for each part.
- The calculators (e.g. `OhmsLawCalculator`, `FilterDesignerCalculator`) are self-contained, take no
  props, and render fully populated — drop them in directly.
