import type { FlatSchematic } from "./types.js";

export interface KicadOptions {
  source?: string;
  date?: string;   // pass in (keeps the export pure/deterministic)
  tool?: string;
}

/** Component-type → KiCad reference-designator prefix. */
const PREFIX: Record<string, string> = {
  res: "R", cap: "C", inductor: "L", ic: "U", diode: "D", tvs: "D", led: "D",
  mosfet: "Q", transistor: "Q", connector: "J", crystal: "Y", switch: "SW",
};
const prefixFor = (type: string) => PREFIX[type] ?? "U";

const q = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Render a flattened design as a KiCad netlist (S-expression `.net`, version "E").
 * Components are re-annotated to conventional refs (R1, C1, U1…) across the whole
 * design; the originating block is preserved in a field for traceability.
 */
export function toKicadNetlist(flat: FlatSchematic, opts: KicadOptions = {}): string {
  // re-annotate: assign fresh sequential refs per prefix, in stable order
  const counters = new Map<string, number>();
  const refMap = new Map<string, string>(); // "REG1/U1" → "U1"
  const comps = flat.parts.map((p) => {
    const prefix = prefixFor(p.type);
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    const ref = `${prefix}${n}`;
    refMap.set(p.ref, ref);
    return { ref, p };
  });

  // connectors appear in the netlist as pins (J1.VBUS) but are NOT flat parts — without a matching
  // (comp J1) KiCad reports a phantom component on import (the "dirty .net" that made the free export
  // look broken). Synthesize a comp for each connector ref referenced by the nets.
  const partRefs = new Set(comps.map((c) => c.p.ref));
  const connectorRefs = new Set<string>();
  for (const net of flat.nets) for (const pin of net.pins) {
    const r = pin.slice(0, pin.lastIndexOf("."));
    if (r && !partRefs.has(r)) connectorRefs.add(r);
  }
  const connComps = [...connectorRefs].sort().map((orig) => {
    const n = (counters.get("J") ?? 0) + 1;
    counters.set("J", n);
    const ref = `J${n}`;
    refMap.set(orig, ref);
    return { ref, orig };
  });

  const out: string[] = [];
  out.push(`(export (version "E")`);
  out.push(`  (design`);
  out.push(`    (source ${q(opts.source ?? "electrace")})`);
  out.push(`    (date ${q(opts.date ?? "")})`);
  out.push(`    (tool ${q(opts.tool ?? "Electrace 0.1.0")}))`);

  out.push(`  (components`);
  for (const { ref, p } of comps) {
    out.push(`    (comp (ref ${q(ref)})`);
    out.push(`      (value ${q(p.value ?? p.part ?? p.type)})`);
    if (p.footprint) out.push(`      (footprint ${q(p.footprint)})`);
    out.push(`      (fields`);
    out.push(`        (field (name "Block") ${q(p.instance)})`);
    if (p.part) out.push(`        (field (name "MPN") ${q(p.part)})`);
    if (p.why) out.push(`        (field (name "Why") ${q(p.why)}))`);
    else out.push(`      )`);
    out.push(`      (sheetpath (names ${q(`/${p.instance}/`)}) (tstamps "/")))`);
  }
  for (const { ref, orig } of connComps) {
    out.push(`    (comp (ref ${q(ref)})`);
    out.push(`      (value ${q("Connector")})`);
    out.push(`      (fields (field (name "Block") ${q(orig)}))`);
    out.push(`      (sheetpath (names ${q(`/${orig}/`)}) (tstamps "/")))`);
  }
  out.push(`  )`);

  out.push(`  (nets`);
  flat.nets.forEach((net, i) => {
    out.push(`    (net (code ${q(String(i + 1))}) (name ${q(net.name)})`);
    for (const pin of net.pins) {
      const dot = pin.lastIndexOf(".");
      const partRef = pin.slice(0, dot);
      const pinName = pin.slice(dot + 1);
      out.push(`      (node (ref ${q(refMap.get(partRef) ?? partRef)}) (pin ${q(pinName)}))`);
    }
    out.push(`    )`);
  });
  out.push(`  ))`);

  return out.join("\n") + "\n";
}
