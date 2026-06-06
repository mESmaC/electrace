// Server-only proxy to the Claude Messages API. The API key lives in env (web/.env.local) and
// never reaches the browser. When the client sends a `design` + `blocks`, the assistant becomes
// agentic: it can call tools that mutate a COPY of the design (add/connect/remove blocks, check it)
// and we return the new design for the client to apply. Without a design, it's informative only.
import { analyze, type Design, type Block } from "@electrace/core";
import type { ChatMessage, ContextItem } from "@/lib/assistant";

const MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-4-6";
const MAX_TURNS = 12;

const SYSTEM = `You are the Electrace assistant, embedded in a transparent, block-based EE IDE
(schematic + PCB design). Help the user reason about and BUILD their design.

When the user asks you to change the design (add a block, wire something, etc.), use the tools to
do it — don't just describe it. Add blocks, then connect their terminals (power→power, gnd→gnd,
out→in). Call analyze_design to check your work. Keep going until the request is done, then give a
short summary of what you did. When the user is just asking a question, answer concisely from the
provided Workspace context and general EE knowledge; don't change anything.

You also have a web_search tool — use it to look up real datasheets and pinouts when the user asks
about a specific part number (don't guess pin maps from memory; search, then cite the source).

Read the real state instead of guessing: call list_nets to see the actual net graph and
analyze_design to read all findings — including notes like "block has no part yet". If a block you
created is an empty interface shell, populate it (or tell the user the real part it stands for) so it
reaches the BOM; don't leave the design as hollow boxes.

Rules: only connect terminals that exist (use the terminals returned by list_blocks/add_block).
Don't invent block keys — use the exact keys from list_blocks. Prefer minimal, correct changes.`;

// Anthropic-hosted web search (runs server-side; no infra needed). Dropped automatically if the
// account/model rejects it, so the assistant keeps working either way.
const WEB_SEARCH = { type: "web_search_20250305", name: "web_search", max_uses: 6 };

interface Payload { context?: ContextItem[]; history?: Pick<ChatMessage, "role" | "text">[]; message?: string; design?: Design; blocks?: Record<string, Block> }

// ── design tool implementations (pure transforms on a design copy) ──────────
const refPrefix = (b?: Block) => ((b?.name ?? "B").split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "B");
function freshRef(design: Design, b?: Block) { const p = refPrefix(b); let i = 1; while (design.blocks.some((x) => x.ref === `${p}${i}`)) i++; return `${p}${i}`; }
const termList = (b?: Block) => (b?.terminals ?? []).map((t) => `${t.id} (${t.role}, ${t.type})`).join(", ");
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

interface Effects { upserts: Map<string, Block>; deleted: Set<string> }
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
    case "delete_block": {
      const key = String(input.block ?? ""), b = blocks[key], err = userOnly(key, b);
      if (err) return { text: err, changed: false };
      delete blocks[key]; eff.deleted.add(key); eff.upserts.delete(key);
      const hadInst = design.blocks.some((x) => x.block === key);
      design.blocks = design.blocks.filter((x) => x.block !== key);
      const refs = new Set(design.blocks.map((x) => x.ref));
      design.connections = design.connections.filter((c) => refs.has(c.from.split(".")[0]) && refs.has(c.to.split(".")[0]));
      return { text: `Deleted block ${b!.name} (${key})${hadInst ? " and its placed instances" : ""}.`, changed: hadInst };
    }
    case "list_blocks":
      return { text: Object.entries(blocks).map(([k, b]) => `${k} — ${b.name}: [${termList(b)}]`).join("\n") || "(no blocks)", changed: false };
    case "list_instances":
      return { text: design.blocks.map((bi) => `${bi.ref} = ${bi.block} [${termList(blocks[bi.block])}]`).join("\n") || "(empty design)", changed: false };
    case "add_block": {
      const key = String(input.block ?? "");
      const b = blocks[key]; if (!b) return { text: `No such block "${key}". Call list_blocks for valid keys.`, changed: false };
      const ref = (typeof input.ref === "string" && input.ref.trim()) ? input.ref.trim() : freshRef(design, b);
      if (design.blocks.some((x) => x.ref === ref)) return { text: `Ref "${ref}" already exists.`, changed: false };
      const n = design.blocks.length;
      design.blocks.push({ ref, block: key, pos: [40 + (n % 4) * 260, 120 + Math.floor(n / 4) * 220] });
      return { text: `Added ${ref} (${b.name}). Terminals: ${termList(b)}.`, changed: true };
    }
    case "remove_block": {
      const ref = String(input.ref ?? "");
      if (!design.blocks.some((x) => x.ref === ref)) return { text: `No instance "${ref}".`, changed: false };
      design.blocks = design.blocks.filter((x) => x.ref !== ref);
      design.connections = design.connections.filter((c) => c.from.split(".")[0] !== ref && c.to.split(".")[0] !== ref);
      return { text: `Removed ${ref} and its connections.`, changed: true };
    }
    case "connect": {
      const from = String(input.from ?? ""), to = String(input.to ?? "");
      const valid = (e: string) => { const [r, t] = e.split("."); const bi = design.blocks.find((x) => x.ref === r); return !!bi && !!blocks[bi.block]?.terminals.some((x) => x.id === t); };
      if (!valid(from)) return { text: `Endpoint "${from}" doesn't exist (need REF.terminal).`, changed: false };
      if (!valid(to)) return { text: `Endpoint "${to}" doesn't exist (need REF.terminal).`, changed: false };
      if (design.connections.some((c) => (c.from === from && c.to === to) || (c.from === to && c.to === from))) return { text: `${from} ↔ ${to} already connected.`, changed: false };
      design.connections.push({ from, to });
      return { text: `Connected ${from} ↔ ${to}.`, changed: true };
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
        const n = (s: string) => a.findings.filter((f) => f.severity === s).length;
        const head = `${design.blocks.length} blocks, ${a.resolved.nets.length} nets — ${n("error")} errors, ${n("warn")} warnings, ${n("info") + n("recommendation")} notes.`;
        const order = { error: 0, warn: 1, recommendation: 2, info: 3 } as Record<string, number>;
        const body = [...a.findings].sort((x, y) => (order[x.severity] ?? 9) - (order[y.severity] ?? 9))
          .slice(0, 25).map((f) => `[${f.severity}] ${f.message}`).join("\n");
        return { text: body ? `${head}\n${body}` : `${head} All clear.`, changed: false };
      } catch (e) { return { text: `Analysis failed: ${String(e).slice(0, 160)}`, changed: false }; }
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
          return `${nt.id} (${nt.type}${vstr(nt.voltage)}): drivers=[${drv}] loads=[${load}]`;
        }).join("\n");
        return { text, changed: false };
      } catch (e) { return { text: `Could not derive nets: ${String(e).slice(0, 160)}`, changed: false }; }
    }
    default:
      return { text: `Unknown tool ${name}.`, changed: false };
  }
}

const TERMS_SCHEMA = { type: "array", description: "terminals (pins) of the block", items: { type: "object", properties: { id: { type: "string", description: "pin/terminal name, e.g. vin" }, role: { type: "string", enum: ["in", "out"] }, type: { type: "string", enum: ["power", "rail", "signal", "gnd"] } }, required: ["id", "role", "type"] } };
const TOOLS = [
  { name: "list_blocks", description: "List the block types available to place, with their terminals. Library blocks plus any you've created.", input_schema: { type: "object", properties: {} } },
  { name: "create_block", description: "Create a new custom (user) block with named terminals/pins. It appears in the palette and can be placed with add_block.", input_schema: { type: "object", properties: { name: { type: "string" }, glyph: { type: "string", description: "1–2 char icon (optional)" }, category: { type: "string", description: "optional, e.g. power/signal/custom" }, terminals: TERMS_SCHEMA }, required: ["name", "terminals"] } },
  { name: "update_block", description: "Edit a custom block you created — rename it, change its glyph/category, or relabel its terminals (pins). Library blocks can't be edited.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" }, name: { type: "string" }, glyph: { type: "string" }, category: { type: "string" }, terminals: TERMS_SCHEMA }, required: ["block"] } },
  { name: "delete_block", description: "Delete a custom block you created (also removes any placed instances). Library blocks can't be deleted.", input_schema: { type: "object", properties: { block: { type: "string", description: "block key (id@version)" } }, required: ["block"] } },
  { name: "list_instances", description: "List the blocks already placed in the current design.", input_schema: { type: "object", properties: {} } },
  { name: "add_block", description: "Place a block instance. Returns the new ref + its terminals.", input_schema: { type: "object", properties: { block: { type: "string", description: "exact block key (id@version) from list_blocks" }, ref: { type: "string", description: "optional instance ref; auto-generated if omitted" } }, required: ["block"] } },
  { name: "remove_block", description: "Remove a placed block (and its connections).", input_schema: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] } },
  { name: "connect", description: "Wire two terminals together (e.g. PWR1.vout ↔ REG1.vin).", input_schema: { type: "object", properties: { from: { type: "string", description: "REF.terminal" }, to: { type: "string", description: "REF.terminal" } }, required: ["from", "to"] } },
  { name: "disconnect", description: "Remove a wire between two terminals.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } },
  { name: "analyze_design", description: "Run the deterministic checks on the current design — returns all findings (errors, warnings, and notes like 'block has no part yet').", input_schema: { type: "object", properties: {} } },
  { name: "list_nets", description: "List the actual derived net graph — each net's type, voltage, drivers (outputs) and loads (inputs). Read this instead of guessing connectivity.", input_schema: { type: "object", properties: {} } },
];

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "ANTHROPIC_API_KEY is not set — add it to web/.env.local and restart the dev server." }, { status: 500 });

  let body: Payload;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "Empty message" }, { status: 400 });

  const agentic = !!body.design && !!body.blocks;
  const design: Design | undefined = agentic ? JSON.parse(JSON.stringify(body.design)) : undefined;
  const blocks = body.blocks ?? {};

  const ctx = (body.context ?? []).filter((c) => c?.text).map((c) => `### ${c.kind}\n${c.text}`).join("\n\n");
  const system = [
    { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ...(ctx ? [{ type: "text", text: `Workspace context:\n\n${ctx}` }] : []),
  ];
  const messages: { role: string; content: unknown }[] = [
    ...(body.history ?? []).filter((m) => m?.text).map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: message },
  ];

  const baseTools = agentic ? TOOLS : [];
  const post = (tools: unknown[]) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages, ...(tools.length ? { tools } : {}) }),
  });
  const call = async () => {
    let r = await post([WEB_SEARCH, ...baseTools]);
    if (r.status === 400) {
      const t = await r.text();
      if (/web.?search|tool/i.test(t)) r = await post(baseTools); // web search not available here → drop it, keep going
      else throw new Error(`Model error 400: ${t.slice(0, 300)}`);
    }
    if (!r.ok) throw new Error(`Model error ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
    return r.json();
  };

  const eff: Effects = { upserts: new Map(), deleted: new Set() };
  const result = (reply: string, changed: boolean) => Response.json({
    reply,
    ...(changed && design ? { design } : {}),
    ...(eff.upserts.size ? { blocks: [...eff.upserts.values()] } : {}),
    ...(eff.deleted.size ? { deletedBlocks: [...eff.deleted] } : {}),
  });

  try {
    let changed = false;
    for (let turn = 0; turn < (agentic ? MAX_TURNS : 1); turn++) {
      const data = await call();
      messages.push({ role: "assistant", content: data.content });
      const toolUses = (Array.isArray(data.content) ? data.content : []).filter((b: { type: string }) => b.type === "tool_use");
      if (!agentic || data.stop_reason !== "tool_use" || !toolUses.length) {
        const reply = (Array.isArray(data.content) ? data.content : []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
        return result(reply || "(done)", changed);
      }
      const results = toolUses.map((u: { id: string; name: string; input: Record<string, unknown> }) => {
        const out = runTool(u.name, u.input ?? {}, design!, blocks, eff);
        changed = changed || out.changed;
        return { type: "tool_result", tool_use_id: u.id, content: out.text };
      });
      messages.push({ role: "user", content: results });
    }
    return result("I made some changes but hit the step limit — ask me to continue if it's not finished.", changed);
  } catch (e) {
    return Response.json({ error: "Could not reach the model.", detail: String(e).slice(0, 300) }, { status: 502 });
  }
}
