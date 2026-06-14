import type { BomRow, ResolvedDesign } from "./types.js";
import { CONNECTOR_CATALOG } from "./connectors.js";

/** Flatten every instance's parts and merge identical ones → a bill of materials. */
export function bom(rd: ResolvedDesign): BomRow[] {
  const map = new Map<string, BomRow>();
  for (const inst of rd.instances) {
    for (const p of inst.def.schematic?.parts ?? []) {
      // polarized caps key separately — a polarized 10µF is a different part from a bipolar 10µF.
      const key = `${p.type}|${p.value ?? ""}|${p.footprint ?? ""}|${p.part ?? ""}|${p.polarized ? "pol" : ""}`;
      const row = map.get(key);
      const ref = `${inst.ref}/${p.ref}`;
      if (row) { row.qty++; row.refs.push(ref); }
      else map.set(key, {
        qty: 1, type: p.type, value: p.value, footprint: p.footprint, part: p.part,
        ...(p.polarized ? { polarized: true } : {}), refs: [ref],
      });
    }
  }
  // Connectors are real, orderable physical parts (the board edge) — they belong in the BOM too.
  // Keyed by catalog id so identical connectors merge; value carries the human name + footprint.
  for (const conn of rd.design.connectors ?? []) {
    const part = CONNECTOR_CATALOG[conn.connector];
    if (!part) continue;
    const key = `connector|${conn.connector}`;
    const row = map.get(key);
    if (row) { row.qty++; row.refs.push(conn.ref); }
    else map.set(key, { qty: 1, type: "connector", value: part.name, footprint: part.footprint, part: part.id, refs: [conn.ref] });
  }
  return [...map.values()];
}

/** Render a BOM as CSV (the fab/distributor interchange format). */
export function bomCsv(rows: BomRow[]): string {
  const head = "qty,type,value,polarized,footprint,part,refs";
  const body = rows.map((r) =>
    [r.qty, r.type, r.value ?? "", r.polarized ? "yes" : "", r.footprint ?? "", r.part ?? "", `"${r.refs.join(" ")}"`].join(",")
  );
  return [head, ...body].join("\n");
}
