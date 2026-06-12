import { UnionFind } from "./uf.js";
import { canonicalTerminal } from "./resolve.js";
import type { FlatNet, FlatPart, FlatSchematic, ResolvedDesign } from "./types.js";

const termNode = (inst: string, term: string) => `${inst}::@${term}`;
const refToTermNode = (pinRef: string) => {
  const i = pinRef.indexOf(".");
  return termNode(pinRef.slice(0, i), pinRef.slice(i + 1));
};

/**
 * Flatten a resolved design into one global netlist: expand every block's internal
 * schematic, then stitch internal nets across block boundaries (an internal net tied
 * to `@terminal` merges with whatever that terminal connects to in the design). The
 * basis for the read-only "Schematic view" and for export (KiCad netlist / PDF).
 */
export function flatten(rd: ResolvedDesign): FlatSchematic {
  const uf = new UnionFind();
  const parts: FlatPart[] = [];
  const compPins = new Set<string>();                  // nodes that are real component pins
  const internalName = new Map<string, { inst: string; name: string }>();
  const connName = new Map<string, string>();          // terminal node → design net name

  for (const inst of rd.instances) {
    // every terminal gets a node so cross-block connections can union, even without a schematic
    for (const t of inst.def.terminals) uf.add(termNode(inst.ref, t.id));

    const sc = inst.def.schematic;
    if (!sc) continue;

    for (const p of sc.parts) {
      parts.push({
        ref: `${inst.ref}/${p.ref}`, instance: inst.ref, type: p.type,
        value: p.value, rating: p.rating, part: p.part, footprint: p.footprint, why: p.why,
        polarized: p.polarized, shielded: p.shielded, chip: p.chip,
      });
    }

    for (const net of sc.nets) {
      const nodes = net.connect.map((c) => {
        if (c.startsWith("@")) return termNode(inst.ref, c.slice(1));
        const id = `${inst.ref}/${c}`;
        compPins.add(id);
        return id;
      });
      nodes.forEach((n) => uf.add(n));
      for (let i = 1; i < nodes.length; i++) uf.union(nodes[0], nodes[i]);
      for (const n of nodes) if (!internalName.has(n)) internalName.set(n, { inst: inst.ref, name: net.name });
    }
  }

  // stitch across boundaries via the design's connections. A connector pin (e.g. "J1.3") is a real
  // physical pad on the board — register it as a component pin so it lands in the netlist (and the PCB),
  // rather than a block terminal node (which gets filtered out as having no physical pin).
  const connRefs = new Set((rd.design.connectors ?? []).map((x) => x.ref));
  const instOf = new Map(rd.instances.map((x) => [x.ref, x]));
  const epNode = (pinRef: string): string => {
    const i = pinRef.indexOf(".");
    if (i < 0) return pinRef;
    const ref = pinRef.slice(0, i);
    if (connRefs.has(ref)) { uf.add(pinRef); compPins.add(pinRef); return pinRef; }
    // canonicalize aliases — an aliased endpoint must land on the REAL terminal node,
    // not mint a phantom one (phantom nodes were the solver-singularity bug class)
    const inst = instOf.get(ref);
    const t = inst ? canonicalTerminal(inst.def, pinRef.slice(i + 1)) : undefined;
    return termNode(ref, t ?? pinRef.slice(i + 1));
  };
  for (const c of rd.design.connections) {
    const a = epNode(c.from), b = epNode(c.to);
    uf.union(a, b);
    if (c.net) { connName.set(a, c.net); connName.set(b, c.net); }
  }

  // design-level net labels: union same-named groups (wireless nets), label name names the net
  const labelFirst = new Map<string, string>();
  for (const l of rd.design.labels ?? []) {
    const n = epNode(l.node);
    connName.set(n, l.name);
    const first = labelFirst.get(l.name);
    if (first) uf.union(first, n); else labelFirst.set(l.name, n);
  }

  // group → nets
  const groups = new Map<string, string[]>();
  for (const id of uf.keys()) {
    const root = uf.find(id);
    const g = groups.get(root);
    if (g) g.push(id); else groups.set(root, [id]);
  }

  const nets: FlatNet[] = [];
  const termNet: Record<string, string> = {};          // "REF.term" → flat-net name (solver boundary hook)
  const internalNet: Record<string, string> = {};      // "REF/<internal net name>" → flat-net name (asserts hook)
  let k = 0;
  let t = 0;
  const used = new Set<string>();
  const unique = (n: string): string => {
    if (!used.has(n)) { used.add(n); return n; }
    let i = 2;
    while (used.has(`${n}#${i}`)) i++;
    used.add(`${n}#${i}`);
    return `${n}#${i}`;
  };
  for (const members of groups.values()) {
    const pins = members.filter((m) => compPins.has(m)).sort();
    // pure-terminal groups carry no physical pin → not in the netlist, but they ARE electrical
    // nodes (a source block's gnd terminal tied straight to a load's): termNet keeps them under
    // a synthetic "~" name so the DC solver doesn't lose the return path.
    // synthetic groups NEVER take a display name — a collision with a physical net's name
    // would silently merge two distinct solver nodes.
    // Names are DEDUPED ("VOUT", "VOUT#2"): two distinct nets sharing one name would short
    // them in an exported KiCad netlist on import — and merged them in the solver's matrix.
    // (Two blocks' port-derived internals colliding on "VOUT" is the everyday case.)
    const name = pins.length ? unique(pickName(members, connName, internalName) ?? `N${k++}`) : `~T${t++}`;
    if (pins.length) nets.push({ name, pins });
    for (const m of members) {
      const sep = m.indexOf("::@");
      if (sep >= 0) termNet[`${m.slice(0, sep)}.${m.slice(sep + 3)}`] = name;
      const info = internalName.get(m);
      if (info) internalNet[`${info.inst}/${info.name}`] = name;
    }
  }
  nets.sort((a, b) => a.name.localeCompare(b.name));
  return { parts, nets, termNet, internalNet };
}

/** Prefer a user-facing design-connection name; else the internal net name
 *  (qualified by instance when it's internal-only). */
function pickName(
  members: string[],
  connName: Map<string, string>,
  internalName: Map<string, { inst: string; name: string }>,
): string | undefined {
  for (const m of members) {
    const n = connName.get(m);
    if (n) return n;
  }
  const insts = new Set<string>();
  const counts = new Map<string, number>();
  for (const m of members) {
    const info = internalName.get(m);
    if (info) { insts.add(info.inst); counts.set(info.name, (counts.get(info.name) ?? 0) + 1); }
  }
  if (counts.size === 0) return undefined;
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return insts.size > 1 ? top : `${[...insts][0]}/${top}`;
}
