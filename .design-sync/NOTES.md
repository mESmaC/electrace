# design-sync notes — Electrace

Electrace is a **live, deployed alpha** (paid ads + YouTube running; design verification gates beta).
Be conservative: never push to main, never touch the deployed app's runtime code. The DS surface is an
isolated package; the design-sync upload targets claude.ai/design only (not git).

## Source shape & where components come from
- Shape: **package**. The DS surface is `web/packages/@electrace/ui` (`@electrace/ui`), which
  **re-exports the product's real components from `web/app`** (no forks) plus two thin wrappers
  (`SchematicSymbol`, `SchematicSymbolGallery`) over the existing `web/app/editor/symbols.tsx` SYMBOLS.
- v1 scope (26 components): 16 calculators, `Logo`/`LogoMark`, `ThemeToggle`, `Num`/`Out`/`Preset`,
  `SevChip`, `NetlistView`, `SchematicSymbol`/`SchematicSymbolGallery`.

## Build sequence (cfg.buildCmd does all of this)
1. Build `@electrace/core` and mirror its `dist/` into `web/node_modules/@electrace/core/dist/`
   (the web copy is a real copy, not a symlink — the app's own `sync-core` does the same). Needed for
   the `.d.ts` graph (symbols.tsx → schematic-model.ts → @electrace/core types).
2. `cd web/packages/ui && npm run build` → `build:js` (tsup: dist/index.js + index.d.ts) then
   `build:css` (tailwind v4 CLI compiles styles/ds-entry.css → dist/electrace-ui.css, then
   scripts/append-vendor-css.mjs appends @xyflow/react base CSS).
- Requires `web/node_modules` (run `npm install` in web first on a fresh clone) and the ui package's
  own devDeps (`npm install` in web/packages/ui).

## Critical gotcha: React externalization (tsup)
- tsup uses `skipNodeModulesBundle: true` so the dist is ONLY local component code + clean ESM imports
  for react / react-dom / react/jsx-runtime / @xyflow/react / @dagrejs/dagre. The design-sync converter
  bundles the React ecosystem at ITS step and shims react/react-dom/react-is/jsx-runtime to window
  globals. **Do NOT pre-bundle the React ecosystem into dist** — any CJS dep that `require("react")`
  (e.g. use-sync-external-store via xyflow's zustand) becomes esbuild's throwing `__require("react")`
  stub baked into dist, which the converter can't intercept → "Dynamic require of react is not
  supported" on every preview. Keep them external.
- NetlistView's `import "@xyflow/react/dist/style.css"`: a tsup esbuild plugin drops `.css` imports
  from the JS; the xyflow base CSS is shipped via append-vendor-css.mjs into the stylesheet instead.

## Deploy safety
- `web/tsconfig.json` excludes `packages` so `next build` (no `ignoreBuildErrors`) doesn't type-check
  the DS package. Verified `npx tsc --noEmit` in web passes (exit 0) with the package present.

## Render check / playwright
- The render check needs chromium. The cache has playwright build **1208**
  (`%LOCALAPPDATA%\ms-playwright\chromium_headless_shell-1208\...\chrome-headless-shell.exe`), but the
  latest `playwright` pins 1228. Launch via `DS_CHROMIUM_PATH=<that exe>` to use the cached build.

## Fonts
- Inter + JetBrains Mono are self-hosted (variable woff2 from fontsource, committed under
  `styles/fonts/`) and wired via `cfg.extraFonts`. The app loads them via next/font; the design env has
  no next/font, so the bundle ships them. The committed woff2 make re-sync offline-safe.

## Build automation (anti-drift)
- **One-command build**: `node web/packages/ui/scripts/build-all.mjs` (also `npm run ds:build` in the
  package) builds @electrace/core + mirrors its dist + builds @electrace/ui. This IS `cfg.buildCmd`.
- **CI drift guard**: `.github/workflows/design-system.yml` rebuilds the DS on PRs touching the
  re-exported sources (web/app/Logo, ThemeToggle, calculators, docs/checks/ui, editor/symbols,
  editor/NetlistView), the package, electrace/, or .design-sync/. A breaking re-export change (renamed
  export, type drift) fails the PR instead of the next sync.
- **Deliberately NOT a web npm workspace**: making @electrace/ui a workspace of web/ would pull the DS
  build tools (tsup, tailwind CLI) into the app's production install and bloat every deploy. Standalone
  package + build script keeps the live deploy lean.

## Docs & grouping
- `cfg.docsDir = "docs"` → `web/packages/ui/docs/<Name>.md`, one per component. The `category:`
  frontmatter sets the design-pane group (Foundations / Brand / Calculators / Form primitives /
  Schematic & Symbols / Status). Edit these to regroup or improve a component's doc; they're committed.

## Foundations
- `ColorTokens`, `TypeScale`, `ThemeSpecimen` (web/packages/ui/src/foundations.tsx) are DS-meta
  reference cards (group Foundations) — they render the REAL tokens/fonts/themes, not invented UI.

## CSS scoping (evaluated, deliberately minimal)
- The shipped CSS keeps Tailwind preflight (components depend on normalized box-sizing/resets) and the
  `:root`/`[data-theme]` token palettes. The one global rule (`:where(body){background;color;font}`) is
  zero-specificity, so the design host overrides it. No scope-prefix applied — revisit only if real
  host collisions are observed in claude.ai/design.

## Overrides / known warns
- `cfg.overrides.SchematicSymbol = {cardMode: "column"}` — its AnsiVsIec cell is wider than a grid cell.
- Known render warns: none (all components render clean).

## Re-sync risks (what can silently go stale)
- **Re-export drift**: components are re-exported from the live `web/app`. If those app components'
  props/signatures change, the dist + `.d.ts` change and the affected previews should be re-verified.
- **@electrace/core must be built + mirrored before building the ui package**, else the `.d.ts` build
  fails (TS2307 + cascading implicit-any in schematic-model.ts).
- **Symbol library**: `SchematicSymbol*` wrap `SYMBOLS`/`SYMBOL_GROUPS` from `web/app/editor/symbols.tsx`.
  New symbol types appear automatically; a removed/renamed type changes the gallery — re-verify.
- Authored previews live in `.design-sync/previews/` (committed, hand-written). They import realistic
  fixtures (e.g. NetlistView's LDO netlist) — not tied to upstream data, but review if the component API moves.
