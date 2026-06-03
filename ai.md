# AI Assistant — how the LLM sees the design

_How the AI reads and reasons over schematics/blocks. Builds on [data-model.md](data-model.md)
and the intent-aware assistant idea in [ideas.md](ideas.md) (#4)._

## The advantage (why our data is ideal LLM input)
We never ask a model to read pixels or infer a circuit from a datasheet — the thing Flux's
copilot and other tools are stuck doing. We hand it **clean authored structure**: the design
graph, declared specs, the `why` notes, the lint results, the BOM. Structure + authored
intent + deterministic checks = **grounded, trustworthy AI.** The same wedge that separates
Electrace from the guessing tools ([competition.md](competition.md)) applies to our own AI.

## What we feed it — a projection, not the raw repo
Assemble a compact, prompt-ready **design context** from the data model:
- **Design graph:** block instances + net-to-net connections + net types.
- **Per block:** declared spec, terminals, limits, and a one-line summary.
- **Lint results:** open nets, over-current / limit flags — the *deterministic facts*.
- **BOM:** resolved parts.
- Full `explain.md` prose **only for the block in focus** (lazy — keeps tokens down).

Two context modes: **overview** (summaries of all blocks + nets + lint) and **focused**
(full detail on the selection + its neighbors). YAML/JSON are token-cheap and semantic, so
the model reasons over named nets and declared values directly.

## Tool-use beats dumping
Rather than paste the whole project, give the model functions over the structured data:
`get_design()`, `get_block(id)`, `run_lint()`, `find_blocks(spec)`, `whats_on_net(net)`,
`bom()`. The model queries what it needs (MCP-style) — accurate, cheap, and it scales to
large designs that wouldn't fit in a prompt.

## Grounding principle (keeps the wedge intact)
- **Deterministic lint stays the source of truth** for the numeric checks. The LLM is
  **advisory** — it reasons, explains, suggests; it does not override the math.
- The LLM's **explanations are grounded in the authored `why` / `explain.md`** (RAG over the
  corpus), not invented — so even AI output traces back to authored content.
- **AI suggestions are clearly labeled** as suggestions, never blended with authored
  explanations or deterministic checks. Preserves "authored & deterministic, not guessing."

## What the assistant does
- **Explain** the design / a block / a part in plain language (grounded in authored notes).
- **Tradeoff suggestions:** overkill parts, IC→discrete swaps to save cost/area, cheaper or
  in-stock alternatives. (Pairs with the tradeoff readout + "expand to discrete".)
- **Catch design smells** the arithmetic lint can't — flagged as advisory, not as a hard
  check.
- **Answer questions:** "what if I change R1?", "why is this block here?", "what's on +5 V?",
  "find me a block that does 18 V → 3.3 V at 1 A."

## Write-back (later)
Because designs are JSON, the model can propose changes as a **reviewable structured diff**
(add/swap a block, change a value) *within the block vocabulary* — the user reviews and
applies. This is operating on a typed graph, not free-form generation (à la CELUS/JITX), so
the transparency promise holds: you see exactly what changed and why.

## Why this compounds
The data-model choices — declared structure, authored `why`, deterministic lint, versioned
blocks — pay off twice: they power the product **and** make Electrace the most
LLM-legible EDA tool around. Better data in → better, more trustworthy AI out, without
abandoning the determinism that makes the product credible.
