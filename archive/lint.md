# The Lint Engine

_Pillar (b): deterministic checks on declared values — "linting, not simulation." Operates
on the data model in [data-model.md](data-model.md); its findings drive the editor's bubbles,
the header summary, the net list, and the right-panel reasoning ([design.md](design.md))._

## Principles
1. **Deterministic & pure.** `lint(design, blocks) → Finding[]`. No state, no randomness, no
   solving — same input, same output. Fast enough to run live on every edit.
2. **Declared values only.** It propagates the numbers authors/users *declared* (specs,
   terminals, limits). It never infers what's on a pin or computes node voltages.
3. **Source of truth for the numbers.** The AI is advisory on top ([ai.md](ai.md)); the lint
   is the authoritative numeric check.
4. **Honest about unknowns.** If a check needs a value that wasn't declared, it reports
   *"can't check — X not declared"* (severity `unknown`) — never a false pass or fail.
5. **Not a simulator — and says so.** No frequency response, transient, noise, or
   solving-for-unknowns. It's a fast sanity layer that catches the arithmetic mistakes. We
   state that limit plainly rather than over-promise.

## Pipeline
```
design + pinned blocks
   │  1. RESOLVE  ── attach each block's declared spec/terminals/limits;
   │                 stitch nets across boundaries (same net-merge as the flat schematic);
   │                 build the per-net model (below).
   ▼
ResolvedDesign
   │  2. RUN RULES ── each rule is a pure fn (ResolvedDesign) → Finding[]
   ▼
Finding[]   ── 3. dedupe/sort by severity → feed the UI + the run_lint() AI tool
```
Resolve is shared with the flat-schematic projection — net-stitching happens once.

## The resolved net model
After stitching, every net knows only what was declared:
```ts
type Net = {
  id: string;
  type: 'power' | 'rail' | 'gnd' | 'signal';
  voltage?: Range | number;          // from the declaring source(s); undefined if none declared
  sources: Pin[];                    // output terminals on this net
  sinks:   { pin: Pin; current?: Range }[];   // input terminals + their declared draw
  members: Pin[];
};
```
Where a declared **range** exists (e.g. Vin 9–18 V), rules check **worst case** (use 18 V
for an over-voltage check, max current for a budget check).

## Findings
```ts
type Finding = {
  rule: string;                       // "current/over-budget"
  severity: 'error' | 'warn' | 'info' | 'unknown' | 'recommendation';
  category: 'connectivity'|'voltage'|'current'|'power'|'limit'|'polarity'|'grounding'|'thermal'|'debug'|'declaration';
  at: Location[];                     // the blocks / nets / terminals it concerns
  message: string;                    // plain-language, conversational
  derivation?: string;                // the arithmetic, shown ("1.8 A × 5 V = 9 W …")
  fix?: { label: string };            // optional, advisory suggestion
};
```
- `message` is the conversational line ("Load draws 1.8 A — works, but little spare").
- `derivation` is the shown math → the right-panel "why it checks out" reasoning.
- `severity` maps to the UI: error→red, warn→amber, ok(no finding)→green, unknown→gray
  "not declared", recommendation→💡 — exactly the badge states in [design.md](design.md).

## Two kinds of finding
- **Faults** (`error`/`warn`) — something is *wrong* by the declared numbers. Pure
  arithmetic/threshold (over-current, over-voltage, reversed polarity…).
- **Recommendations** (`recommendation`, 💡) — the board would be *better* with a change.
  These are **curated, authored rules** that encode expert rules-of-thumb — **not the LLM
  free-associating.** They fire deterministically on declared patterns, carry their *why*
  (which doubles as learning content), and are **advisory, dismissible, never blocking.**
  It's a senior EE reading over your shoulder — consistent and trustworthy because the rules
  are authored. (The AI in [ai.md](ai.md) can elaborate or add softer ones on top.)

## Rule categories (with concrete examples)
| Rule | Sev | What it checks |
|---|---|---|
| `connectivity/open-net` | warn | An exposed terminal wired to nothing (the "open net" flag). |
| `connectivity/no-source` | error | A rail/signal net has consumers but nothing drives it. |
| `connectivity/no-sink` | info | A net is driven but nothing consumes it — forgotten output? |
| `connectivity/multi-driver` | error | Two outputs driving one net without explicit OR-ing. |
| `voltage/over-input` | error | A source net's declared V (worst case) exceeds a connected input's max. *(the 5 V → 3.3 V mismatch)* |
| `voltage/limit-crossed` | warn/error | A connected net's declared value crosses a block `limit` → surface the author's note. |
| `current/over-budget` | error | Σ declared sink current on a rail > the source's declared max. |
| `power/over-budget` | warn | Stage or whole-design power exceeds a declared budget. |
| `current/under-utilized` | 💡 rec | A source/part rated ≫ its actual load → suggest a smaller, cheaper part. |
| `thermal/low-efficiency` | warn / 💡 | Declared topology + V/I imply heavy dissipation (linear 18→5 V @ 3 A ≈ 39 W of heat) → suggest a switcher. |
| `polarity/reversed` | error | A polarized terminal/part wired against its declared polarity (power+ onto a ground net, electrolytic/diode backwards). |
| `grounding/sensitive-on-global` | 💡 rec | A net declared sensitive / analog-ground tied straight to the global GND → suggest a single-point (star) tie. |
| `component/inductor-shielding` | 💡 rec | A switcher feeding/adjacent to a sensitive block → suggest a shielded inductor. |
| `debug/test-points` | 💡 rec | Main power-entry rail + its ground → suggest test points (see below). |
| `declaration/missing` | unknown | A check couldn't run because a needed value isn't declared. |

Example rule:
```ts
const overCurrent: Rule = g => g.nets
  .filter(n => n.type === 'rail' || n.type === 'power')
  .flatMap(n => {
    const src = n.sources.find(s => s.iMax != null);
    if (!src) return [];                              // handled by declaration/missing
    const draw = sum(n.sinks.map(s => s.current?.max ?? 0));
    if (draw > src.iMax) return [{
      rule: 'current/over-budget', severity: 'error', category: 'current', at: [n],
      message: `${n.id} needs ${draw} A but its source provides ${src.iMax} A.`,
      derivation: `Σ sinks = ${draw} A  >  source ${src.iMax} A` }];
    if (draw > 0.85 * src.iMax) return [{
      rule: 'current/over-budget', severity: 'warn', category: 'current', at: [n],
      message: `${n.id} works, but only ${(src.iMax - draw).toFixed(1)} A spare.`,
      derivation: `${draw} A of ${src.iMax} A used` }];
    return [];
  });
```

## Recommendations in action
A recommendation reads like advice with a reason, e.g.:

> 💡 **This is your main power-entry rail.** Add a test point on both the power and ground —
> if the board ever doesn't power up, the fastest first thing to rule out is whether it's
> getting ample power.

Honest scoping: some recommendations (grounding strategy, shielding) are genuinely
*heuristic* and context-dependent. We present them as suggestions **with their reasoning**,
let you dismiss/acknowledge them, and let block authors + the community tune the rules — we
never dress a rule-of-thumb up as a law. Deeper layout-aware checks (plane stitching, real
star-grounds, thermal relief) belong to the **PCB view** later; these are the schematic-stage
versions.

## Declared attributes these rely on
Staying "declared, not inferred," the richer rules need a few more optional fields (added in
[data-model.md](data-model.md)):
- **net / terminal:** `groundClass` (gnd / agnd / pgnd / dgnd) or `sensitive: true`,
  `polarity` on power terminals, net `role` (e.g. `main-power-entry`, or derived from the
  power-entry block being the top source).
- **block:** `topology` (linear | switching), `noisy` / `switching`.
- **part:** `polarized`, `shielded` (inductors), and ratings (for over/under-utilization).
If a field isn't declared, the dependent rule simply doesn't fire (or reports
`declaration/missing`) — never a false recommendation.

## Units
A small unit-aware layer (V, A, W, Ω, F, H…). Declared values carry units (`{value, unit}`);
arithmetic is unit-checked so `5 V × 3 A = 15 W` and a `V` vs `A` comparison is itself a bug
the engine refuses rather than silently coerces.

## Configurable, like ESLint
Rules live in a registry with default severities; a project/global config can toggle rules or
change severity (some checks are opinionated). Sensible defaults out of the box; power users
can tune. New rules are pure functions added to the registry — easy to extend and unit-test.

## Where it runs
Isomorphic TypeScript: the **same engine** runs live in the editor (debounced on edit),
server-side for the public block pages / API, and behind the AI's `run_lint()` tool — so the
numbers are identical everywhere.

## Build phasing
- **T0 demo:** a hardcoded slice — the watts/amps + open-net checks on the one sample chain.
- **T1:** the real registry-driven engine over arbitrary designs.
- Later: more rules, config UI, per-rule docs (which themselves become SEO/learning content).
