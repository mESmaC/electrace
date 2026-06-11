# Tech Stack

_Decided. The editor is a rich client app; the content layer must be SEO-indexable (the
growth flywheel in [business-strategy.md](business-strategy.md) depends on it). A unified
TypeScript/Next.js stack serves both._

## Decisions
- **Unified Next.js (App Router), TypeScript everywhere.** SSR/SSG content + API routes +
  hosts the React editor. One language, best-in-class SEO, simplest for a solo dev.
- **Build the demo ON this stack** — not a throwaway Vite prototype. No rewrite later.
- **Diverging from Laravel** for Electrace: Laravel is a great backend but PHP/Blade can't
  own the canvas editor, and a single TS stack is simpler than maintaining PHP + JS. (Laravel
  stays for the rest of US Nylon; Electrace is its own TS codebase.)

## Why NOT Godot / HTML5 WASM (recorded so we don't revisit)
- **SEO-fatal:** WASM renders to `<canvas>` — invisible to crawlers. Kills the content
  flywheel, which is the core growth bet.
- **Heavy first-load:** multi-MB engine boot fights the "click a Reddit link and try it"
  demo goal.
- **UI-panel-heavy app, not a game:** property editors, BOM tables, tooltips, text
  selection/copy-paste are effortless in the DOM and painful in a game engine.
- _(Acknowledged upsides that don't outweigh the above: Godot's `GraphEdit` is built for node
  editors, and we have prior Godot/GDScript experience.)_
- **WASM's one legit future role:** if the lint/solver core ever gets heavy, compile it
  (Rust→WASM) behind a JS API. Not needed for years — current lint is trivial arithmetic.

## Architecture

```
Next.js (App Router)
├── Public SSR/SSG pages        ← SEO + marketing (server-rendered DOM)
│   ├── /                       landing (pitch.md copy)
│   ├── /blocks/[slug]          block explanation pages = the SEO content
│   └── /docs, etc.
├── /editor                     ← the canvas app (client component, ssr:false)
│   └── React Flow + Zustand
└── /api/*                      ← route handlers (block lib now; auth/billing later)
```

### The key move: a block is one package = one source of truth
Each block is a small **package** (see [data-model.md](data-model.md)): a **`block.yaml`**
manifest (spec, terminals, schematic graph, limits) + an **`explain.md`** prose file,
schema-validated and compiled to JSON. Then:
- the **public `/blocks/[slug]` page** renders `explain.md` + the manifest → indexable SEO;
- the **editor's hover/drill panel** renders the same prose + schematic;
- the **lint engine** reads the same manifest (spec/limits/nets).

One authored package feeds product *and* marketing *and* checks — the corpus-is-distribution
flywheel realized in the file layout. Author once, used three ways.

## Component choices
- **Canvas/editor:** **React Flow** — draggable nodes with typed input/output handles
  (terminals) out of the box. Custom node component renders the block + its lint badge.
  - _Scale escape hatch:_ if it ever needs true CAD-scale rendering (thousands of elements),
    drop the drawing surface to **PixiJS or Konva (canvas/WebGL)** with React for chrome.
    Not needed for v1.
- **State:** **Zustand** (light, fits graph/editor state).
- **Styling:** **Tailwind** (fast, conventional, good for the panel-heavy UI).
- **Content:** **MDX** (`next-mdx-remote` or `@next/mdx`) for block pages + docs.
- **Hosting:** **Vercel** — Next-native, free tier, instant deploy → the shareable demo URL.
- **Lint engine:** pure TS functions over block frontmatter (`power = vout*iout`,
  `iin = power/(vin*eff)`, compare to connected terminal `iMax` / `limits`). Trivially
  unit-testable, no solver.

## Later (post-validation, not now)
- **Auth:** NextAuth / Auth.js.
- **Payments:** Merchant of Record (Paddle / Lemon Squeezy) per
  [business-setup.md](business-setup.md) — handles US sales tax.
- **DB:** only when blocks/users need persistence beyond files (Postgres via
  Vercel/Supabase). The demo and early corpus can be file-based MDX.
- **BOM affiliate:** distributor links wired into the BOM/add-to-cart path.

## Skills note
Cameron is polyglot with TS experience (team-lab, true-write, nocturio-app, etc.), so the
Next.js/React path is well within reach — no new-language tax.
