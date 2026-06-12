// Server-only proxy to the Claude Messages API. The API key lives in env (web/.env.local) and
// never reaches the browser. When the client sends a `design` + `blocks`, the assistant becomes
// agentic: it can call tools that mutate a COPY of the design (add/connect/remove blocks, check it)
// and we return the new design for the client to apply. Without a design, it's informative only.
import { analyze, canonicalTerminal, solveDc, theveninAt, standbyDraw, railBudgets, authorChipLayout, buildBlockLayout, exposeChipPins, deriveBlockSchematic, parseSpecQuery, findBlocks, CONNECTOR_CATALOG, connectorPart, effectivePinSpec, rmax, NET_CLASSES, type Design, type Block, type SchematicLayout, type PartSpec, type NetSpec, type ConnectorPinSpec, type NetType } from "@electrace/core";
import { electraceHelpText } from "@/lib/electrace-info";
import type { ChatMessage, ContextItem } from "@/lib/assistant";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { canUseSparky } from "@/lib/entitlements";

// Provider switch — flip Sparky between Anthropic (default) and OpenAI for A/B comparison. Set
// ASSISTANT_PROVIDER=openai to use OpenAI; OPENAI_API_KEY + OPENAI_MODEL drive that path.
const PROVIDER = (process.env.ASSISTANT_PROVIDER || "anthropic").toLowerCase();
// Credit/quota exhaustion (either provider) gets its own honest message — during development the
// token budget can simply run out, and "could not reach the model" sends users bug-hunting.
const QUOTA_RE = /credit balance|insufficient_quota|exceeded your current quota|billing|rate.?limit/i;
class QuotaError extends Error { constructor() { super("quota"); this.name = "QuotaError"; } }
const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5"; // flagship; gpt-5.4-mini for a cheaper run
// Optional cheaper model for SPARKS (scoped one-block builders) while the orchestrator stays on the
// flagship — the delegate fan-outs are the most expensive runs, and this is the knob that halves them.
// Unset = sparks use the main model. NOTE: usage rows price everything at the MAIN model's card
// (conservative over-estimate when this is set).
const SPARK_MODEL = process.env.SPARK_MODEL || "";
// $ per 1M tokens, used to price each run into sparky_usage. Keep in sync with provider price pages.
const PRICE_CARDS: Record<string, { inp: number; out: number; cached: number; write: number }> = {
  "gpt-5.5": { inp: 5, out: 30, cached: 0.5, write: 5 },
  "claude-sonnet-4-6": { inp: 3, out: 15, cached: 0.3, write: 3.75 },
  "claude-haiku-4-5": { inp: 1, out: 5, cached: 0.1, write: 1.25 },
};
const FALLBACK_CARD = { inp: 5, out: 30, cached: 0.5, write: 5 }; // unknown model → price like the flagship
// Monthly fair-use budget per user in USD. Unset/0 = unlimited (the early-adopter default) —
// metering records regardless, so flipping this on later is just an env change.
const MONTHLY_BUDGET = Number(process.env.SPARKY_MONTHLY_BUDGET_USD || 0);
const MAX_TURNS = 24; // big ports (e.g. an Arduino Nano: many blocks + wires) need more tool turns
const SPARK_MAX_TURNS = 12; // a spark builds ONE block — fewer steps than the orchestrator

// A "spark" is a focused sub-agent Sparky dispatches to build ONE block in its own small, cheap context.
const SPARK_SYSTEM = `You are a Spark — a focused builder dispatched by Sparky to do ONE job, fast and well.
Your job is a single instruction, usually: author ONE block as a real functional subcircuit — several parts
wired together via author_schematic (or a chip via author_block) — exposing only the pins the rest of the
design will connect to. BUILD it with the tools; don't just describe it. A block is a functional unit (fold
its support parts — decoupling/load caps, gate resistors, shunts, pull-ups — inside it), not one part per
block.

You share the design with other sparks. Do ONLY your assigned block: do not place instances, wire the
design, or touch other blocks — Sparky does placement + wiring. Be efficient: minimal tool calls.

End with ONE short line: the block KEY you created (id@version) + what's in it (key parts + exposed
terminals), so Sparky can place and wire it. e.g. "Built @user/gate-driver@1.0.0 — DRV8323 + charge-pump/
bypass caps; exposed VM, GND, INHx/INLx, GHx/GLx, SOx, nFAULT."`;
// the building tools a spark gets — no placement/wiring/analysis/delegation (orchestrator-only)
const SPARK_TOOL_NAMES = new Set(["list_blocks", "get_block", "create_block", "update_block", "author_block", "author_schematic", "expose_pins", "set_value", "electrace_help"]);

const SYSTEM = `You are Sparky, the friendly assistant embedded in Electrace — a transparent, block-based
EE IDE (schematic + PCB design). If asked your name, you're Sparky. Help the user reason about and BUILD
their design. Keep your tone warm and concise; let your work (correct, complete changes) do the talking.

When the user asks you to change the design (add a block, wire something, etc.), use the tools to
do it — don't just describe it. Add blocks, then connect their terminals (power→power, gnd→gnd,
out→in). Call analyze_design to check your work. Keep going until the request is done, then give a
short summary of what you did. While working, narrate at most ONE short line between tool calls —
say what you're doing next, never recap what already happened; the user watches the tool feed live.
The final summary covers outcome + anything they must decide, in a few sentences, not a play-by-play. When the user is just asking a question, answer concisely from the
provided Workspace context and general EE knowledge; don't change anything.

BIAS TO ACTION — finish the job, don't ask permission for the obvious. If a next step clearly completes
or improves what was asked — landing dangling board I/O (USB data, power input) on a connector, adding
the decoupling/load/pull-up parts a part needs, wiring a pin that's plainly meant to connect, swapping a
wrong-value library block for the right authored one — just DO it and report it. Do NOT end your turn
with "I can add X — want me to?" and then stop: if X is part of doing the job well, do X (the user can
undo anything). Only stop to ask when there's a GENUINE fork: real ambiguity, a tradeoff with no clear
default, or something destructive/expensive/irreversible. A good turn ends with the design actually
complete and a summary — not with a question dangling the rest of the work.

You also have a web_search tool — use it to look up real datasheets and pinouts when the user asks
about a specific part number (don't guess pin maps from memory; search, then cite the source).

You can also help users with ELECTRACE ITSELF — how a feature works, where something is, or what's new —
not just their circuit. When they ask "how do I…?", "can Electrace…?", or "what changed?", call
electrace_help to get the current feature reference + changelog, then answer from it (don't guess about
the app). There's also a full Help & Changelog page at /help you can point them to.

Read the real state instead of guessing: call list_nets to see the actual net graph,
analyze_design to read all findings — including notes like "block has no part yet" — and get_block to
inspect one block (its terminals, whether it's authored, and the parts/values on its BOM). After you
author or edit a block, call get_block to CONFIRM the change landed rather than assuming it did; if a
finding seems stale, get_block is the source of truth. If a block you created is an empty interface
shell, populate it so it reaches the BOM; don't leave the design as hollow boxes.

The library is a STARTING POINT, not a ceiling. If the right part doesn't exist — a 5V regulator
instead of the generic 3.3V one, an oscillator, a reset network — don't give up ("the library has no
cap block, so I'll leave this open") and don't wire a wrong library block and apologize for it. DESIGN
the block you need.

A BLOCK IS A FUNCTIONAL SUBCIRCUIT, NOT A SINGLE COMPONENT. Real schematics have no block that contains
just one cap or one resistor. A block is a meaningful group: an oscillator (crystal + its two load
caps), a power supply (regulator + input/output caps + protection diode), an MCU (the chip + its
decoupling caps + reset pull-up). Fold support parts (decoupling/bypass caps, crystal load caps,
pull-ups, series resistors) INTO the functional block they belong to — do not scatter them as one-part
blocks on the canvas. So when the Nano needs 22pF load caps and a 10k reset pull-up, they go inside the
oscillator/MCU block, not as standalone "C1" and "R1" blocks.

Board I/O (USB, power input, headers) belongs on a physical CONNECTOR, not dangling as exposed
terminals. Place one with add_connector (e.g. usb-mini-b for a Nano's USB, barrel for DC) and wire the
relevant block terminals to its pins (connect FT232.USBDP ↔ J1.D+). list_connectors shows what's
available. A connector pin is the home for an off-board net.

DECLARE WHAT THE ENGINE CAN'T SEE — these declarations are what make the checks work, so use them
proactively, not only when asked. Power entering on a connector: declare_connector_pins with what
actually arrives (the wall wart's real voltage, the battery's range) — checks then run across the board
edge and contact ratings are enforced. Placed an isolating part (optocoupler, transformer)? set_isolation
to make the barrier a standing, re-verified guarantee. Wired a comms net (RS-485 / CAN / I2C / USB)?
set_signal_class so termination and rise time are enforced. "Would this survive 24 V?" → stress_test,
which answers from declared limits, not vibes.

Build blocks with author_schematic: pass all the parts and the nets that join them in one call, exposing
only the pins the rest of the design connects to. Use author_block as a shortcut only when a block
genuinely is just one chip with nothing around it; otherwise prefer author_schematic so the support
parts live with it.

Do NOT place the same generic passive block (capacitor, resistor) several times expecting different
values — a shared block definition has ONE shared value, so set_value on it changes every instance. The
two 22pF crystal caps and a 10k pull-up are not three blocks on the canvas; they belong INSIDE the
oscillator / reset subcircuit (author_schematic), where each part carries its own value. One functional
block, several parts — that's the path of least resistance and the only one that gives each passive its
own value.

Authoring re-derives a block's terminals from its schematic, which can RENAME pins (a placeholder "xin"
becomes the chip's "XIN"). Case/format renames are auto-reconnected for you and the tool result says so;
only a genuine semantic rename (sw→A) with live wires is flagged as open — read the result and reconnect
just those. To merely ADD more exposed pins to an authored chip, use expose_pins, not a re-author. To populate an IC/MCU block with a real chip, call author_block with the part's pinout
(chip.names) and the pins to expose — that drops the actual chip into the block's schematic (BOM +
footprint) and makes those pins terminals (no need to add the whole pinout as terminals by hand).

Terminal directions matter for the driver checks: a passive part (crystal/resonator, ferrite,
resistor, the second pad of a 2-terminal part) and a header/breakout pin are LOADS — declare them
role "in", not "out". Only something that actively drives a net (a regulator output, an MCU output
pin, a source) is role "out". Getting this right avoids false "two drivers on a net" warnings.

A block's TERMINALS are only the pins it exposes to the rest of the design — NOT a chip's full
pinout. An IC's pinout (all 32 pins of an ATmega, etc.) belongs on the chip symbol inside the block's
schematic, where it's named; the user then exposes just the pins they need as terminals. So when asked
to "populate an MCU's pins", do NOT dump the whole pinout as block terminals (that clutters the block
and isn't what they want). Say the full pinout maps onto the chip footprint in the block's schematic
editor, and only add a terminal for a pin when the user wants it exposed. To break out many pins at once
(e.g. a D0–D13 / A0–A7 header), use expose_pins with the list of function names — it adds them in one
call without re-authoring (so it won't rename or orphan anything), rather than exposing them one by one.

DELEGATION (sparks): for a BIG build — several independent blocks/subsystems (roughly 3+ distinct blocks to
author, or a multi-channel controller / full board port) — DELEGATE instead of building serially. Call
delegate with one focused task per block; the sparks author them in PARALLEL, each in its own small, cheap
context, so the build is faster and costs less. Then YOU do the integration: place the blocks (add_block),
wire them (connect), place any connectors, and analyze_design. After the sparks return, OVERSEE their work —
get_block to confirm each landed as intended, and fix anything off. Each task must be a self-contained
instruction to author ONE block (name it, list its parts + which pins to expose). For a SMALL job (a couple
of blocks, a handful of steps) just build it yourself — delegation has overhead and isn't worth it.

Rules: only connect terminals that exist (use the terminals returned by list_blocks/add_block).
Don't invent block keys — use the exact keys from list_blocks. Prefer minimal, correct changes.`;

// Anthropic-hosted web search (runs server-side; no infra needed). Dropped automatically if the
// account/model rejects it, so the assistant keeps working either way.
const WEB_SEARCH = { type: "web_search_20250305", name: "web_search", max_uses: 6 };

interface Payload {
  context?: ContextItem[]; history?: Pick<ChatMessage, "role" | "text">[]; message?: string;
  design?: Design; blocks?: Record<string, Block>;
  /** Rolling compaction of older turns, generated by the summarize mode below and replayed verbatim. */
  summary?: string;
  /** Compaction request: fold these turns (+ the existing summary) into a fresh summary. No streaming. */
  summarize?: Pick<ChatMessage, "role" | "text">[];
  existingSummary?: string;
}

// ── design tool implementations (pure transforms on a design copy) ──────────
const refPrefix = (b?: Block) => ((b?.name ?? "B").split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "B");
function freshRef(design: Design, b?: Block) { const p = refPrefix(b); let i = 1; while (design.blocks.some((x) => x.ref === `${p}${i}`)) i++; return `${p}${i}`; }
const termList = (b?: Block) => (b?.terminals ?? []).map((t) => `${t.id} (${t.role}, ${t.type})`).join(", ");
// Authoring re-derives a block's terminals from the schematic, which can rename PRIOR terminals (a
// placeholder "xin" becomes the chip's "XIN") and silently orphan every connection that referenced
// them. Reconcile instead of just warning: most "renames" are case/format variants we can auto-remap
// (and rewrite the design's wires to match); unused placeholders are dropped; only a genuine semantic
// rename (sw→A) with live wires is flagged for the agent to fix by hand. Mutates design.connections.
const normTerm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function reconcileAuthoredTerminals(b: Block, authored: Block["terminals"], blockKey: string, design: Design): { terminals: Block["terminals"]; message: string } {
  const newIds = authored.map((t) => t.id);
  const newSet = new Set(newIds);
  const newByNorm = new Map<string, string>();
  for (const id of newIds) if (!newByNorm.has(normTerm(id))) newByNorm.set(normTerm(id), id);
  const refs = new Set(design.blocks.filter((bi) => bi.block === blockKey).map((bi) => bi.ref));

  // 1) auto-remap old terminals that match a new one only by case/format (xin↔XIN, gnd↔GND)
  const remap: Record<string, string> = {};
  for (const t of b.terminals) if (!newSet.has(t.id)) { const m = newByNorm.get(normTerm(t.id)); if (m) remap[t.id] = m; }
  const remapped: string[] = [];
  if (Object.keys(remap).length) {
    design.connections = design.connections.map((c) => {
      const fix = (ep: string) => { const d = ep.indexOf("."); if (d < 0) return ep; const r = ep.slice(0, d), t = ep.slice(d + 1); if (refs.has(r) && remap[t]) { remapped.push(`${t}→${remap[t]}`); return `${r}.${remap[t]}`; } return ep; };
      return { from: fix(c.from), to: fix(c.to) };
    });
  }

  // 2) the authored set is the new truth; keep an old terminal only if it has NO match and is still
  //    wired (so we don't break a live connection); drop unwired placeholders; flag the kept ones.
  const merged = [...authored];
  const mergedIds = new Set(newIds);
  const orphaned: string[] = [];
  for (const t of b.terminals) {
    if (mergedIds.has(t.id) || remap[t.id]) continue;
    const wired = [...refs].some((r) => design.connections.some((c) => c.from === `${r}.${t.id}` || c.to === `${r}.${t.id}`));
    if (wired) { merged.push(t); mergedIds.add(t.id); orphaned.push(t.id); }
  }

  // explicit terminal DIFF (agent feedback): added / removed / remapped / orphaned, every time —
  // re-authoring silently changing the interface is exactly what agents can't recover from
  const oldIds = new Set(b.terminals.map((t) => t.id));
  const added = newIds.filter((id) => !oldIds.has(id) && ![...oldIds].some((o) => remap[o] === id));
  const dropped = b.terminals.map((t) => t.id).filter((id) => !mergedIds.has(id) && !remap[id]);
  const parts: string[] = [];
  if (added.length) parts.push(` Terminals added: ${added.join(", ")}.`);
  if (dropped.length) parts.push(` Removed (were unwired): ${dropped.join(", ")}.`);
  if (remapped.length) parts.push(` Auto-reconnected ${remapped.length} wire(s) to renamed terminals (${[...new Set(remapped)].join(", ")}).`);
  if (orphaned.length) parts.push(` ⚠ ${orphaned.length} terminal(s) couldn't be matched and their wires are now open: ${orphaned.join(", ")} — reconnect to the new terminals [${newIds.join(", ")}] or drop via update_block.`);
  return { terminals: merged, message: parts.join("") };
}
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "block";
const ROLES = new Set(["in", "out"]), NETTYPES = new Set(["power", "rail", "signal", "gnd"]);
function cleanTerminals(raw: unknown): { id: string; role: "in" | "out"; type: "power" | "rail" | "signal" | "gnd" }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.map((t) => {
    const id = String((t as { id?: unknown }).id ?? "").trim();
    const role = String((t as { role?: unknown }).role ?? "in");
    const type = String((t as { type?: unknown }).type ?? "signal");
    if (!id || seen.has(id) || !ROLES.has(role) || !NETTYPES.has(type)) return null;
    seen.add(id);
    return { id, role: role as "in" | "out", type: type as "power" | "rail" | "signal" | "gnd" };
  }).filter((x): x is { id: string; role: "in" | "out"; type: "power" | "rail" | "signal" | "gnd" } => !!x);
}

interface Effects { upserts: Map<string, Block>; deleted: Set<string>; schematics: Map<string, SchematicLayout> }
function runTool(name: string, input: Record<string, unknown>, design: Design, blocks: Record<string, Block>, eff: Effects): { text: string; changed: boolean } {
  const blockMap = new Map(Object.entries(blocks));
  const userOnly = (key: string, b?: Block) => (!b ? `No block "${key}".` : !b.id.startsWith("@user/") ? `"${key}" is a library block — only blocks you created can be edited or deleted.` : null);
  switch (name) {
    // ── block CRUD ──
    case "create_block": {
      const nm = String(input.name ?? "").trim();
      if (!nm) return { text: "create_block needs a name.", changed: false };
      const terms = cleanTerminals(input.terminals);
      if (!terms.length) return { text: "Provide at least one terminal: { id, role: in|out, type: power|rail|signal|gnd }.", changed: false };
      const base = slug(nm), taken = new Set(Object.values(blocks).map((b) => b.id));
      let s = base, i = 2; while (taken.has(`@user/${s}`)) s = `${base}-${i++}`;
      const block: Block = { id: `@user/${s}`, name: nm, version: "1.0.0", category: (String(input.category ?? "").trim() || "custom"), glyph: (String(input.glyph ?? "").trim() || "▦"), terminals: terms };
      const key = `${block.id}@${block.version}`;
      blocks[key] = block; eff.upserts.set(key, block);
      return { text: `Created block "${nm}" — key ${key}, terminals: ${termList(block)}. Use add_block with this key to place it.`, changed: false };
    }
    case "update_block": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      const nb: Block = { ...b! };
      if (typeof input.name === "string" && input.name.trim()) nb.name = input.name.trim();
      if (typeof input.glyph === "string" && input.glyph.trim()) nb.glyph = input.glyph.trim();
      if (typeof input.category === "string" && input.category.trim()) nb.category = input.category.trim();
      if (input.terminals !== undefined) { const t = cleanTerminals(input.terminals); if (!t.length) return { text: "terminals must be a non-empty list of { id, role, type }.", changed: false }; nb.terminals = t; }
      blocks[key] = nb; eff.upserts.set(key, nb);
      return { text: `Updated ${nb.name} (${key}). Terminals: ${termList(nb)}.`, changed: false };
    }
    case "author_block": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      const c = input.chip as { profile?: unknown; pins?: unknown; mpn?: unknown; names?: unknown } | undefined;
      const names = c?.names && typeof c.names === "object" ? (c.names as Record<string, string>) : null;
      if (!names || !Object.keys(names).length) return { text: 'author_block needs chip.names — a { pinNumber: function } map, e.g. { "4": "VCC", "7": "PB6_XTAL1" }.', changed: false };
      const chip = { profile: String(c?.profile ?? "qfp"), pins: Math.max(Object.keys(names).length, Number(c?.pins) || 0), names, ...(c?.mpn ? { mpn: String(c.mpn) } : {}) };
      const ref = typeof input.ref === "string" && input.ref.trim() ? input.ref.trim() : "U1";
      const expose = Array.isArray(input.expose) ? input.expose.map(String) : [];
      const { layout, terminals } = authorChipLayout(ref, chip, expose);
      // Derive the schematic NOW so analyze/bom/the empty-block rule see the chip this same turn
      // (they all read def.schematic.parts — layout alone is invisible to them = "no components yet").
      const schematic = deriveBlockSchematic(layout);
      const rec = reconcileAuthoredTerminals(b!, terminals, key, design);
      const nb: Block = { ...b!, terminals: rec.terminals, layout, schematic };
      blocks[key] = nb; eff.upserts.set(key, nb); eff.schematics.set(key, layout);
      return { text: `Authored ${ref} (${chip.mpn ?? chip.profile}, ${Object.keys(names).length} pins) into ${b!.name} — it's now a real part (${schematic.parts.length} on BOM + footprint); exposed ${terminals.length} pin(s) as terminals.${rec.message}`, changed: true };
    }
    case "author_schematic": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      const rawParts = Array.isArray(input.parts) ? input.parts : [];
      const rawNets = Array.isArray(input.nets) ? input.nets : [];
      if (!rawParts.length) return { text: "author_schematic needs parts[] — the components in this block's subcircuit. A block should be a functional group (e.g. an oscillator = crystal + 2 caps), not empty.", changed: false };
      const parts: PartSpec[] = [];
      const mpnWarnings: string[] = [];
      for (const r of rawParts as Record<string, unknown>[]) {
        const ref = String(r.ref ?? "").trim();
        if (!ref) return { text: "every part needs a ref (e.g. C1, R3, U1, Y1).", changed: false };
        const c = r.chip as { profile?: unknown; pins?: unknown; mpn?: unknown; names?: unknown } | undefined;
        const names = c?.names && typeof c.names === "object" ? (c.names as Record<string, string>) : null;
        if (names && Object.keys(names).length) {
          parts.push({ ref, chip: { profile: String(c?.profile ?? "qfp"), pins: Math.max(Object.keys(names).length, Number(c?.pins) || 0), names, ...(c?.mpn ? { mpn: String(c.mpn) } : {}) } });
        } else {
          const type = String(r.type ?? "").trim();
          if (!type) return { text: `part ${ref} needs either a type (e.g. "capacitor", "resistor", "regulator") or a chip { names }.`, changed: false };
          const mpnRaw = r.mpn ? String(r.mpn) : "";
          const mpnOk = !!mpnRaw && mpnRaw.length <= 32 && !/[\s,;≥≤()]/.test(mpnRaw);
          if (mpnRaw && !mpnOk) mpnWarnings.push(`${ref}: dropped mpn "${mpnRaw.slice(0, 48)}" — an mpn is a bare part number (BC547, SS8050); selection criteria belong in why`);
          parts.push({ ref, type, ...(r.value ? { value: String(r.value) } : {}), ...(mpnOk ? { mpn: mpnRaw } : {}) });
        }
      }
      const nets: NetSpec[] = (rawNets as Record<string, unknown>[]).map((r) => ({
        connect: Array.isArray(r.connect) ? r.connect.map(String) : [],
        ...(r.expose ? { expose: String(r.expose) } : {}),
        ...(r.role === "in" || r.role === "out" ? { role: r.role } : {}),
        ...(typeof r.type === "string" ? { type: r.type as NetSpec["type"] } : {}),
      }));
      const { layout, terminals } = buildBlockLayout(parts, nets);
      // mpns are part metadata overrides; values ride on the symbols (so BOM type stays the clean catalog type).
      const authored = parts.filter((p) => p.mpn || p.chip?.mpn).map((p) => ({ ref: p.ref, part: (p.mpn ?? p.chip?.mpn)! }));
      const schematic = deriveBlockSchematic(layout, authored);
      if (!schematic.parts.length) return { text: "No parts were produced — check the part types/refs.", changed: false };
      const rec = reconcileAuthoredTerminals(b!, terminals, key, design);
      const nb: Block = { ...b!, terminals: rec.terminals, layout, schematic };
      blocks[key] = nb; eff.upserts.set(key, nb); eff.schematics.set(key, layout);
      return { text: `Authored ${b!.name}: ${schematic.parts.length} part(s) [${schematic.parts.map((p) => `${p.ref} ${p.type}${p.value ? ` ${p.value}` : ""}`).join(", ")}] wired into one subcircuit; exposed ${terminals.length} terminal(s): ${terminals.map((t) => t.id).join(", ") || "(none)"}.${rec.message}${mpnWarnings.length ? ` ⚠ ${mpnWarnings.join("; ")}.` : ""}`, changed: true };
    }
    case "expose_pins": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      const pins = Array.isArray(input.pins) ? input.pins.map(String) : [];
      if (!pins.length) return { text: 'expose_pins needs pins[] — the chip function names to break out, e.g. ["PD0","PD1","PD2","PC0","PC1"].', changed: false };
      if (!b!.layout?.symbols.some((s) => s.type === "chip")) return { text: `${b!.name} has no authored chip — use author_block/author_schematic first. expose_pins breaks out more of an existing chip's pins.`, changed: false };
      const chipRef = typeof input.ref === "string" && input.ref.trim() ? input.ref.trim() : undefined;
      const { layout, terminals, added, skipped } = exposeChipPins(b!.layout, pins, chipRef);
      if (!added.length) return { text: `Nothing to add. Skipped (already exposed or not on the chip): ${skipped.join(", ") || "—"}.`, changed: false };
      const schematic = deriveBlockSchematic(layout, b!.schematic?.parts ?? []);
      const have = new Set(b!.terminals.map((t) => t.id));
      const merged = [...b!.terminals];
      for (const t of terminals) if (!have.has(t.id)) { merged.push(t); have.add(t.id); }
      const nb: Block = { ...b!, terminals: merged, layout, schematic };
      blocks[key] = nb; eff.upserts.set(key, nb); eff.schematics.set(key, layout);
      return { text: `Exposed ${added.length} pin(s) on ${b!.name}: ${added.join(", ")}.${skipped.length ? ` Skipped (already exposed / not on chip): ${skipped.join(", ")}.` : ""} No existing terminals were renamed.`, changed: true };
    }
    case "set_value": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      const ref = String(input.ref ?? "").trim();
      const value = String(input.value ?? "").trim();
      if (!ref || !value) return { text: "set_value needs the part ref (e.g. C1) and the value (e.g. 22pF).", changed: false };
      if (!b!.layout) return { text: `${b!.name} has no authored schematic yet — use author_schematic/author_block first.`, changed: false };
      const sym = b!.layout.symbols.find((s) => (s.ref ?? s.id) === ref);
      if (!sym) return { text: `No part "${ref}" in ${b!.name}. Parts: ${b!.layout.symbols.filter((s) => s.type !== "port").map((s) => s.ref ?? s.id).join(", ") || "(none)"}.`, changed: false };
      const layout = { ...b!.layout, symbols: b!.layout.symbols.map((s) => (s === sym ? { ...s, value } : s)) };
      // re-derive, preserving existing part metadata (mpn/footprint) by feeding the current parts back in
      const schematic = deriveBlockSchematic(layout, b!.schematic?.parts ?? []);
      const nb: Block = { ...b!, layout, schematic };
      blocks[key] = nb; eff.upserts.set(key, nb); eff.schematics.set(key, layout);
      const insts = design.blocks.filter((bi) => bi.block === key).length;
      const shared = insts > 1 ? ` ⚠ This block has ${insts} placed instances and they SHARE one definition — every one is now ${value}. If they need different values, give each its own subcircuit (fold the part into the functional block it serves via author_schematic) instead of reusing one shared block.` : "";
      return { text: `Set ${ref} = ${value} in ${b!.name}.${shared}`, changed: true };
    }
    case "delete_block": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      delete blocks[key]; eff.deleted.add(key); eff.upserts.delete(key);
      const hadInst = design.blocks.some((x) => x.block === key);
      design.blocks = design.blocks.filter((x) => x.block !== key);
      // keep connections whose endpoints still exist — INCLUDING connector pins (connectors live in
      // design.connectors, not design.blocks), so deleting a block doesn't silently drop its connector wiring.
      const refs = new Set([...design.blocks.map((x) => x.ref), ...(design.connectors ?? []).map((c) => c.ref)]);
      design.connections = design.connections.filter((c) => refs.has(c.from.split(".")[0]) && refs.has(c.to.split(".")[0]));
      return { text: `Deleted block ${b!.name} (${key})${hadInst ? " and its placed instances" : ""}.`, changed: hadInst };
    }
    case "list_blocks":
      return { text: Object.entries(blocks).map(([k, b]) => `${k} — ${b.name}: [${termList(b)}]`).join("\n") || "(no blocks)", changed: false };
    case "find_blocks": {
      // spec-search over DECLARED specs (the WEBENCH answer): structured fields win, else parse the query text
      const q = parseSpecQuery(String(input.query ?? ""));
      if (input.vin != null) q.vin = Number(input.vin);
      if (input.vout != null) q.vout = Number(input.vout);
      if (input.iout != null) q.iout = Number(input.iout);
      const byKey = new Map(Object.entries(blocks).map(([k, b]) => [b, k]));
      const hits = findBlocks(Object.values(blocks), q);
      if (!hits.length) return { text: "No block matches that spec. The criteria gate on declared specs only — try relaxing one (or author a new block).", changed: false };
      return {
        text: hits.slice(0, 8).map((m) => `${byKey.get(m.block)} — ${m.block.name}\n  ${m.why.join("\n  ")}`).join("\n"),
        changed: false,
      };
    }
    case "get_block": {
      const key = String(input.block ?? ""), b = blocks[key];
      if (!b) return { text: `No block "${key}". Call list_blocks for valid keys.`, changed: false };
      const parts = b.schematic?.parts ?? [];
      const chipSym = b.layout?.symbols.find((s) => s.type === "chip");
      const lines = [
        `${b.name} (${key})${b.id.startsWith("@user/") ? "" : " — library block"}`,
        `terminals: ${termList(b)}`,
        chipSym?.chip ? `chip: ${chipSym.chip.mpn ?? chipSym.chip.profile} (${chipSym.chip.profile}, ${chipSym.chip.pins} pins)` : null,
        parts.length
          ? `parts (${parts.length} → BOM): ${parts.map((p) => `${p.ref} ${p.type}${p.value ? ` ${p.value}` : ""}${p.part ? ` [${p.part}]` : ""}`).join(", ")}`
          : `parts: none — this block is a hollow shell (won't appear in the BOM). Use author_block to drop in a real chip.`,
      ].filter(Boolean);
      return { text: lines.join("\n"), changed: false };
    }
    case "list_instances": {
      const bl = design.blocks.map((bi) => `${bi.ref} = ${bi.block} [${termList(blocks[bi.block])}]`);
      const cn = (design.connectors ?? []).map((ci) => `${ci.ref} = connector ${ci.connector} [${connectorPart(ci.connector)?.pins.join(", ") ?? "?"}]`);
      return { text: [...bl, ...cn].join("\n") || "(empty design)", changed: false };
    }
    case "list_connectors":
      return { text: Object.values(CONNECTOR_CATALOG).map((c) => {
        const defs = c.defaults
          ? ` — built-in: ${Object.entries(c.defaults).map(([p, s]) => `${p}=${s.name ?? p}${rmax(s.v) != null ? ` ${rmax(s.v)}V` : ""}`).join(", ")}`
          : "";
        return `${c.id} — ${c.name}: [${c.pins.join(", ")}]${c.pinAmps ? ` · ${c.pinAmps}A/contact` : ""}${defs}`;
      }).join("\n"), changed: false };
    case "electrace_help":
      return { text: electraceHelpText(), changed: false };
    case "add_connector": {
      const cid = String(input.connector ?? "");
      const part = connectorPart(cid);
      if (!part) return { text: `No connector "${cid}". Call list_connectors for valid ids (e.g. usb-mini-b, barrel, hdr-2x5).`, changed: false };
      const used = new Set((design.connectors ?? []).map((c) => c.ref));
      let ref = (typeof input.ref === "string" && input.ref.trim()) ? input.ref.trim() : "J1";
      if (used.has(ref) || design.blocks.some((b) => b.ref === ref)) { let i = 1; while (used.has(`J${i}`) || design.blocks.some((b) => b.ref === `J${i}`)) i++; ref = `J${i}`; }
      const n = (design.connectors ?? []).length;
      design.connectors = [...(design.connectors ?? []), { ref, connector: cid, pos: [40 + (n % 4) * 200, 600] }];
      return { text: `Added ${ref} (${part.name}). Pins: ${part.pins.join(", ")}. Wire a block terminal to a pin with connect, e.g. connect FT232.USBDP ↔ ${ref}.D+.`, changed: true };
    }
    case "add_block": {
      const key = String(input.block ?? "");
      const b = blocks[key]; if (!b) return { text: `No such block "${key}". Call list_blocks for valid keys.`, changed: false };
      const ref = (typeof input.ref === "string" && input.ref.trim()) ? input.ref.trim() : freshRef(design, b);
      if (design.blocks.some((x) => x.ref === ref)) return { text: `Ref "${ref}" already exists.`, changed: false };
      const dupes = design.blocks.filter((x) => x.block === key).length;
      const singleComponent = (b.schematic?.parts?.length ?? 0) === 1;
      const n = design.blocks.length;
      design.blocks.push({ ref, block: key, pos: [40 + (n % 4) * 260, 120 + Math.floor(n / 4) * 220] });
      // Nudge away from scattering the same single-part block as N instances that share one value —
      // support parts (caps, pull-ups) belong inside the functional block they serve (author_schematic).
      const nudge = (dupes >= 1 && singleComponent) ? ` ⚠ That's instance #${dupes + 1} of a single-component block — all instances share one value (set_value hits them all). If these are support parts (decoupling/load caps, pull-ups), fold them into the functional block they serve via author_schematic instead, so each carries its own value.` : "";
      return { text: `Added ${ref} (${b.name}). Terminals: ${termList(b)}.${nudge}`, changed: true };
    }
    case "remove_block": {
      const ref = String(input.ref ?? "");
      if (!design.blocks.some((x) => x.ref === ref)) return { text: `No instance "${ref}".`, changed: false };
      design.blocks = design.blocks.filter((x) => x.ref !== ref);
      design.connections = design.connections.filter((c) => c.from.split(".")[0] !== ref && c.to.split(".")[0] !== ref);
      return { text: `Removed ${ref} and its connections.`, changed: true };
    }
    case "connect": {
      const fromIn = String(input.from ?? ""), toIn = String(input.to ?? "");
      const valid = (e: string) => {
        const [r, t] = e.split(".");
        const bi = design.blocks.find((x) => x.ref === r);
        if (bi && (blocks[bi.block] && canonicalTerminal(blocks[bi.block], t) != null)) return true;
        const ci = (design.connectors ?? []).find((x) => x.ref === r); // a connector pin is a valid endpoint too
        return !!ci && !!connectorPart(ci.connector)?.pins.includes(t);
      };
      // An endpoint can be REF.terminal OR an existing net name (e.g. "GND") — resolve a net name to one
      // of its member pins so you can wire straight to a net without hunting for a specific terminal on it.
      const asNetMember = (name: string): string | null => {
        try {
          const a = analyze(design, blockMap);
          const net = a.resolved.nets.find((n) => n.id.toLowerCase() === name.toLowerCase());
          if (!net) return null;
          const s = net.sources[0]; if (s) return `${s.instance}.${s.terminal}`;
          const k = net.sinks[0]; if (k) return `${k.pin.instance}.${k.pin.terminal}`;
        } catch { /* ignore */ }
        return null;
      };
      // when an endpoint is wrong, NAME the valid options — agents repair from explicit diagnostics
      const validTermsOf = (r: string): string | null => {
        const bi = design.blocks.find((x) => x.ref === r);
        if (bi) return blocks[bi.block]?.terminals.map((x) => x.id).join(", ") ?? null;
        const ci = (design.connectors ?? []).find((x) => x.ref === r);
        return ci ? connectorPart(ci.connector)?.pins.join(", ") ?? null : null;
      };
      const resolve1 = (e: string): { ep?: string; err?: string } => {
        if (valid(e)) return { ep: e };
        if (!e.includes(".")) { const m = asNetMember(e); if (m) return { ep: m }; return { err: `"${e}" isn't a REF.terminal or an existing net.` }; }
        const [r, t] = e.split(".");
        const terms = validTermsOf(r);
        if (terms) return { err: `${r}.${t} doesn't exist — ${r}'s valid terminals are: ${terms}.` };
        return { err: `No instance "${r}" (need REF.terminal, or a net name like GND). Call list_instances for valid refs.` };
      };
      const rf = resolve1(fromIn), rt = resolve1(toIn);
      if (rf.err) return { text: rf.err, changed: false };
      if (rt.err) return { text: rt.err, changed: false };
      const from = rf.ep!, to = rt.ep!;
      if (from === to) return { text: `${fromIn} and ${toIn} resolve to the same pin — already the same net.`, changed: false };
      if (design.connections.some((c) => (c.from === from && c.to === to) || (c.from === to && c.to === from))) return { text: `${from} ↔ ${to} already connected.`, changed: false };
      design.connections.push({ from, to });
      const note = (from !== fromIn || to !== toIn) ? ` (via net member ${from !== fromIn ? from : to})` : "";
      return { text: `Connected ${from} ↔ ${to}${note}.`, changed: true };
    }
    case "list_connections": {
      // the RAW wire list, including BROKEN endpoints — the net graph hides invalid wires, and
      // agents repair from what they can see (GPT-5.5 field feedback)
      const epOk = (e: string) => {
        const [r, t] = e.split(".");
        const bi = design.blocks.find((x) => x.ref === r);
        if (bi) return (blocks[bi.block] && canonicalTerminal(blocks[bi.block], t) != null) ? true : false;
        const ci = (design.connectors ?? []).find((x) => x.ref === r);
        return !!ci && !!connectorPart(ci.connector)?.pins.includes(t);
      };
      const lines = design.connections.map((c, i) => {
        const bad = [c.from, c.to].filter((e) => !epOk(e));
        return `${i}: ${c.from} ↔ ${c.to}${bad.length ? `  ⚠ INVALID endpoint${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}` : ""}`;
      });
      const broken = lines.filter((l) => l.includes("INVALID")).length;
      return { text: lines.join("\n") + (broken ? `\n${broken} invalid — remove_invalid_wires drops them, or reconnect deliberately.` : "") || "(no connections)", changed: false };
    }
    case "remove_invalid_wires": {
      const epOk = (e: string) => {
        const [r, t] = e.split(".");
        const bi = design.blocks.find((x) => x.ref === r);
        if (bi) return (blocks[bi.block] && canonicalTerminal(blocks[bi.block], t) != null) ? true : false;
        const ci = (design.connectors ?? []).find((x) => x.ref === r);
        return !!ci && !!connectorPart(ci.connector)?.pins.includes(t);
      };
      const before = design.connections.length;
      const dropped = design.connections.filter((c) => !epOk(c.from) || !epOk(c.to));
      design.connections = design.connections.filter((c) => epOk(c.from) && epOk(c.to));
      return {
        text: dropped.length ? `Removed ${dropped.length} invalid wire${dropped.length > 1 ? "s" : ""}:\n${dropped.map((c) => `  ${c.from} ↔ ${c.to}`).join("\n")}` : "No invalid wires — every connection's endpoints exist.",
        changed: before !== design.connections.length,
      };
    }
    case "disconnect": {
      const from = String(input.from ?? ""), to = String(input.to ?? "");
      const before = design.connections.length;
      design.connections = design.connections.filter((c) => !((c.from === from && c.to === to) || (c.from === to && c.to === from)));
      return { text: design.connections.length < before ? `Disconnected ${from} ↔ ${to}.` : `No such connection.`, changed: design.connections.length < before };
    }
    case "analyze_design": {
      try {
        const a = analyze(design, blockMap);
        const active = a.findings.filter((f) => !f.acknowledged), acked = a.findings.filter((f) => f.acknowledged);
        const n = (s: string) => active.filter((f) => f.severity === s).length;
        const head = `${design.blocks.length} blocks, ${a.resolved.nets.length} nets — ${n("error")} errors, ${n("warn")} warnings, ${n("info") + n("recommendation")} notes${acked.length ? `, ${acked.length} acknowledged` : ""}.`;
        // include rule@at so you can acknowledge a specific correct-but-noisy finding
        const body = active.slice(0, 25).map((f) => `[${f.severity}] ${f.message}  ·  ${f.rule} @ ${f.at.join(",")}`).join("\n");
        const ack = acked.map((f) => `✓ ${f.message}${f.acknowledged?.note ? ` (intended: ${f.acknowledged.note})` : ""}`).join("\n");
        return { text: [body ? `${head}\n${body}` : `${head} All clear.`, ack].filter(Boolean).join("\n"), changed: false };
      } catch (e) { return { text: `Analysis failed: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    case "acknowledge": {
      const rule = String(input.rule ?? "").trim();
      const at = Array.isArray(input.at) ? input.at.map(String) : (input.at ? [String(input.at)] : []);
      if (!rule || !at.length) return { text: "acknowledge needs the finding's rule and at (from analyze_design, e.g. rule \"connectivity/multiple-drivers\", at [\"VCC\"]).", changed: false };
      const note = typeof input.note === "string" ? input.note.trim() : "";
      const acks = design.acks ?? (design.acks = []);
      const exists = acks.find((x) => x.rule === rule && [...x.at].sort().join(",") === [...at].sort().join(","));
      if (exists) { exists.note = note || exists.note; return { text: `Already acknowledged ${rule} @ ${at.join(",")}.`, changed: true }; }
      acks.push({ rule, at, ...(note ? { note } : {}) });
      return { text: `Acknowledged ${rule} @ ${at.join(",")}${note ? ` — "${note}"` : ""}. It's now muted and won't count as a warning. Only do this for findings that are genuinely correct/intended.`, changed: true };
    }
    case "unacknowledge": {
      const rule = String(input.rule ?? "").trim();
      const at = Array.isArray(input.at) ? input.at.map(String) : (input.at ? [String(input.at)] : []);
      const before = (design.acks ?? []).length;
      design.acks = (design.acks ?? []).filter((x) => !(x.rule === rule && [...x.at].sort().join(",") === [...at].sort().join(",")));
      return { text: design.acks.length < before ? `Un-acknowledged ${rule} @ ${at.join(",")} — it will be flagged again.` : "No matching acknowledgement.", changed: design.acks.length < before };
    }
    case "list_nets": {
      try {
        const a = analyze(design, blockMap);
        if (!a.resolved.nets.length) return { text: "(no nets — nothing wired yet)", changed: false };
        const vstr = (r: { value?: number; min?: number; max?: number } | undefined) =>
          !r ? "" : typeof r.value === "number" ? ` ${r.value}V` : ` ${r.min ?? "?"}–${r.max ?? "?"}V`;
        const text = a.resolved.nets.map((nt) => {
          const drv = nt.sources.map((s) => `${s.instance}.${s.terminal}`).join(", ") || "none";
          const load = nt.sinks.map((s) => `${s.pin.instance}.${s.pin.terminal}`).join(", ") || "none";
          // board I/O is part of the net — hiding connector pins made the graph untrustworthy
          const conn = nt.connectorPins?.length ? ` connectors=[${nt.connectorPins.join(", ")}]` : "";
          return `${nt.id} (${nt.type}${vstr(nt.voltage)}): drivers=[${drv}] loads=[${load}]${conn}`;
        }).join("\n");
        return { text, changed: false };
      } catch (e) { return { text: `Could not derive nets: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    case "power_budget": {
      try {
        const a = analyze(design, blockMap);
        const budgets = railBudgets(a.resolved);
        if (!budgets.length) return { text: "(no power/rail nets with a current budget yet)", changed: false };
        const text = budgets.map((b) => {
          const cap = typeof b.capacityA === "number" ? `${b.capacityA}A` : "?";
          const pct = typeof b.usedPct === "number" ? ` (${Math.round(b.usedPct)}%${b.usedPct > 100 ? " — OVER" : ""})` : "";
          const head = typeof b.headroomA === "number" ? `, headroom ${b.headroomA}A` : "";
          const w = typeof b.watts === "number" ? `, ~${b.watts}W` : "";
          return `${b.net}${typeof b.voltage === "number" ? ` ${b.voltage}V` : ""}: draw ${b.drawA}A / ${cap}${pct}${head}${w}`;
        }).join("\n");
        return { text, changed: false };
      } catch (e) { return { text: `Could not compute budgets: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    case "set_isolation": {
      const a = String(input.a ?? "").trim(), b = String(input.b ?? "").trim();
      if (!a || !b) return { text: 'set_isolation needs a and b (block refs; b may be "*" for all others).', changed: false };
      const refs = new Set(design.blocks.map((x) => x.ref));
      if (!refs.has(a) || (b !== "*" && !refs.has(b))) return { text: `Unknown block ref "${!refs.has(a) ? a : b}". Use refs from list_instances.`, changed: false };
      const iso = design.isolation ?? (design.isolation = []);
      const same = (c: { a: string; b: string }) => (c.a === a && c.b === b) || (c.a === b && c.b === a);
      if (input.remove) {
        const before = iso.length;
        design.isolation = iso.filter((c) => !same(c));
        return { text: design.isolation.length < before ? `Removed the isolation requirement between ${a} and ${b}.` : "No matching isolation requirement.", changed: design.isolation.length < before };
      }
      if (iso.some(same)) return { text: `Already declared: ${a} isolated from ${b}.`, changed: false };
      const note = typeof input.note === "string" ? input.note.trim() : "";
      iso.push({ a, b, ...(note ? { note } : {}) });
      // verify immediately — the whole point of declaring is learning whether the barrier already holds
      try {
        const hits = analyze(design, blockMap).findings.filter((f) => f.rule === "isolation/bridged");
        return {
          text: hits.length
            ? `Declared ${a} ⊘ ${b} — and it's ALREADY VIOLATED:\n${hits.map((f) => `  [${f.severity}] ${f.message}`).join("\n")}\nFix the bridge (usually a shared ground) or remove the requirement if it's wrong.`
            : `Declared ${a} ⊘ ${b}. The barrier currently holds — it will be re-verified on every change.`,
          changed: true,
        };
      } catch { return { text: `Declared ${a} ⊘ ${b}.`, changed: true }; }
    }
    case "set_net_label": {
      const node = String(input.node ?? "").trim();
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 24) : "";
      const dot = node.indexOf(".");
      if (dot <= 0) return { text: 'set_net_label needs node as "REF.terminal" (e.g. MCU1.vdd).', changed: false };
      const ref = node.slice(0, dot), term = node.slice(dot + 1);
      const bi = design.blocks.find((x) => x.ref === ref);
      if (!bi) return { text: `Unknown block ref "${ref}". Use refs from list_instances.`, changed: false };
      const blk = blockMap.get(bi.block);
      const canon = blk ? canonicalTerminal(blk, term) : undefined;
      if (blk && !canon) return { text: `${ref} has no terminal "${term}". Terminals: ${blk.terminals.map((t) => t.id).join(", ")}.`, changed: false };
      const n = `${ref}.${canon ?? term}`;
      const labels = design.labels ?? (design.labels = []);
      const idx = labels.findIndex((l) => l.node === n);
      if (!name) {
        if (idx < 0) return { text: `No net label on ${n}.`, changed: false };
        labels.splice(idx, 1);
        return { text: `Removed the net label from ${n}.`, changed: true };
      }
      if (idx >= 0) labels[idx] = { node: n, name }; else labels.push({ node: n, name });
      const peers = labels.filter((l) => l.name === name && l.node !== n).map((l) => l.node);
      return {
        text: `Labeled ${n} as "${name}".${peers.length ? ` It now shares one net with ${peers.join(", ")} — no wire needed.` : ` Label another terminal "${name}" to join it into the same net without a wire.`}`,
        changed: true,
      };
    }
    case "set_signal_class": {
      const pin = String(input.pin ?? "").trim();
      const cls = String(input.cls ?? "").trim();
      if (!pin || !cls) return { text: 'set_signal_class needs pin ("REF.terminal") and cls (a class id, or "none" to clear).', changed: false };
      if (cls === "none") {
        const before = (design.signals ?? []).length;
        design.signals = (design.signals ?? []).filter((s) => s.pin !== pin);
        return { text: design.signals.length < before ? `Cleared the signal class on ${pin}.` : `No class was set on ${pin}.`, changed: design.signals.length < before };
      }
      const def = NET_CLASSES[cls];
      if (!def) return { text: `Unknown class "${cls}". Valid: ${Object.keys(NET_CLASSES).join(", ")} (or "none").`, changed: false };
      const pinOk = (e: string) => {
        const [r, t] = e.split(".");
        const bi = design.blocks.find((x) => x.ref === r);
        if (bi) return !!(blocks[bi.block] && canonicalTerminal(blocks[bi.block], t) != null);
        const ci = (design.connectors ?? []).find((x) => x.ref === r);
        return !!ci && !!connectorPart(ci.connector)?.pins.includes(t);
      };
      if (!pinOk(pin)) return { text: `No such pin "${pin}". Use REF.terminal from list_instances, or a connector pin like J1.D+.`, changed: false };
      const pairPin = typeof input.pairPin === "string" && input.pairPin.trim() ? input.pairPin.trim() : undefined;
      if (pairPin && !pinOk(pairPin)) return { text: `No such pairPin "${pairPin}".`, changed: false };
      if (def.kind !== "single" && !pairPin) return { text: `${def.name} is a pair class — pass pairPin (the other side: B / CANL / D−) so termination and pair-matching know both nets.`, changed: false };
      const entry = {
        pin, cls,
        ...(pairPin ? { pairPin } : {}),
        ...(typeof input.pullupOhms === "number" ? { pullupOhms: input.pullupOhms } : {}),
        ...(typeof input.busCapPf === "number" ? { busCapPf: input.busCapPf } : {}),
        ...(input.terminated_externally ? { terminated: "external" as const } : {}),
      };
      design.signals = [...(design.signals ?? []).filter((s) => s.pin !== pin), entry];
      try {
        const si = analyze(design, blockMap).findings.filter((f) => f.rule.startsWith("si/"));
        return {
          text: [`Declared the net at ${pin} as ${def.name}.`,
            si.length ? `The checks now flag:\n${si.map((f) => `  [${f.severity}] ${f.message}`).join("\n")}` : "No SI findings on the schematic right now (trace-length and pair-skew checks run in the PCB DRC).",
          ].join("\n"), changed: true,
        };
      } catch { return { text: `Declared the net at ${pin} as ${def.name}.`, changed: true }; }
    }
    case "declare_connector_pins": {
      const ref = String(input.ref ?? "").trim();
      const ci = (design.connectors ?? []).find((c) => c.ref === ref);
      if (!ci) return { text: `No placed connector "${ref}". Placed: ${(design.connectors ?? []).map((c) => c.ref).join(", ") || "none — add one with add_connector first"}.`, changed: false };
      const part = connectorPart(ci.connector)!;
      const decls = (input.pins && typeof input.pins === "object" && !Array.isArray(input.pins)) ? input.pins as Record<string, Record<string, unknown>> : null;
      if (!decls || !Object.keys(decls).length) return { text: `declare_connector_pins needs pins (pin id → declaration). ${ref}'s pins: ${part.pins.join(", ")}.`, changed: false };
      const bad = Object.keys(decls).filter((p) => !part.pins.includes(p));
      if (bad.length) return { text: `${ref} (${part.name}) has no pin ${bad.join(", ")}. Its pins: ${part.pins.join(", ")}.`, changed: false };
      const cur: Record<string, ConnectorPinSpec> = { ...(ci.pins ?? {}) };
      for (const [p, d] of Object.entries(decls)) {
        if (d.clear) { delete cur[p]; continue; }
        const spec: ConnectorPinSpec = { ...(cur[p] ?? {}) };
        if (typeof d.name === "string" && d.name.trim()) spec.name = d.name.trim();
        if (typeof d.type === "string" && ["power", "rail", "gnd", "signal"].includes(d.type)) spec.type = d.type as NetType;
        if (d.direction === "feeds_board") spec.role = "out"; else if (d.direction === "board_feeds") spec.role = "in";
        if (typeof d.v_max === "number") spec.v = { max: d.v_max, unit: "V" };
        if (typeof d.i_max === "number") spec.i = { max: d.i_max, unit: "A" };
        cur[p] = spec;
      }
      if (Object.keys(cur).length) ci.pins = cur; else delete ci.pins;
      const eff = part.pins.flatMap((p) => {
        const s = effectivePinSpec(part, ci.pins, p);
        if (!s) return [];
        const v = rmax(s.v), i = rmax(s.i);
        const role = (s.role ?? (s.v ? "out" : "in")) === "out" ? "feeds board" : "board feeds";
        return [`  ${p}: ${s.name ?? p} · ${s.type ?? "signal"} · ${role}${v != null ? ` · ${v}V` : ""}${i != null ? ` · ${i}A` : ""}`];
      });
      return {
        text: [`Declared. ${ref} (${part.name}) effective pins:`, ...eff,
          part.pinAmps ? `Contact rating ${part.pinAmps} A/pin — enforced against actual through-current.` : "",
        ].filter(Boolean).join("\n"), changed: true,
      };
    }
    case "stress_test": {
      const volts = Number(input.volts);
      if (!Number.isFinite(volts) || volts <= 0) return { text: "stress_test needs volts, e.g. 24.", changed: false };
      const r2 = (x: number) => Math.round(x * 100) / 100;
      try {
        const a = analyze(design, blockMap);
        // authored voltage limits on placed blocks + the declared input maxima of everything sitting on an
        // input-tracking rail (a rail whose source declares a RANGE — it follows the external input).
        const authored = design.blocks.flatMap((bi) => (blocks[bi.block]?.limits ?? [])
          .filter((l) => l.unit === "V" || /\bv|vin|vac/i.test(l.field))
          .map((l) => ({ ref: bi.ref, field: l.field, value: l.value, note: l.note, margin: r2(l.value - volts) })));
        const entryNets = a.resolved.nets.filter((net) =>
          (net.type === "power" || net.type === "rail") &&
          net.sources.some((src) => src.def.v && src.def.v.min != null && src.def.v.max != null && src.def.v.max > src.def.v.min));
        const fromRails = entryNets.flatMap((net) => net.sinks.flatMap((sk) => {
          const lim = sk.pin.def.v?.max ?? sk.pin.def.v?.value;
          if (lim == null) return [];
          return [{ ref: sk.pin.instance, field: `${sk.pin.terminal} max`, value: lim, note: `sits on input-tracking rail ${net.id}`, margin: r2(lim - volts) }];
        }));
        const seen = new Set<string>();
        const limits = [...fromRails, ...authored]
          .filter((l) => { const k = `${l.ref}|${l.field}`; if (seen.has(k)) return false; seen.add(k); return true; })
          .sort((x, y) => x.margin - y.margin);
        if (!limits.length) return { text: "No declared voltage limits sit on an input-tracking rail — the stress test has nothing to check against. Say so honestly rather than guessing.", changed: false };
        const dead = limits.filter((l) => l.margin < 0);
        const head = dead.length
          ? `FAILS at ${volts} V — ${dead.length} limit${dead.length > 1 ? "s" : ""} exceeded:`
          : `Holds at ${volts} V — tightest: ${limits[0].ref} ${limits[0].field} (${limits[0].margin} V headroom).`;
        const rows = limits.slice(0, 12).map((l) => `  ${l.margin < 0 ? "✕" : "✓"} ${l.ref} ${l.field} = ${l.value} V → margin ${l.margin >= 0 ? "+" : ""}${l.margin} V${l.note ? ` (${l.note})` : ""}`);
        return { text: [head, ...rows].join("\n"), changed: false };
      } catch (e) { return { text: `Stress test failed: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    case "standby_draw": {
      try {
        const rep = standbyDraw(analyze(design, blockMap).resolved);
        if (!rep.perSource.length) return { text: "No always-on draw found (or nothing solvable) — either genuinely zero floor, or the sources/paths aren't declared enough to compute one.", changed: false };
        const fmtA = (a: number) => a >= 1e-3 ? `${(a * 1e3).toFixed(2)} mA` : a >= 1e-6 ? `${(a * 1e6).toFixed(1)} µA` : `${(a * 1e9).toFixed(0)} nA`;
        const lines = rep.perSource.map((s) => {
          const top = s.contributors.slice(0, 8).map((c) => `    ${c.label}: ${fmtA(c.amps)} [${c.kind}]`).join("\n");
          const life = s.lifeDays ? `\n  Declared capacity survives ~${s.lifeDays >= 365 ? `${(s.lifeDays / 365).toFixed(1)} years` : `${Math.round(s.lifeDays)} days`} at this floor.` : "";
          return `${s.node}: ${fmtA(s.amps)} always-on floor\n${top}${life}`;
        }).join("\n");
        const undecl = rep.undeclared.length ? `\nAssumed 0 (no iStandby declared): ${rep.undeclared.join(", ")} — the real floor is higher; declare their sleep draws.` : "";
        return { text: `Standby / off-state draw (the floor that never sleeps — logic-state and charging excluded honestly):\n${lines}${undecl}`, changed: false };
      } catch (e) { return { text: `standby_draw failed: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    case "thevenin": {
      const node = String(input.pin ?? "").trim();
      if (!node) return { text: 'thevenin needs pin ("REF.terminal" or a net name).', changed: false };
      try {
        const th = theveninAt(analyze(design, blockMap).resolved, node);
        if (!th) return { text: `Couldn't compute a Thévenin equivalent at "${node}" — the node isn't in a solvable (linear, sourced) subcircuit.`, changed: false };
        const fmt = (x: number) => x >= 1000 ? `${(x / 1000).toFixed(2)} kΩ` : `${x.toFixed(1)} Ω`;
        return {
          text: `Thévenin seen from ${node}: Vth = ${th.voc.toFixed(3)} V in series with Rth = ${fmt(th.rth)} (Isc = ${isFinite(th.isc) ? (th.isc * 1000).toFixed(2) + " mA" : "—"}; Norton: ${isFinite(th.isc) ? (th.isc * 1000).toFixed(2) + " mA ∥ " + fmt(th.rth) : "—"}). Maximum power transfer to a matched load: ${(th.voc * th.voc / (4 * Math.max(th.rth, 1e-9)) * 1000).toFixed(1)} mW at R_load = Rth.`,
          changed: false,
        };
      } catch (e) { return { text: `thevenin failed: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    case "solve_dc": {
      try {
        const sol = solveDc(analyze(design, blockMap).resolved);
        if (!sol.solvedComponents) {
          return { text: `Nothing solvable yet — the DC solver needs a declared source wired into resistive paths. ${sol.findings[0]?.message ?? ""}`.trim(), changed: false };
        }
        const volts = Object.entries(sol.netVolts)
          .filter(([k]) => !k.startsWith("~"))
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 30)
          .map(([k, v]) => `  ${k}: ${v.toFixed(3)} V`).join("\n");
        const rs = sol.parts.filter((p) => p.watts > 1e-4).sort((a, b) => b.watts - a.watts).slice(0, 15)
          .map((p) => `  ${p.ref}: ${(p.amps * 1000).toFixed(2)} mA · ${(p.watts * 1000).toFixed(1)} mW${p.ratingWatts ? ` (rated ${p.ratingWatts} W)` : ""}`).join("\n");
        const notes = sol.findings.map((f) => `  [${f.severity}] ${f.message}`).join("\n");
        return {
          text: [`Solved ${sol.solvedComponents} subcircuit(s) — REAL numbers, not worst-case bounds.`,
            `Node voltages:\n${volts}`, rs ? `Resistor operating points (hottest first):\n${rs}` : "",
            notes ? `Solver notes:\n${notes}` : ""].filter(Boolean).join("\n"),
          changed: false,
        };
      } catch (e) { return { text: `Solve failed: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    default:
      return { text: `Unknown tool ${name}.`, changed: false };
  }
}

const TERMS_SCHEMA = { type: "array", description: "terminals (pins) of the block", items: { type: "object", properties: { id: { type: "string", description: "pin/terminal name, e.g. vin" }, role: { type: "string", enum: ["in", "out"] }, type: { type: "string", enum: ["power", "rail", "signal", "gnd"] } }, required: ["id", "role", "type"] } };
const TOOLS = [
  { name: "list_blocks", description: "List the block types available to place, with their terminals. Library blocks plus any you've created.", input_schema: { type: "object", properties: {} } },
  { name: "find_blocks", description: "Find blocks by DECLARED spec — the right tool when the user states a need like \"drop 18 V to 5 V at 3 A\". Matches only on authored spec fields (vin range, vout, iout_max) and returns WHY each block fits, built from its declared numbers. Prefer this over guessing from list_blocks.", input_schema: { type: "object", properties: { query: { type: "string", description: "free text, e.g. \"18V → 5V at 3A\" or \"3.3v ldo\"" }, vin: { type: "number", description: "supply voltage you have (V)" }, vout: { type: "number", description: "rail you want (V)" }, iout: { type: "number", description: "load current you need (A)" } } } },
  { name: "create_block", description: "Create a new custom (user) block with named terminals/pins. It appears in the palette and can be placed with add_block.", input_schema: { type: "object", properties: { name: { type: "string" }, glyph: { type: "string", description: "1–2 char icon (optional)" }, category: { type: "string", description: "optional, e.g. power/signal/custom" }, terminals: TERMS_SCHEMA }, required: ["name", "terminals"] } },
  { name: "update_block", description: "Edit a custom block you created — rename it, change its glyph/category, or relabel its terminals (pins). Library blocks can't be edited.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" }, name: { type: "string" }, glyph: { type: "string" }, category: { type: "string" }, terminals: TERMS_SCHEMA }, required: ["block"] } },
  { name: "get_block", description: "Inspect ONE block's current state: its terminals, whether it's been authored with a real chip (and which), and the parts in its internal schematic with their values (what's on the BOM). Use this to verify ground truth after authoring/editing instead of assuming — read-after-write.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" } }, required: ["block"] } },
  { name: "author_block", description: "Populate a custom block's INTERNAL schematic with a real chip: places the IC with its full pinout as an actual part (so it hits the BOM + gets a PCB footprint), and exposes the chosen pins as the block's terminals. This is how you make a block real instead of a hollow shell — use it for MCUs/ICs.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" }, ref: { type: "string", description: "chip reference designator, e.g. U1 (default U1)" }, chip: { type: "object", properties: { profile: { type: "string", description: "package: soic | qfp | qfn | dip | sot | bga" }, pins: { type: "number" }, mpn: { type: "string", description: "manufacturer part number, e.g. ATmega328P-AU" }, names: { type: "object", description: 'pin map { "1": "PD3", "4": "VCC", "7": "PB6_XTAL1", ... } — pin number → function name' } }, required: ["names"] }, expose: { type: "array", items: { type: "string" }, description: 'function names to expose as block terminals, e.g. ["VCC","GND","PD0_RXD","PC6_RESET"]' } }, required: ["block", "chip"] } },
  { name: "author_schematic", description: "Build a custom block's INTERNAL SCHEMATIC as a real functional subcircuit: SEVERAL parts wired together, exposing only the pins the rest of the design connects to. This is how a block should be built — an oscillator block = crystal + 2 load caps; a power-supply block = regulator + input/output caps + diode; an MCU block = the chip + its decoupling caps + reset network. Do NOT make one block per component (a block holding a single cap is wrong). Pass all the parts and the nets that join them in one call. Endpoints are 'ref.pin'; for a chip part you can use the function name ('U1.VCC'). A net with `expose` becomes a block terminal of that name; nets without `expose` are internal nodes.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" }, parts: { type: "array", description: "the components in this block", items: { type: "object", properties: { ref: { type: "string", description: "reference designator, e.g. C1, R3, Y1, U1" }, type: { type: "string", description: "symbol type for a discrete: capacitor | cap-pol | resistor | inductor | ferrite | crystal | fuse | diode | schottky | zener | tvs | led | npn | pnp | nmos | pmos | regulator | battery | isource | thermistor | varistor — OR omit and give chip{} for an IC" }, value: { type: "string", description: "SHORT part value ONLY — '22pF', '10k', 'SMBJ18A', '16MHz' (≤12 chars). NEVER a description or spec sentence ('logic-level N-FET, 30V…' belongs nowhere on the drawing — long text overwhelms the schematic; ratings/justification go in the chat reply instead)" }, mpn: { type: "string", description: "manufacturer part number (optional)" }, chip: { type: "object", description: "for an IC part: its package + full pinout", properties: { profile: { type: "string", description: "soic | qfp | qfn | dip | sot" }, pins: { type: "number" }, mpn: { type: "string" }, names: { type: "object", description: 'pin map { "1":"PD3", "4":"VCC", ... }' } } } }, required: ["ref"] } }, nets: { type: "array", description: "the nets joining the parts; expose the ones the design connects to", items: { type: "object", properties: { connect: { type: "array", items: { type: "string" }, description: "endpoints 'ref.pin' (chip pins may use function names, e.g. 'U1.XTAL1')" }, expose: { type: "string", description: "if set, this net becomes a block terminal of this name" }, role: { type: "string", enum: ["in", "out"], description: "override the exposed terminal's role (else inferred)" }, type: { type: "string", enum: ["power", "rail", "signal", "gnd"], description: "override the exposed terminal's type (else inferred)" } }, required: ["connect"] } } }, required: ["block", "parts"] } },
  { name: "expose_pins", description: "Break out MORE of an already-authored chip's pins as block terminals, in bulk — e.g. expose D0–D13 and A0–A7 as a header in one call. Pass the chip function names. Unlike re-running author_block, this only ADDS terminals (it never renames existing ones or orphans wires), so it's the safe way to grow a block's exposed interface.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" }, pins: { type: "array", items: { type: "string" }, description: 'chip function names to expose, e.g. ["PD0","PD1","PD2","PC0","PC1","PB5"]' }, ref: { type: "string", description: "chip reference designator if the block has more than one (optional)" } }, required: ["block", "pins"] } },
  { name: "set_value", description: "Change one part's value inside a block you authored (e.g. C1 to 22pF, R3 to 10k) without re-authoring the whole block. Values are first-class — get_block and the BOM reflect them.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" }, ref: { type: "string", description: "the part's reference designator, e.g. C1, R3, Y1" }, value: { type: "string", description: "the new value, e.g. 22pF, 10k, 16MHz" } }, required: ["block", "ref", "value"] } },
  { name: "delete_block", description: "Delete a custom block you created (also removes any placed instances). Library blocks can't be deleted.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" } }, required: ["block"] } },
  { name: "list_instances", description: "List the blocks already placed in the current design.", input_schema: { type: "object", properties: {} } },
  { name: "add_block", description: "Place a block instance. Returns the new ref + its terminals.", input_schema: { type: "object", properties: { block: { type: "string", description: "exact block key (id@version) from list_blocks" }, ref: { type: "string", description: "optional instance ref; auto-generated if omitted" } }, required: ["block"] } },
  { name: "remove_block", description: "Remove a placed block (and its connections).", input_schema: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] } },
  { name: "connect", description: "Wire two terminals together (e.g. PWR1.vout ↔ REG1.vin). An endpoint may be REF.terminal, a connector pin (J1.D+), or an existing net name (e.g. GND, VCC) — a net name is resolved to a member of that net, so you can wire straight onto a net without naming a specific terminal on it.", input_schema: { type: "object", properties: { from: { type: "string", description: "REF.terminal, a connector pin (J1.VBUS), or a net name like GND" }, to: { type: "string", description: "REF.terminal, a connector pin (J1.VBUS), or a net name like GND" } }, required: ["from", "to"] } },
  { name: "electrace_help", description: "Get the current Electrace feature reference + recent changelog — what the app can do, how features work, and what's new. Call this to answer 'how do I…?', 'can Electrace…?', or 'what changed?' about the APP itself (not the user's circuit), so you answer from fact instead of guessing.", input_schema: { type: "object", properties: {} } },
  { name: "delegate", description: "Fan out a LARGE build to parallel 'sparks' (focused sub-agents). Use ONLY for big jobs with several independent blocks/subsystems (a multi-channel controller, a full board port). Pass one focused, self-contained task per block to author — the sparks build them in parallel, each in its own cheap context. Then YOU place (add_block), wire (connect), and analyze. For a small job (a couple of blocks), build it yourself instead — don't delegate.", input_schema: { type: "object", properties: { tasks: { type: "array", items: { type: "string" }, description: "one focused build instruction per block — name the block, list its parts, and which pins to expose. e.g. ['Author a DRV8323 gate-driver block: the DRV8323 chip + charge-pump cap, flying cap, VGLS/DVDD bypass, VM bulk, nFAULT pull-up; expose VM, GND, INHA/INLA/INHB/INLB/INHC/INLC, GHA/GLA/SHA/…, SOA/SOB/SOC, nFAULT', 'Author a 3-phase power stage block: 6 N-MOSFETs (3 half-bridges) + per-gate resistors + 3 low-side shunts + DC-bus bulk caps; expose VM, PGND, GHx/GLx/SHx, PHA/PHB/PHC, SPx/SNx']" } }, required: ["tasks"] } },
  { name: "list_connectors", description: "List the physical connectors you can place on the board (USB, headers, barrel jack, screw terminals, RJ45…), with their pins. Connectors are the board-edge home for off-board nets — e.g. a USB jack for the data lines.", input_schema: { type: "object", properties: {} } },
  { name: "add_connector", description: "Place a physical connector on the board (e.g. usb-mini-b for the Nano's USB, barrel for DC power). Then wire block terminals to its pins with connect (FT232.USBDP ↔ J1.D+). Use this so board I/O (USB data, power input) lands on a real connector instead of dangling as exposed terminals.", input_schema: { type: "object", properties: { connector: { type: "string", description: "connector id from list_connectors, e.g. usb-mini-b, usb-c, barrel, hdr-2x5" }, ref: { type: "string", description: "reference designator, e.g. J1 (optional)" } }, required: ["connector"] } },
  { name: "disconnect", description: "Remove a wire between two terminals.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } },
  { name: "analyze_design", description: "Run the deterministic checks on the current design — returns all findings (errors, warnings, and notes like 'block has no part yet').", input_schema: { type: "object", properties: {} } },
  { name: "list_connections", description: "The RAW wire list — every connection as endpoint↔endpoint, INCLUDING wires whose endpoints no longer exist (marked INVALID). Use when the net graph and your expectations disagree: this is the canonical 'what wires actually exist' view.", input_schema: { type: "object", properties: {} } },
  { name: "remove_invalid_wires", description: "Delete every connection that references a missing instance or terminal (stale wires after a block was re-authored or a terminal renamed). Lists what was removed. Prefer reviewing list_connections first if you might want to RECONNECT instead of drop.", input_schema: { type: "object", properties: {} } },
  { name: "list_nets", description: "List the actual derived net graph — each net's type, voltage, drivers (outputs) and loads (inputs). Read this instead of guessing connectivity.", input_schema: { type: "object", properties: {} } },
  { name: "power_budget", description: "Per-rail current/power budget: each power/rail net's total load draw vs the source's capacity, headroom, %-used (flags over-budget), and watts. The load math — read this to reason about whether a regulator/source can actually supply its rail, not just whether it's wired.", input_schema: { type: "object", properties: {} } },
  { name: "acknowledge", description: "Mark a specific finding as INTENDED so it's muted and stops counting as a warning/error — for a correct-but-noisy check, e.g. an intentional diode-OR where two sources (USB 5V + regulator) legitimately share a rail. Use the rule + at from analyze_design. Only acknowledge findings that are genuinely correct; never silence a real problem. Always note WHY.", input_schema: { type: "object", properties: { rule: { type: "string", description: "the finding's rule, e.g. connectivity/multiple-drivers" }, at: { type: "array", items: { type: "string" }, description: "the finding's subjects (net ids/refs), e.g. [\"VCC\"]" }, note: { type: "string", description: "why it's intended (shown to the user)" } }, required: ["rule", "at"] } },
  { name: "unacknowledge", description: "Remove an acknowledgement so the finding is flagged again.", input_schema: { type: "object", properties: { rule: { type: "string" }, at: { type: "array", items: { type: "string" } } }, required: ["rule", "at"] } },
  { name: "set_net_label", description: "Set (or clear) a design-level net label on a block terminal. Every terminal carrying the same label name is ONE net — the standard named-rail mechanism (+5V, GND, SDA) that replaces long power wires. The label also names the net everywhere (checks, netlist, exports). Pass an empty/omitted name to remove.", input_schema: { type: "object", properties: { node: { type: "string", description: 'terminal as "REF.terminal", e.g. MCU1.vdd' }, name: { type: "string", description: "label name (+5V, GND, SDA…); empty removes" } }, required: ["node"] } },
  { name: "set_isolation", description: "Declare that two blocks must share NO conductive path (galvanic isolation) — or remove such a requirement. Verified immediately and re-verified on every change; a violation names the bridging net (the classic bug: a carelessly shared ground). Use it right after placing an isolating part (optocoupler, transformer, digital isolator) so the barrier becomes a standing guarantee instead of a hope. b may be \"*\" to isolate a from every other block.", input_schema: { type: "object", properties: { a: { type: "string", description: "block ref, e.g. OPTO1" }, b: { type: "string", description: 'block ref, or "*" for all others' }, note: { type: "string", description: "why this barrier exists (optional, shown to the user)" }, remove: { type: "boolean", description: "true to remove the requirement instead of adding it" } }, required: ["a", "b"] } },
  { name: "set_signal_class", description: `Declare what a net IS so the checker enforces what that requires: termination present (it looks for the actual resistor bridging the pair), rise time achievable (I2C: computed from pull-ups + bus capacitance, with the fix in the message), and on the PCB, trace length + pair matching vs the class's edge rate. Classes: ${Object.values(NET_CLASSES).map((c) => `${c.id} (${c.name})`).join(", ")}. Pass cls "none" to clear. Pair classes (rs485, can, usb-fs) need pairPin — the other side of the pair.`, input_schema: { type: "object", properties: { pin: { type: "string", description: 'a pin on the net — "REF.terminal" (e.g. U1.canh) or a connector pin (J1.D+)' }, cls: { type: "string", enum: [...Object.keys(NET_CLASSES), "none"] }, pairPin: { type: "string", description: "the pair's other side (B / CANL / D−) — required for pair classes" }, pullupOhms: { type: "number", description: "I2C: the actual pull-up value (default 4700)" }, busCapPf: { type: "number", description: "I2C: bus capacitance override (default 20 + 10 per device)" }, terminated_externally: { type: "boolean", description: "termination lives off-board — silences the on-board check" } }, required: ["pin", "cls"] } },
  { name: "declare_connector_pins", description: "Declare what the outside world presents (or draws) at a placed connector's pins — name, net type, direction, voltage, current. A declared pin becomes a real terminal at the board edge: it types and names the net (VBUS), feeds every check (12 V arriving on a header pin vs a 5 V-max input fires over-voltage; declared off-board loads count in the power budget; a hot wire into a gnd pin flags as a short), and the family's per-contact current rating is enforced. USB receptacles, the LiPo JST, and barrel jacks arrive pre-declared — only declare what differs (e.g. the actual wall-wart voltage on a barrel jack). ALWAYS declare what arrives at a power-entry connector; without it the engine is blind at the board edge.", input_schema: { type: "object", properties: { ref: { type: "string", description: "placed connector ref, e.g. J1" }, pins: { type: "object", description: 'pin id → declaration, e.g. {"+": {name: "VIN", type: "power", direction: "feeds_board", v_max: 12, i_max: 2}, "-": {name: "GND", type: "gnd"}}', additionalProperties: { type: "object", properties: { name: { type: "string", description: "net-meaningful name, e.g. VBAT, SDA" }, type: { type: "string", enum: ["power", "rail", "gnd", "signal"] }, direction: { type: "string", enum: ["feeds_board", "board_feeds"], description: "feeds_board = arrives from off-board (a supply); board_feeds = the board drives what's plugged in (a load)" }, v_max: { type: "number", description: "volts (worst case)" }, i_max: { type: "number", description: "amps (source capability or load draw)" }, clear: { type: "boolean", description: "true to drop this pin's per-instance declaration (built-in defaults remain)" } } } } }, required: ["ref", "pins"] } },
  { name: "standby_draw", description: "The off-state / standby draw floor: what the design pulls from its sources when everything that CAN sleep is asleep. Dividers, pull-ups, and diode leakage never sleep (solved); declared iStandby covers sleep draws; undeclared sleepers are flagged as assumed-0. Includes battery-life math when the source declares a capacity spec. Honest scope: logic-state-dependent draws and charging circuits are excluded — this is the MINIMUM the design can never beat.", input_schema: { type: "object", properties: {} } },
  { name: "thevenin", description: "Thévenin equivalent seen from any node: Vth (open-circuit voltage), Rth (output impedance), Isc, the Norton dual, and the max-power-transfer figure. Two solver runs — use it to answer \"how stiff is this rail\", \"what load can this divider drive\", or \"what does the circuit look like from this connector pin\". Linear elements only (conducting diodes at their fixed drop).", input_schema: { type: "object", properties: { pin: { type: "string", description: 'a pin on the node — "REF.terminal", connector pin (J1.VBUS), or net name' } }, required: ["pin"] } },
  { name: "solve_dc", description: "Compute the DC operating point — Modified Nodal Analysis over the flattened design. Returns REAL node voltages and per-resistor current/dissipation (not worst-case bounds): the tool for \"what voltage is actually at this node\" and \"how hot does this resistor run\". Honest scope: linear elements only — semiconductors/ICs are left open (bias networks around them solve correctly) and the result says what was skipped. Run after wiring changes; cheap.", input_schema: { type: "object", properties: {} } },
  { name: "stress_test", description: "What-if: would the design survive X volts at its input? Checks that voltage against every declared limit sitting on an input-tracking rail (a rail whose source declares a range — it follows the external input; regulated rails are rightly excluded) plus each block's authored limits, sorted tightest-first. Use it to answer \"can I run this from a 24 V brick?\" with arithmetic instead of vibes.", input_schema: { type: "object", properties: { volts: { type: "number", description: "the input voltage to test" } }, required: ["volts"] } },
];

export async function POST(req: Request) {
  const key = PROVIDER === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: `${PROVIDER === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} is not set — add it to web/.env.local and restart the dev server.` }, { status: 500 });

  // Sparky is a paid (Pro) feature, and every call costs real Claude API spend — enforce the gate
  // HERE so it can't be bypassed by hitting the endpoint directly (a hidden UI button isn't enough).
  let meterCtx: { sb: Awaited<ReturnType<typeof supabaseServer>>; userId: string } | null = null;
  if (supabaseConfigured) {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return Response.json({ error: "Please sign in to use Sparky." }, { status: 401 });
    const allowlisted = canUseSparky(user.email); // interim allowlist (founder/dev — exempt from the budget gate)
    let pro = allowlisted;
    if (!pro) {
      // users.plan is what billing flips — a paying subscriber is pro regardless of the allowlist
      const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
      pro = data?.plan === "pro";
    }
    if (!pro) return Response.json({ error: "Sparky is a Pro feature — upgrade to let it build and explain your designs.", code: "upgrade" }, { status: 403 });
    meterCtx = { sb, userId: user.id };
    if (MONTHLY_BUDGET > 0 && !allowlisted) {
      // month-to-date spend (RLS scopes the query to this user; one row per run, so this stays tiny)
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { data: rows } = await sb.from("sparky_usage").select("cost_usd").gte("created_at", monthStart.toISOString());
      const spent = (rows ?? []).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
      if (spent >= MONTHLY_BUDGET) {
        return Response.json({
          error: "You've used this month's included Sparky capacity — it resets on the 1st. Your designs and checks are unaffected.",
          code: "capacity",
        }, { status: 429 });
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail CLOSED: never serve a paid endpoint unauthenticated in production. If we get here in prod the
    // Supabase env vars are missing/misconfigured — deny rather than leave the cost wide open. (Local dev
    // without a backend still works: NODE_ENV !== "production" there.)
    return Response.json({ error: "Sparky is temporarily unavailable." }, { status: 503 });
  }

  // bound the payload before parsing — an oversized design would otherwise be parsed, deep-cloned,
  // and analyzed before anything pushes back (and would blow the model's context anyway)
  if (Number(req.headers.get("content-length") ?? 0) > 4_000_000) {
    return Response.json({ error: "This design is too large for Sparky to load." }, { status: 413 });
  }
  let body: Payload;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const message = (body.message ?? "").trim();
  if (!message && !Array.isArray(body.summarize)) return Response.json({ error: "Empty message" }, { status: 400 });

  const agentic = !!body.design && !!body.blocks;
  const design: Design | undefined = agentic ? JSON.parse(JSON.stringify(body.design)) : undefined;
  const blocks = body.blocks ?? {};

  const ctx = (body.context ?? []).filter((c) => c?.text).map((c) => `### ${c.kind}\n${c.text}`).join("\n\n");
  // Prompt-cache hygiene: keep SYSTEM (and the big tools array) the ONLY thing before the messages, so the
  // expensive ~10k system+tools prefix stays cached even as the design changes. The workspace context is
  // volatile (it changes on every canvas edit) — if it sat in `system` ahead of the tools, every edit would
  // invalidate the whole prefix and force a full re-write. Instead it rides in the latest user message, so
  // only the (small) message tail is re-written per turn while system+tools are read at ~10% cost.
  const system = [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }];
  const userContent = ctx ? `<workspace-context>\n${ctx}\n</workspace-context>\n\n${message}` : message;
  const messages: { role: string; content: unknown }[] = [
    ...(body.summary ? [{ role: "user", content: `<conversation-summary>\nEarlier in this conversation (compacted):\n${String(body.summary).slice(0, 6000)}\n</conversation-summary>` }] : []),
    ...(body.history ?? []).filter((m) => m?.text).map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: userContent },
  ];

  // Prompt caching: the tools array is large and identical on every one of the (up to MAX_TURNS) agentic
  // calls — mark the last tool so the whole array caches (read at ~10% cost after the first call). The
  // SYSTEM block is already cached above.
  const baseTools = agentic ? TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t)) : [];
  // A rolling cache breakpoint on the tail of the conversation: each loop step the prior messages
  // (assistant tool_use + tool_results, which accumulate) are read from cache instead of re-charged.
  const cacheTail = (msgs: { role: string; content: unknown }[]) => {
    if (!msgs.length) return msgs;
    const last = msgs[msgs.length - 1];
    const c = last.content;
    let content: unknown = c;
    if (typeof c === "string") content = [{ type: "text", text: c, cache_control: { type: "ephemeral" } }];
    else if (Array.isArray(c) && c.length) { const arr = c as object[]; content = arr.map((b, i) => (i === arr.length - 1 ? { ...b, cache_control: { type: "ephemeral" } } : b)); }
    return [...msgs.slice(0, -1), { ...last, content }];
  };
  // One model call (used by both Sparky and the sparks). Web search is offered; if the host rejects it,
  // retry without it. cacheTail caches the conversation prefix.
  const headers = { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
  const anthropic = async (sys: unknown[], msgs: { role: string; content: unknown }[], tools: unknown[], maxTokens = 4096, modelOverride = "") => {
    const send = (ts: unknown[]) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers, signal: req.signal, // abort the in-flight model call if the client disconnects
      body: JSON.stringify({ model: modelOverride || MODEL, max_tokens: maxTokens, system: sys, messages: cacheTail(msgs), ...(ts.length ? { tools: ts } : {}) }),
    });
    let r = await send([WEB_SEARCH, ...tools]);
    if (r.status === 400) {
      const t = await r.text();
      if (/web.?search|tool/i.test(t)) r = await send(tools);
      else if (QUOTA_RE.test(t)) throw new QuotaError();
      else throw new Error(`Model error 400: ${t.slice(0, 300)}`);
    }
    if (!r.ok) {
      const t = (await r.text().catch(() => "")).slice(0, 300);
      if (r.status === 429 || QUOTA_RE.test(t)) throw new QuotaError();
      throw new Error(`Model error ${r.status}: ${t}`);
    }
    return r.json();
  };

  // ── OpenAI path (A/B experiment) ──────────────────────────────────────────────────────────────
  // Translate our Anthropic-shaped request (system blocks + messages with tool_use/tool_result content)
  // to OpenAI Chat Completions, then normalize the response BACK into Anthropic's content-block shape so
  // the entire agentic loop / sparks / streaming downstream work unchanged. No prompt-cache control and
  // no web search on this path (both are Anthropic-specific) — fine for comparing the build workflows.
  type Block = { type: string; text?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; content?: unknown };
  const oaiTools = (tools: unknown[]) =>
    (tools as { name: string; description?: string; input_schema?: unknown }[])
      .filter((t) => t.name) // drop the hosted web_search tool (no `name` in our schema sense / unsupported)
      .map((t) => ({ type: "function", function: { name: t.name, description: t.description ?? "", parameters: t.input_schema ?? { type: "object", properties: {} } } }));
  const oaiMessages = (sys: unknown[], msgs: { role: string; content: unknown }[]) => {
    const out: Record<string, unknown>[] = [{ role: "system", content: (sys as Block[]).map((s) => s.text ?? "").join("\n\n") }];
    for (const m of msgs) {
      const c = m.content;
      if (m.role === "assistant") {
        const blocks: Block[] = Array.isArray(c) ? (c as Block[]) : [{ type: "text", text: String(c) }];
        const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
        const calls = blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id!, type: "function", function: { name: b.name!, arguments: JSON.stringify(b.input ?? {}) } }));
        out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      } else if (typeof c === "string") {
        out.push({ role: "user", content: c });
      } else {
        const blocks: Block[] = Array.isArray(c) ? (c as Block[]) : [];
        const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
        if (text) out.push({ role: "user", content: text });
        for (const tr of blocks.filter((b) => b.type === "tool_result")) {
          out.push({ role: "tool", tool_call_id: tr.tool_use_id!, content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content) });
        }
      }
    }
    return out;
  };
  const openai = async (sys: unknown[], msgs: { role: string; content: unknown }[], tools: unknown[], maxTokens = 4096, modelOverride = "") => {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: req.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelOverride || OPENAI_MODEL,
        max_completion_tokens: Math.max(maxTokens, 16000), // headroom for reasoning tokens on gpt-5.x
        messages: oaiMessages(sys, msgs),
        ...(tools.length ? { tools: oaiTools(tools), tool_choice: "auto" } : {}),
      }),
    });
    if (!r.ok) {
      const t = (await r.text().catch(() => "")).slice(0, 300);
      if (r.status === 429 || QUOTA_RE.test(t)) throw new QuotaError();
      throw new Error(`OpenAI error ${r.status}: ${t}`);
    }
    const data = await r.json();
    const m = data.choices?.[0]?.message ?? {};
    const content: Block[] = [];
    if (m.content) content.push({ type: "text", text: String(m.content) });
    for (const tc of (m.tool_calls ?? []) as { id: string; function: { name: string; arguments: string } }[]) {
      let input: unknown = {};
      try { input = JSON.parse(tc.function.arguments || "{}"); } catch { /* leave {} */ }
      content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
    }
    const u = data.usage ?? {};
    // Normalize into the Anthropic shape the loop expects.
    return {
      content,
      stop_reason: (m.tool_calls?.length ? "tool_use" : "end_turn"),
      usage: { input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0, cache_read_input_tokens: u.prompt_tokens_details?.cached_tokens ?? 0, cache_creation_input_tokens: 0 },
    };
  };

  // The active model caller — same signature + return shape either way.
  const callModelRaw = PROVIDER === "openai" ? openai : anthropic;
  // Request-scoped meter: every model call in this run (main loop, sparks, warmers) flows through
  // here, so the recorded row is the TRUE total — not just the main loop's share.
  const meter = { full: 0, cached: 0, write: 0, out: 0 };
  const callModel: typeof callModelRaw = async (...args) => {
    const data = await callModelRaw(...args);
    const u = (data?.usage ?? {}) as Record<string, number>;
    meter.full += u.input_tokens ?? 0;
    meter.cached += u.cache_read_input_tokens ?? 0;
    meter.write += u.cache_creation_input_tokens ?? 0;
    meter.out += u.output_tokens ?? 0;
    return data;
  };
  const recordUsage = async () => {
    if (!meterCtx || (meter.full + meter.cached + meter.write + meter.out) === 0) return;
    const modelId = PROVIDER === "openai" ? OPENAI_MODEL : MODEL;
    const card = PRICE_CARDS[modelId] ?? FALLBACK_CARD;
    const cost = (meter.full * card.inp + meter.cached * card.cached + meter.write * card.write + meter.out * card.out) / 1_000_000;
    try {
      await meterCtx.sb.from("sparky_usage").insert({
        owner_id: meterCtx.userId, model: modelId,
        in_full: meter.full, in_cached: meter.cached, in_write: meter.write, out_tokens: meter.out,
        cost_usd: cost.toFixed(6),
      });
    } catch { /* metering must never break the reply; table may predate migration 0004 */ }
  };

  const eff: Effects = { upserts: new Map(), deleted: new Set(), schematics: new Map() };

  // Compaction mode: fold older conversation turns into a rolling summary (the client persists it
  // per conversation and replays it via body.summary). One small call, no tools, no streaming —
  // sits behind the same auth/pro/budget gates and the same meter as everything else.
  if (Array.isArray(body.summarize)) {
    const turns = body.summarize.filter((m) => m?.text).slice(-60)
      .map((m) => `${m.role === "user" ? "User" : "Sparky"}: ${String(m.text).slice(0, 2000)}`).join("\n");
    const sys = [{ type: "text", text: "You compact chat history for an EE design assistant. Merge the existing summary (if any) with the new turns into ONE summary under 200 words. Keep: what the user is building, decisions made, named blocks/refs/nets, values chosen, open questions. Drop pleasantries and play-by-play. Output only the summary text." }];
    const prior = (body.existingSummary ?? "").toString().slice(0, 4000);
    try {
      const data = await callModel(sys, [{ role: "user", content: `${prior ? `Existing summary:\n${prior}\n\n` : ""}New turns:\n${turns}` }], [], 600, SPARK_MODEL);
      const text = (Array.isArray(data.content) ? data.content : []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
      await recordUsage();
      return Response.json({ summary: text.slice(0, 6000) });
    } catch (e) {
      await recordUsage();
      return Response.json({ error: e instanceof QuotaError ? "capacity" : "could not compact" }, { status: 503 });
    }
  }

  // A spark: a focused sub-agent that builds ONE block in its own small context, mutating the SHARED
  // design/blocks/eff (parallel-safe — tool execution is synchronous; sparks author distinct blocks).
  const sparkBase = TOOLS.filter((t) => SPARK_TOOL_NAMES.has(t.name));
  const sparkTools = sparkBase.map((t, i) => (i === sparkBase.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t));
  const sparkSys = [{ type: "text", text: SPARK_SYSTEM, cache_control: { type: "ephemeral" } }];
  const runSpark = async (goal: string, onTool?: (name: string) => void): Promise<{ summary: string; changed: boolean }> => {
    const msgs: { role: string; content: unknown }[] = [{ role: "user", content: goal }];
    let changed = false;
    for (let t = 0; t < SPARK_MAX_TURNS; t++) {
      const data = await callModel(sparkSys, msgs, sparkTools, 4096, SPARK_MODEL);
      const su = data.usage ?? {};
      console.log(`[spark] turn ${t}: in=${su.input_tokens ?? 0} cache_read=${su.cache_read_input_tokens ?? 0} cache_write=${su.cache_creation_input_tokens ?? 0} out=${su.output_tokens ?? 0}`);
      const content = Array.isArray(data.content) ? data.content : [];
      msgs.push({ role: "assistant", content: data.content });
      const toolUses = content.filter((b: { type: string }) => b.type === "tool_use");
      if (data.stop_reason !== "tool_use" || !toolUses.length) {
        const text = content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
        return { summary: text || "(built; no summary)", changed };
      }
      const results = (toolUses as { id: string; name: string; input: Record<string, unknown> }[]).map((u) => {
        const out = runTool(u.name, u.input ?? {}, design!, blocks, eff);
        changed = changed || out.changed; onTool?.(u.name);
        return { type: "tool_result", tool_use_id: u.id, content: out.text };
      });
      msgs.push({ role: "user", content: results });
    }
    return { summary: "(spark hit its step limit)", changed };
  };

  // Warm the shared spark prefix (SPARK_SYSTEM + spark tools, ~2.3k tokens) with ONE tiny call before
  // fanning out. The sparks run via Promise.all, so without this they all fire at once, each MISSES the
  // not-yet-written cache, and each re-creates the prefix (N writes at 1.25x). After one warming write,
  // every spark READS the prefix at ~10% cost. Non-fatal if it fails — sparks just pay the cold path.
  let sparkCacheWarmed = false;
  const warmSparkCache = async () => {
    if (sparkCacheWarmed || PROVIDER !== "anthropic") return; // manual cache warming is Anthropic-only
    sparkCacheWarmed = true;
    try {
      const data = await anthropic(sparkSys, [{ role: "user", content: "ready" }], sparkTools, 4);
      const u = data.usage ?? {};
      console.log(`[sparky] warm sparks: cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`);
    } catch { sparkCacheWarmed = false; }
  };

  const donePayload = (reply: string, changed: boolean) => ({
    type: "done", reply,
    ...(changed && design ? { design } : {}),
    ...(eff.upserts.size ? { blocks: [...eff.upserts.values()] } : {}),
    ...(eff.deleted.size ? { deletedBlocks: [...eff.deleted] } : {}),
    ...(eff.schematics.size ? { blockSchematics: [...eff.schematics].map(([key, layout]) => ({ id: key.split("@")[0], layout })) } : {}),
  });

  // Stream progress as NDJSON so the user sees Sparky working (its narration, the tool it's running, and
  // running token usage) instead of a chat indicator that looks like it's hung. Final line is the result.
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (o: object) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* closed */ } };
      let changed = false, totalIn = 0, totalOut = 0, finished = false;
      try {
        for (let turn = 0; turn < (agentic ? MAX_TURNS : 1); turn++) {
          if (req.signal.aborted) return; // client disconnected — stop the loop (and stop billing model calls)
          emit({ type: "status", text: turn === 0 ? "Thinking…" : "Working…" });
          const data = await callModel(system, messages, baseTools);
          const u = data.usage ?? {};
          totalIn += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
          totalOut += u.output_tokens ?? 0;
          console.log(`[sparky] turn ${turn}: in=${u.input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens ?? 0}`);
          emit({ type: "usage", in: totalIn, out: totalOut, cacheRead: u.cache_read_input_tokens ?? 0 });
          const content = Array.isArray(data.content) ? data.content : [];
          const narr = content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
          messages.push({ role: "assistant", content: data.content });
          const toolUses = content.filter((b: { type: string }) => b.type === "tool_use");
          if (!agentic || data.stop_reason !== "tool_use" || !toolUses.length) {
            emit(donePayload(narr || "(done)", changed)); finished = true; break;
          }
          if (narr) emit({ type: "narration", text: narr });
          for (const tu of toolUses as { name: string }[]) emit({ type: "tool", name: tu.name });
          const results: { type: string; tool_use_id: string; content: string }[] = [];
          for (const u of toolUses as { id: string; name: string; input: Record<string, unknown> }[]) {
            if (u.name === "delegate") {
              const tasks = Array.isArray(u.input?.tasks) ? (u.input.tasks as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];
              if (!tasks.length) { results.push({ type: "tool_result", tool_use_id: u.id, content: "delegate needs tasks[] — one focused build instruction per block." }); continue; }
              emit({ type: "status", text: `⚡ Dispatching ${tasks.length} spark${tasks.length > 1 ? "s" : ""}…` });
              if (tasks.length > 1) await warmSparkCache(); // one cache write, then the parallel sparks all read it
              const outs = await Promise.all(tasks.map((task, i) => runSpark(task, (tool) => emit({ type: "status", text: `⚡ Spark ${i + 1}/${tasks.length} · ${tool}` }))));
              outs.forEach((s) => { changed = changed || s.changed; });
              const text = outs.map((s, i) => `Spark ${i + 1} — ${s.summary}`).join("\n\n");
              results.push({ type: "tool_result", tool_use_id: u.id, content: text });
              emit({ type: "status", text: "Reviewing the sparks' work…" });
            } else {
              const out = runTool(u.name, u.input ?? {}, design!, blocks, eff);
              changed = changed || out.changed;
              results.push({ type: "tool_result", tool_use_id: u.id, content: out.text });
            }
          }
          messages.push({ role: "user", content: results });
        }
        if (!finished) emit(donePayload("I made some changes but hit the step limit — ask me to continue if it's not finished.", changed));
      } catch (e) {
        if (!req.signal.aborted) {
          console.error("[sparky] error:", e);
          const quota = e instanceof QuotaError;
          emit({ type: "error", error: quota
            ? "Sparky is temporarily unavailable — we've hit our AI capacity for the moment (it happens during development). Your design is untouched; try again a bit later."
            : "Could not reach the model." }); // detail logged server-side, not sent to the client
        }
      } finally {
        await recordUsage(); // tokens were spent even on error/abort — always record before closing
      }
      try { controller.close(); } catch { /* already closed by the consumer */ }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform" } });
}
