# Block Registry

_"npm for circuit blocks": the catalog + distribution for block packages. It's the moat, the
marketplace, the SEO source, and where curated lint rules live. Packages defined in
[data-model.md](data-model.md); ties to [business-strategy.md](business-strategy.md) (corpus
= moat/flywheel) and [lint.md](lint.md) (rule packs)._

## What lives here
- **Block packages** — versioned `block.yaml` + `explain.md` bundles.
- **Rule packs** — curated lint recommendation rule sets (e.g. `@electrace/best-practices`),
  versioned the same way; the lint engine loads them.
- Designs *reference* these (they don't live here — designs are the user's, in the app DB).

## Identity & namespacing (decide now)
Scoped, semver'd names — adopt from day one even before the service exists, so the seed
corpus is forward-compatible:
- `@electrace/buck-converter` — official.
- `@cameron/my-sensor-frontend` — community.
Scopes prevent collisions and *signal trust*.

## Trust tiers (trust is the product)
| Tier | Who | Signal |
|---|---|---|
| **Official** `@electrace/*` | authored & vetted by us (the seed corpus) | trusted badge |
| **Verified** | community, reviewed & promoted | verified badge |
| **Community** | anyone can publish | "unverified — use your judgment" |
The tier is a visible badge everywhere a block appears (palette, search, block page).

## Publishing & the quality gate
A block can't publish unless it passes an automated gate — this is curation at scale:
1. **Schema-valid** manifest.
2. **Self-consistent:** every net/pin resolves, terminals map to internal nets, no dangling
   internal nets — *the block passes its own lint.*
3. **Has prose** (`explain.md`) and a **declared license**.
4. A schematic **preview renders**.

- **Official** blocks: a git-backed repo, **PR-reviewed** (YAML diffs cleanly — the reason we
  chose it). Transparent and contributable.
- **Community** blocks: publish via CLI/web → auto-gated → live as *unverified* → optionally
  promoted to *verified* after review.

## Versioning: pinned, immutable, reproducible
Hardware can't tolerate silent change or a vanished dependency at fab time, so we lean hard
toward reproducibility:
- **Semver**, and **published versions are immutable** (like npm) — republishing means a new
  version.
- Designs **pin `block@version`** and carry a **lockfile** (the exact resolved tree).
- **Vendoring:** a design can snapshot/embed its blocks so it never rots if a block is
  unpublished or deprecated.
- **Updates are opt-in**, surfaced as "update available" with a **diff of what changed**
  (spec/parts) so you see the impact before accepting.

## Dependencies (composite blocks)
Blocks can be built from sub-blocks (a "Power Supply" block = a power-entry + a buck
sub-block) → a dependency tree, resolved transitively, pinned exact. Same model as the design
graph, one level down.

## Discovery
- **Public `/blocks` index** — the SEO hub; browse by category, tier, popularity.
- **Search by spec** — "18 V → 5 V at 3 A" returns matching blocks. This is the vendor-neutral
  answer to TI WEBENCH ([competition.md](competition.md)), and it powers the editor's
  **"autocomplete"** (suggest a block that fits a declared need).
- Tags, related blocks, "used in N public designs" (social proof from the public-free tier).

## Forking / remixing
GitHub-style: fork a block, customize, republish under your scope. Customizing a block inside
a design is a local fork/override (snapshotted into the design). This is how the corpus grows
*and* improves.

## Monetization & licensing
- Every block **declares a license** (CC-BY / MIT-like / proprietary-paid).
- Most blocks free → the SEO/community flywheel. **Premium/pro blocks** = the marketplace
  cut ([business-strategy.md](business-strategy.md), T2).
- Public designs reference public blocks → all of it feeds the flywheel.

## Safer than a software registry
Blocks are **declarative data validated by a schema — no code executes.** So there's no
supply-chain RCE risk the way npm/PyPI have; the only risks are *correctness* (handled by
tiers + self-lint + review), *IP*, and *spam* (handled by reporting + moderation). A real
operational advantage for running a public registry.

## Infra & phasing
- **T0 / T1 — no service.** The seed corpus (~20–50 authored blocks) ships as
  schema-validated **files in the app repo**; `/blocks/[slug]` pages are generated from them;
  the editor palette pulls from this set. Adopt `@electrace/` scopes + semver now.
- **T2 — the registry proper.** A service (metadata DB + object storage + CDN for compiled
  JSON & pages), community publishing, scopes, verified tiers, spec search, the marketplace,
  and a CLI. The official corpus likely stays a public git repo for transparency + PR
  contributions.
