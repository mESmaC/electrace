import type { BomRow, ResolvedDesign } from "./types.js";

/** Flatten every instance's parts and merge identical ones → a bill of materials. */
export function bom(rd: ResolvedDesign): BomRow[] {
  const map = new Map<string, BomRow>();
  for (const inst of rd.instances) {
    for (const p of inst.def.schematic?.parts ?? []) {
      const key = `${p.type}|${p.value ?? ""}|${p.footprint ?? ""}|${p.part ?? ""}`;
      const row = map.get(key);
      const ref = `${inst.ref}/${p.ref}`;
      if (row) { row.qty++; row.refs.push(ref); }
      else map.set(key, {
        qty: 1, type: p.type, value: p.value, footprint: p.footprint, part: p.part, refs: [ref],
      });
    }
  }
  return [...map.values()];
}

/** Render a BOM as CSV (the fab/distributor interchange format). */
export function bomCsv(rows: BomRow[]): string {
  const head = "qty,type,value,footprint,part,refs";
  const body = rows.map((r) =>
    [r.qty, r.type, r.value ?? "", r.footprint ?? "", r.part ?? "", `"${r.refs.join(" ")}"`].join(",")
  );
  return [head, ...body].join("\n");
}
