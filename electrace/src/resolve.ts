import type {
  Block, Design, ResolvedDesign, ResolvedInstance, ResolvedNet, ResolvedPin, NetType, InstanceOverrides,
} from "./types.js";
import { UnionFind } from "./uf.js";

/** Apply per-instance overrides to a block, producing an effective block — used
 *  everywhere downstream (lint, budgets, power) so edits flow through uniformly. */
function applyOverrides(block: Block, ov: InstanceOverrides): Block {
  const terminals = block.terminals.map((t) => {
    const o = ov.terminals?.[t.id];
    return o ? { ...t, i: o.i ?? t.i, v: o.v ?? t.v } : t;
  });
  const transform = ov.efficiency != null && block.transform
    ? { ...block.transform, efficiency: ov.efficiency }
    : block.transform;
  return { ...block, terminals, transform };
}

/** Net type by precedence across its members. */
function netType(pins: ResolvedPin[]): NetType {
  const types = new Set(pins.map((p) => p.def.type));
  if (types.has("gnd")) return "gnd";
  if (types.has("power")) return "power";
  if (types.has("rail")) return "rail";
  return "signal";
}

/** Display name for a net: prefer a connection's declared name, else derive. */
function netName(design: Design, members: Set<string>, fallback: string): string {
  for (const c of design.connections) {
    if (c.net && (members.has(c.from) || members.has(c.to))) return c.net;
  }
  return fallback;
}

/**
 * Resolve a design against its pinned blocks: attach definitions, stitch nets
 * across block boundaries, and build the per-net model the lint operates on.
 * Pure — no I/O. `blocks` is keyed by "id@version".
 */
export function resolve(design: Design, blocks: Map<string, Block>): ResolvedDesign {
  const instances: ResolvedInstance[] = design.blocks.map((bi) => {
    const base = blocks.get(bi.block);
    if (!base) throw new Error(`Unknown block "${bi.block}" (instance ${bi.ref})`);
    const def = bi.overrides ? applyOverrides(base, bi.overrides) : base;
    return { ...bi, def };
  });

  const uf = new UnionFind();
  const pinOf = new Map<string, ResolvedPin>();
  for (const inst of instances) {
    for (const t of inst.def.terminals) {
      const node = `${inst.ref}.${t.id}`;
      uf.add(node);
      pinOf.set(node, { node, instance: inst.ref, terminal: t.id, block: inst.def, def: t });
    }
  }

  for (const c of design.connections) {
    if (!pinOf.has(c.from)) throw new Error(`Connection references unknown pin "${c.from}"`);
    if (!pinOf.has(c.to)) throw new Error(`Connection references unknown pin "${c.to}"`);
    uf.union(c.from, c.to);
  }

  // Intra-block terminal equivalence: terminals a block bridges internally are the
  // same node. Found via the block's own schematic — an internal net listing several
  // `@terminal` refs (e.g. a regulator's GND net ties @gnd_in ≡ @gnd_out) means those
  // exposed terminals are common, so merge them across the whole design too.
  for (const inst of instances) {
    for (const snet of inst.def.schematic?.nets ?? []) {
      const terms = snet.connect
        .filter((c) => c.startsWith("@"))
        .map((c) => `${inst.ref}.${c.slice(1)}`)
        .filter((node) => pinOf.has(node));
      for (let k = 1; k < terms.length; k++) uf.union(terms[0], terms[k]);
    }
  }

  const groups = new Map<string, string[]>();
  for (const node of pinOf.keys()) {
    const root = uf.find(node);
    const g = groups.get(root);
    if (g) g.push(node); else groups.set(root, [node]);
  }

  const nets: ResolvedNet[] = [];
  let n = 0;
  for (const members of groups.values()) {
    const pins = members.map((m) => pinOf.get(m)!);
    const sources = pins.filter((p) => p.def.role === "out");
    const sinks = pins
      .filter((p) => p.def.role === "in")
      .map((p) => ({ pin: p, current: p.def.i }));
    const vsrc = sources.find((p) => p.def.v) ?? pins.find((p) => p.def.v);
    const id = netName(design, new Set(members), `net${n++}`);
    nets.push({
      id, type: netType(pins), voltage: vsrc?.def.v,
      sources, sinks, members: pins, open: pins.length === 1,
    });
  }

  return { design, instances, nets };
}
