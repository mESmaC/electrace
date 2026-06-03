# User Data & Storage

_How user content persists: the entities, where they live, and the access patterns. Builds on
[stack.md](stack.md) (Next.js/Vercel, Auth.js, Postgres) and the circuit shapes in
[data-model.md](data-model.md). The circuit/lint model is unchanged; this is the layer around it._

## Principles

1. **Postgres + JSONB is the home.** Designs and block manifests are small (<~100 KB), highly
   structured documents that we read whole and occasionally query by a few fields. JSONB columns
   (graph, manifest) with relational metadata (owner, visibility, version) around them fit
   perfectly — no object storage, no separate document DB.
2. **Local-first, server-authoritative.** Keep the current localStorage autosave as an offline/
   resilience cache; the server is the source of truth, reconciled by `updatedAt`.
3. **Blocks are immutable, versioned packages; designs pin a version.** Editing a block you don't
   own = fork. This is the shared-library model the strategy depends on.
4. **Visibility is first-class.** `public` (free, indexed, forkable) vs `private` (paid). Enforced
   at the data layer, not just the UI.
5. **Everything is also a training signal.** The same structured rows + the event stream are the
   intent+correctness corpus ([data-intellisense-strategy] memory) — designed to be exportable.

## Entities (Postgres)

```
users
  id            uuid pk
  email         text unique
  handle        text unique        -- public attribution / URLs (/u/handle)
  name, image   text
  plan          'free' | 'pro'
  settings      jsonb              -- { symbolStyle, telemetryConsent, ... }
  created_at, updated_at

designs                            -- a user's project
  id            uuid pk
  owner_id      uuid → users
  slug          text               -- public URL (/d/slug)
  name          text
  visibility    'private'|'unlisted'|'public'
  graph         jsonb              -- { blocks: BlockInstance[], connections: Connection[] }
  forked_from   uuid? → designs
  created_at, updated_at
  idx: (owner_id), (visibility), (slug)

blocks                             -- a versioned block definition (the library entry)
  id            uuid pk
  owner_id      uuid → users       -- '@electrace' system user owns the seed library
  key           text unique        -- "@handle/buck-converter"
  name, category text
  latest_version text               -- semver pointer
  visibility    'private'|'public'
  forked_from   uuid? → blocks
  stars         int                -- denormalized count
  created_at, updated_at

block_versions                     -- immutable
  id            uuid pk
  block_id      uuid → blocks
  version       text               -- semver
  manifest      jsonb              -- { terminals, spec, limits, layout }  (the authored block)
  explain       text               -- markdown
  published_at  timestamptz?       -- null = draft
  unique: (block_id, version)

events                             -- telemetry / corpus (consented), append-only
  id            bigserial pk
  user_id       uuid?              -- null when anonymous
  session       text
  ts            timestamptz
  ev            jsonb              -- CapturedEvent.ev (see electrace/src/events.ts)
  ctx           jsonb?             -- { designId?, blockId? }
  idx: (ts), (user_id)

stars            (user_id, target_type 'design'|'block', target_id)   -- social, public library
design_revisions (id, design_id, graph jsonb, created_at, label?)     -- optional history (P2+)
```

`graph` and `manifest` are exactly the core `Design`/`Block` shapes minus the identity fields
(which become columns) — so serialization is `JSON.stringify` of what the editor already holds.

## Where each thing lives

| data | store | why |
|---|---|---|
| users, designs, blocks, versions, stars | **Postgres** | relational + JSONB, queryable by owner/visibility |
| design graph, block manifest | **JSONB columns** | whole-document read/write; no joins to reconstruct |
| explain.md prose | **text column** | small; also the SEO page body |
| seed/curated blocks (today's `electrace/blocks/*`) | **files now → DB at P2** | file-based powers the demo + SSG; later seeded into `blocks`/`block_versions` owned by `@electrace` |
| telemetry events | **`events` table** | append-only; partition by month / pipe to a warehouse later |
| KiCad export, design report | **generated on demand** | derived from the manifest; never stored |
| unsynced edits | **client localStorage** | offline cache, reconciled on load |

No blob/object storage needed at v1 — there are no binaries, just JSON and markdown.

## Access patterns — how & when

- **Open editor** → `GET /api/designs/:id` (owner or public). Returns the design graph **plus the
  resolved `manifest` of every block version it references**, so the client has everything
  `analyze()` needs in one round-trip. Cache block versions aggressively (immutable).
- **Autosave** → debounced `PATCH /api/designs/:id { graph }` (owner only). Optimistic: write
  localStorage immediately, POST in the background; on conflict, newer `updated_at` wins.
- **New / fork** → `POST /api/designs` (clones a graph; sets `forked_from`).
- **Public view** → by slug, **SSG/ISR**, read-only, no auth (this is the SEO surface).
- **Browse library** → `GET /api/blocks?visibility=public&category=…` paginated; `/blocks/[slug]`
  pages SSG/ISR from the manifest + explain.
- **Author/edit a block** → editing a block you own writes a **draft `block_version`**; publish
  bumps semver + sets `published_at`. Editing one you don't own **forks** it under your handle.
- **Telemetry** → batched `POST /api/events` (only when `settings.telemetryConsent`), append.
- **Analyze / lint / report** → stay **client-side** (already do), over the loaded manifests.
- **Agent (MCP)** → the same API surface backs the MCP tools, so an agent reads/authors through
  the identical, validated path (`validate_block` before any `author_block` write).

## Auth, ownership, visibility

- **Auth.js** (per stack.md) issues the session; `owner_id` gates every mutating route.
- Reads: a row is visible if `visibility = public` OR `owner_id = session.user`.
- If we host on **Supabase**, enforce the same with **Row-Level Security** as defense-in-depth.
- `private` designs/blocks require `plan = 'pro'` to create beyond a free quota (the paywall).

## Migration from today's localStorage

Current keys (`electrace:design:<id>`, `electrace:blocksch:<blockId>`, `electrace:events`,
`electrace:symstyle`/`electrace:telemetry`) already hold the core shapes. On first sign-in, detect
local work and offer **"import to your account"** → create `designs` (+ any edited blocks as draft
`block_versions`). `symstyle`/consent move into `users.settings`.

## Phasing

- **P1 — accounts + designs.** Auth.js, `users`, `designs`. Private designs saved to the account;
  public sharing by slug (the demo URL becomes a real saved project). Blocks stay file-based.
- **P2 — block library in DB.** `blocks`/`block_versions`, authoring/publish/fork, seed the
  curated library into `@electrace`. `/blocks/[slug]` served from DB via ISR.
- **P3 — scale + social + billing.** `events` ingestion, `stars`/forks, MoR billing gating
  `private`/`pro`, optional `design_revisions` history.

## Decided

- **Host: Supabase** — managed Postgres + Auth + Row-Level Security in one. Supabase Auth issues
  the session; RLS policies enforce visibility (`public OR owner = auth.uid()`) at the row level
  as the backstop, with API routes doing the same check. (This supersedes the tentative Auth.js
  note in stack.md — Supabase Auth is the path.)
- **ORM: Drizzle** — TS-first schema in `web/db/schema.ts`, explicit SQL migrations, serverless-
  friendly. The Supabase Postgres connection string drives it; RLS still lives in SQL policies.
- **Design history:** deferred to P3 — autosave + in-session client undo cover v1.

## First implementation step (P1)

1. Provision a Supabase project; put `DATABASE_URL` + Supabase keys in env (the human step).
2. Drizzle schema for `users` / `designs` (+ enums), migration, and RLS policies.
3. Auth.js-style sign-in via Supabase Auth; `owner_id` from the session.
4. `/api/designs` route handlers (CRUD + fork) and swap the editor's localStorage persistence to
   server-backed (keeping local as the offline cache).
5. localStorage → account **import** on first sign-in.
Blocks stay file-based through P1; `blocks`/`block_versions` land in P2.
