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

## Bundling app-coupled components (Stage 2: SchematicPreview, BomPanel, AssistantBubble)
Pulling editor components in surfaced two `process is not defined` failures in the design IIFE
(the whole bundle throws at eval → every component shows root-empty). Both fixed at the DS-package
boundary (no app source changed):
- **`marked`** (AssistantBubble) references the Node `process` global at module-eval. Aliased to a
  browser-safe passthrough stub (`src/_stubs/marked.ts`) via tsup `alias` + `noExternal`. Trade-off:
  the bundled bubble renders live markdown messages as plain text (greeting/UI unaffected).
- **`process.env.*`** reads in local libs (e.g. `partLinks` → `NEXT_PUBLIC_AFFILIATE_LINK_TEMPLATE`).
  Polyfilled via esbuild `inject` of `src/_stubs/process-shim.ts` (empty env → reads are undefined).
  NB: esbuild `define: {"process.env":"({})"}` is REJECTED ("must be an entity name or JS literal") —
  use `inject`, not `define`.
- New editor components' Tailwind classes must be added to `styles/ds-entry.css` `@source` or they
  won't compile (Sparky's gradient, arbitrary sizes were missing until added). When verifying a class
  is in the compiled CSS, grep by VALUE (`8b6cff`), not the selector — Tailwind escapes `.`/`#`.
- Any further app-coupled adds (AuthForm, BlocksBrowser, NavAccount) will need `next/link` +
  `next/navigation` stubs (not yet added) — those are the deferred Stage 3 candidates.

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

## Dogfooding the design agent (validate the demand side)
The supply side (components/tokens/docs/conventions/guidelines) is strong. The real test is whether
the claude.ai/design *agent* builds well with it — which only a human can drive in claude.ai/design.
Proxy-dogfooded here by composing `AppShell` + a calculator into a full Electrace page from only the
published components (it worked → the surface composes into real screens).

**Test prompts to run in the Electrace project on claude.ai/design** (then check the result):
- "Build an Electrace calculator page for an LED resistor calculator." → expect AppShell frame +
  LedResistorCalculator + on-brand tokens/fonts.
- "Build the Electrace three-pane editor screen." → expect the screen-templates.md recipe (palette /
  canvas + Sparky / context panel with SchematicPreview + BomPanel).
- "Build a projects dashboard." → expect AppShell + a grid of surface cards with SevChip statuses.
Checklist: does it reach for our components (not generic ones)? Mid theme + Inter/JetBrains? status
as SevChip (color+icon+text)? values in font-mono? If it invents a component we don't ship or
mis-styles, feed that back into the conventions header / a new component / a guideline.

## Build footgun (important)
- **Never run `npm run build:js` (tsup) alone after the CSS exists** — tsup historically wiped all of
  `dist/` (clean) including `dist/electrace-ui.css`, leaving the converter nothing to append → every
  preview renders UNSTYLED (links resolve, but the stylesheet has no tokens/utilities, only the xyflow
  base). Mitigated by `clean: false` in tsup.config.ts (stable single entry overwrites in place), and
  always use `npm run build` / `build-all.mjs` (build:js → build:css in order). If previews ever render
  unstyled: check `ds-bundle/_ds_bundle.css` size — if it's ~17 KB (xyflow only), rebuild CSS.

## Stage 3 app-coupled components (AuthForm, BlocksBrowser)
- `next/link` → `_stubs/next-link.tsx` (plain `<a>`), `next/navigation` → `_stubs/next-navigation.ts`
  (no-op router/empty params), `@/lib/auth` → `_stubs/lib-auth.ts` (keeps Supabase out of the bundle).
  All aliased in tsup; only exercised on navigation/submit, which a static preview never does.
- AuthForm/BlocksBrowser/DiscreteModal use `cfg.overrides.*` with `cardMode:"single"` + a wide
  `viewport` (full-page / modal layouts need the room).

## Overrides / known warns
- `cfg.overrides.SchematicSymbol = {cardMode: "column"}` — its AnsiVsIec cell is wider than a grid cell.
- **Known render warns (benign):** `[RENDER_THIN] … rendered height is 0px` on the three
  `position:fixed` modals — **DiscreteModal, AcDialog, FootprintLibrary**. Fixed elements don't
  contribute to measured flow height; all render fully (confirmed by screenshots). FootprintLibrary's
  modal header can crop in the static capture (centered fixed modal) — renders fully in the pane.
  Not regressions.
- **@source must list every app component pulled into the bundle.** `styles/ds-entry.css` @source now
  covers calculators, Logo, ThemeToggle, docs/checks/ui, and editor/{NetlistView, symbols,
  SchematicPreview, BomPanel, AssistantBubble, AcDialog, FootprintLibrary} + AuthForm + blocks/BlocksBrowser.
  Omitting one means its unique Tailwind classes silently don't compile (renders via overlap only).
- **Stage 4 stub:** `@/lib/footprints` → `_stubs/lib-footprints.ts` (seeds a few land patterns so
  FootprintLibrary shows its populated grid; the real one is API/localStorage-backed).
- **AcDialog fixture is REAL, not a mock:** its preview builds an inline RC low-pass and runs it
  through `@electrace/core`'s actual `resolve()` + `frequencyResponse()` — the Bode curve is genuine.

## Re-sync risks (what can silently go stale)
- **Re-export drift**: components are re-exported from the live `web/app`. If those app components'
  props/signatures change, the dist + `.d.ts` change and the affected previews should be re-verified.
- **@electrace/core must be built + mirrored before building the ui package**, else the `.d.ts` build
  fails (TS2307 + cascading implicit-any in schematic-model.ts).
- **Symbol library**: `SchematicSymbol*` wrap `SYMBOLS`/`SYMBOL_GROUPS` from `web/app/editor/symbols.tsx`.
  New symbol types appear automatically; a removed/renamed type changes the gallery — re-verify.
- Authored previews live in `.design-sync/previews/` (committed, hand-written). They import realistic
  fixtures (e.g. NetlistView's LDO netlist) — not tied to upstream data, but review if the component API moves.
