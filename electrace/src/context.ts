// Compact, prompt-ready projections of the data model — what an agent actually reads.
// `designContext` is the overview (every block's interface + the deterministic lint/BOM/power
// facts); `blockContext` is the focused detail on one block. Token-cheap structured objects,
// grounded in declared values and the deterministic engine — never pixels or guesses.
import { resolve } from "./resolve.js";
import { lint } from "./lint.js";
import { bom } from "./bom.js";
import { annotatePower } from "./power.js";
import { railBudgets } from "./budget.js";
import type { Block, Design, Range, Terminal, Finding, BomRow } from "./types.js";

function fmtRange(r?: Range): string | undefined {
  if (!r) return undefined;
  const u = r.unit ? ` ${r.unit}` : "";
  if (r.value != null) return `${r.value}${u}`;
  if (r.min != null || r.max != null) return `${r.min ?? "?"}–${r.max ?? "?"}${u}`;
  return undefined;
}

export interface TerminalBrief { id: string; role: string; type: string; v?: string; i?: string }
export interface BlockBrief {
  id: string;
  name: string;
  version: string;
  category?: string;
  topology?: string;
  terminals: TerminalBrief[];
  spec?: Record<string, string>;
  summary: string;
}

const termBrief = (t: Terminal): TerminalBrief => ({ id: t.id, role: t.role, type: t.type, v: fmtRange(t.v), i: fmtRange(t.i) });

/** A one-paragraph, declared-only description an agent can scan or paste into a prompt. */
export function blockBrief(block: Block): BlockBrief {
  const spec = block.spec
    ? Object.fromEntries(Object.entries(block.spec).map(([k, v]) => [k, typeof v === "object" ? fmtRange(v as Range) ?? "" : String(v)]))
    : undefined;
  const ins = block.terminals.filter((t) => t.role === "in").map((t) => t.id).join(", ");
  const outs = block.terminals.filter((t) => t.role === "out").map((t) => t.id).join(", ");
  const summary = `${block.name}${block.topology ? ` (${block.topology})` : ""} — in: ${ins || "—"}; out: ${outs || "—"}`;
  return { id: block.id, name: block.name, version: block.version, category: block.category, topology: block.topology, terminals: block.terminals.map(termBrief), spec, summary };
}

export interface DesignContext {
  id: string;
  name: string;
  instances: { ref: string; block: string; summary: string }[];
  connections: { from: string; to: string; net?: string; type?: string }[];
  checks: Finding[];
  rails: { net: string; type: string; capacityA?: number; drawA: number; usedPct?: number }[];
  bom: BomRow[];
}

/** The overview projection: instances + their interfaces, the connection graph, and the
 *  deterministic facts (lint findings, per-rail current budgets, BOM). */
export function designContext(design: Design, blocks: Map<string, Block>): DesignContext {
  const resolved = resolve(design, blocks);
  annotatePower(resolved);
  const findings = lint(resolved);
  const rails = railBudgets(resolved).map((r) => ({ net: r.net, type: r.type, capacityA: r.capacityA, drawA: r.drawA, usedPct: r.usedPct }));
  const instances = design.blocks.map((bi) => {
    const b = blocks.get(bi.block);
    return { ref: bi.ref, block: bi.block, summary: b ? blockBrief(b).summary : "(unknown block)" };
  });
  const blockByRef = new Map(design.blocks.map((b) => [b.ref, b.block])); // O(1) lookup — was O(blocks) per connection
  const connections = design.connections.map((c) => {
    const [srcRef, srcTerm] = c.from.split(".");
    const srcKey = blockByRef.get(srcRef);
    const type = srcKey ? blocks.get(srcKey)?.terminals.find((t) => t.id === srcTerm)?.type : undefined;
    return { from: c.from, to: c.to, net: c.net, type };
  });
  return { id: design.id, name: design.name, instances, connections, checks: findings, rails, bom: bom(resolved) };
}

export interface BlockContext extends BlockBrief {
  limits?: { field: string; value: number; unit?: string; note: string }[];
  nets?: { name: string; connect: string[] }[];
  parts?: { ref: string; type: string; value?: string; polarized?: boolean; why?: string }[];
  explain?: string;
}

/** Focused detail on a single block — its full interface, internal nets/parts, limits, and
 *  (if supplied) its authored explanation. What an agent reads to reason about or edit a block. */
export function blockContext(block: Block, explain?: string): BlockContext {
  return {
    ...blockBrief(block),
    limits: block.limits,
    nets: block.schematic?.nets.map((n) => ({ name: n.name, connect: n.connect })),
    parts: block.schematic?.parts.map((p) => ({ ref: p.ref, type: p.type, value: p.value, ...(p.polarized ? { polarized: true } : {}), why: p.why })),
    explain,
  };
}
