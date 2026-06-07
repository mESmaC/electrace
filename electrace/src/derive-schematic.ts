// Derive a block's semantic schematic (parts + nets) from its visual layout.
//
// The layout (placed symbols + pin-to-pin wires, with `port` symbols whose `ref` names a
// declared terminal) is the single source of truth the editor mutates. This projects it into
// the parts/nets the resolver, lint, and BOM consume — so what you draw IS what gets analysed,
// and authored `schematic` blocks no longer have to be hand-kept in sync with the picture.
import { UnionFind } from "./uf.js";
import { SYMBOL_CATALOG } from "./catalog.js";
import type { SchematicLayout, PlacedSymbol, Part, SchematicNet, Schematic } from "./types.js";

const symId = (key: string) => key.slice(0, key.indexOf("."));
const pinId = (key: string) => key.slice(key.indexOf(".") + 1);

/** Project a layout into a semantic schematic. `authoredParts` (if given) supplies the
 *  human-authored part metadata — `why`, `footprint`, `part`, polarity — merged in by ref. */
export function deriveBlockSchematic(layout: SchematicLayout, authoredParts: Array<Partial<Part> & { ref: string }> = []): Schematic {
  const ports = new Map<string, string>();      // symbol id → terminal id (its ref)
  const markers = new Map<string, string>();    // net-marker symbol id → the net name it asserts
  const comp = new Map<string, PlacedSymbol>(); // real components (everything else)
  // ground/vcc/off-board/net-label are net markers, not physical parts: they name a net but never
  // become a BOM/PCB component (several grounds default to ref "GND" — treating them as parts collides).
  const markerName = (s: PlacedSymbol): string | null =>
    s.type === "ground" ? "GND" : s.type === "vcc" ? (s.ref || "VCC")
      : s.type === "offboard" ? (s.ref || "EXT") : s.type === "netlabel" ? (s.ref || "NET") : null;
  for (const s of layout.symbols) {
    if (s.type === "port") { ports.set(s.id, s.ref ?? s.id); continue; }
    const nm = markerName(s);
    if (nm) markers.set(s.id, nm); else comp.set(s.id, s);
  }

  // union-find the pins joined by wires → connected components = nets
  const uf = new UnionFind();
  for (const w of layout.wires) uf.union(w.from, w.to);
  const groups = new Map<string, string[]>();
  for (const k of uf.keys()) {
    const r = uf.find(k);
    const g = groups.get(r);
    if (g) g.push(k); else groups.set(r, [k]);
  }

  const nets: SchematicNet[] = [];
  let n = 1;
  for (const keys of groups.values()) {
    const connect: string[] = [];
    let term: string | undefined;
    for (const k of keys) {
      const sid = symId(k);
      if (ports.has(sid)) { const t = ports.get(sid)!; term ??= t; connect.push(`@${t}`); }
      else if (markers.has(sid)) { term ??= markers.get(sid); } // a net marker names the net, not a part pin
      else if (comp.has(sid)) {
        const s = comp.get(sid)!, pid = pinId(k);
        const name = s.chip?.names?.[pid]; // a named chip pin connects as its function (U1.1 → U1.VIN)
        connect.push(`${s.ref ?? sid}.${name || pid}`);
      }
    }
    if (connect.length) nets.push({ name: (term ?? `N${n++}`).toUpperCase(), connect });
  }

  const parts: Part[] = [...comp.values()].map((s) => {
    const ref = s.ref ?? s.id;
    const a = authoredParts.find((p) => p.ref === ref);
    const part: Part = { ref, type: a?.type ?? SYMBOL_CATALOG[s.type]?.partType ?? s.type };
    if (s.value ?? a?.value) part.value = s.value ?? a?.value;
    if (a?.part) part.part = a.part;
    if (a?.footprint) part.footprint = a.footprint;
    if (a?.why) part.why = a.why;
    if (a?.polarized ?? s.type === "cap-pol") part.polarized = true; // a polarized-cap symbol is polarized
    if (a?.shielded) part.shielded = a.shielded;
    return part;
  });

  return { parts, nets };
}
