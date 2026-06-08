// Validate a block (authored or agent-produced) with actionable, located messages — the
// feedback loop an authoring agent relies on. Catches the things a free-form generator gets
// wrong: malformed manifest, wires to pins/symbols that don't exist, terminals left
// unconnected, ports naming undeclared terminals, and parts shorted across themselves.
import { SYMBOL_CATALOG } from "./catalog.js";
import { deriveSchematicNets, type SchConnection } from "./schematic-nets.js";
import type { Block, SchematicLayout } from "./types.js";

export interface ValidationIssue {
  severity: "error" | "warn";
  code: string;
  message: string;
  at?: string; // symbol id, terminal id, or "sym.pin"
}

function validateLayout(layout: SchematicLayout, terminals: { id: string }[], out: ValidationIssue[]) {
  const byId = new Map(layout.symbols.map((s) => [s.id, s]));
  const declared = new Set(terminals.map((t) => t.id));

  // ports name a real terminal
  for (const s of layout.symbols) {
    if (s.type === "port") {
      if (!s.ref) out.push({ severity: "warn", code: "port/unnamed", message: `Port "${s.id}" has no terminal ref.`, at: s.id });
      else if (!declared.has(s.ref)) out.push({ severity: "warn", code: "port/unknown-terminal", message: `Port "${s.id}" names terminal "${s.ref}", which the block doesn't declare.`, at: s.id });
    } else if (!SYMBOL_CATALOG[s.type]) {
      out.push({ severity: "error", code: "symbol/unknown-type", message: `"${s.id}" is an unknown symbol type "${s.type}".`, at: s.id });
    }
  }

  // every wire endpoint resolves to a real pin on a placed symbol
  for (const end of layout.wires.flatMap((w) => [w.from, w.to])) {
    const dot = end.indexOf(".");
    if (dot < 0) { out.push({ severity: "error", code: "wire/malformed", message: `Wire endpoint "${end}" is malformed (expected "symbol.pin").`, at: end }); continue; }
    const sid = end.slice(0, dot), pin = end.slice(dot + 1);
    const sym = byId.get(sid);
    if (!sym) { out.push({ severity: "error", code: "wire/unknown-symbol", message: `Wire references "${sid}", which isn't placed.`, at: end }); continue; }
    const def = SYMBOL_CATALOG[sym.type];
    if (def && !def.parametric && !def.pins.includes(pin)) {
      out.push({ severity: "error", code: "wire/unknown-pin", message: `${sym.type} "${sid}" has no pin "${pin}" (has pins ${def.pins.join("/")}).`, at: end });
    }
  }

  // nets: shorts across a two-pin part, and terminal coverage
  const conns: SchConnection[] = layout.wires.map((w, i) => ({
    id: `w${i}`,
    a: endpoint(byId, w.from),
    b: endpoint(byId, w.to),
  }));
  const twoPin = layout.symbols.filter((s) => SYMBOL_CATALOG[s.type]?.pins.length === 2).map((s) => s.id);
  const nets = deriveSchematicNets(conns, twoPin);
  for (const net of nets.nets) {
    for (const shorted of net.shorts) {
      const ref = byId.get(shorted)?.ref ?? shorted;
      out.push({ severity: "error", code: "net/short", message: `${ref} is shorted across itself — both pins are on the same net.`, at: shorted });
    }
  }
  // terminal exposure: a terminal is exposed if its port pin shares a net with a real part pin
  const portPins = new Map<string, string>(); // "symId.pin" → terminal id
  for (const s of layout.symbols) if (s.type === "port" && s.ref) portPins.set(`${s.id}.1`, s.ref);
  const connectedTerms = new Set<string>();
  for (const net of nets.nets) {
    const terms = net.pins.filter((p) => portPins.has(p)).map((p) => portPins.get(p)!);
    const hasPart = net.pins.some((p) => !portPins.has(p));
    if (hasPart) terms.forEach((t) => connectedTerms.add(t));
  }
  for (const t of terminals) {
    if (!connectedTerms.has(t.id)) out.push({ severity: "warn", code: "terminal/unconnected", message: `Terminal "${t.id}" isn't wired to anything inside the block.`, at: t.id });
  }
}

function endpoint(byId: Map<string, { type: string; ref?: string }>, end: string): SchConnection["a"] {
  const sid = end.slice(0, end.indexOf(".")), pin = end.slice(end.indexOf(".") + 1);
  const sym = byId.get(sid);
  if (!sym) return { kind: "broken", key: end };
  if (sym.type === "port") return { kind: "pin", sym: sid, pin };
  return { kind: "pin", sym: sid, pin };
}

/** Validate a block manifest + its layout. Returns [] when clean. */
export function validateBlock(block: Block): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!block.id) out.push({ severity: "error", code: "block/no-id", message: "Block has no id." });
  if (!block.name) out.push({ severity: "error", code: "block/no-name", message: "Block has no name." });
  if (!block.version) out.push({ severity: "error", code: "block/no-version", message: "Block has no version." });
  if (!block.terminals?.length) out.push({ severity: "error", code: "block/no-terminals", message: "Block declares no terminals — it can't connect to anything." });
  const dupTerms = (block.terminals ?? []).map((t) => t.id).filter((id, i, a) => a.indexOf(id) !== i);
  for (const id of new Set(dupTerms)) out.push({ severity: "error", code: "block/duplicate-terminal", message: `Terminal id "${id}" is declared more than once — terminal ids must be unique.`, at: id });

  if (block.layout) validateLayout(block.layout, block.terminals ?? [], out);
  return out;
}
