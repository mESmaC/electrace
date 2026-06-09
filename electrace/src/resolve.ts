import type {
  Block, Design, ResolvedDesign, ResolvedInstance, ResolvedNet, ResolvedPin, NetType, InstanceOverrides,
} from "./types.js";
import { UnionFind } from "./uf.js";
import { CONNECTOR_CATALOG } from "./connectors.js";

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
  // Expand-to-discrete: swap the internal schematic (and drill-in layout) for the authored discrete
  // equivalent. The terminals are unchanged, so every design-level connection is preserved automatically
  // and flatten()/bom()/lint() all see the discrete parts instead of the IC.
  const discrete = ov.discreteExpanded && block.discrete ? block.discrete : null;
  const schematic = discrete ? discrete.schematic : block.schematic;
  const layout = discrete ? discrete.layout : block.layout;
  return { ...block, terminals, transform, schematic, layout };
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
// A human net name (not "net0"): an explicit connection label if present, else the terminal the net
// reaches — preferring a power/ground-looking rail when several terminals share the net. Returns null
// only when there are no members to name it after (the caller then uses a numbered fallback).
function netName(design: Design, members: Set<string>): string | null {
  for (const c of design.connections) {
    if (c.net && (members.has(c.from) || members.has(c.to))) return c.net;
  }
  const terms = [...members].map((node) => node.slice(node.lastIndexOf(".") + 1)).filter(Boolean);
  if (!terms.length) return null;
  // prefer a power/ground-looking name: a +/- prefix, a numeric voltage rail (5V, 3V3, 1V8…), or a known
  // rail word. NOTE: the trailing alternative is `^\d+v` (a leading voltage), NOT a bare `\d` — a bare `\d`
  // matched a digit ANYWHERE, so a net joining e.g. "spi0" + "vout" wrongly picked "spi0" as the rail name.
  const rail = terms.find((t) => /^[+-]|^\d+v\d*|^(v|gnd|agnd|dgnd|vcc|vdd|vss|vin|vout)\b/i.test(t));
  return rail ?? terms[0];
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

  // Connector pins are graph nodes too (the off-board boundary). A net touching one is external.
  const connectorPins = new Set<string>();
  for (const conn of design.connectors ?? []) {
    const part = CONNECTOR_CATALOG[conn.connector];
    if (!part) throw new Error(`Unknown connector "${conn.connector}" (instance ${conn.ref})`);
    for (const pin of part.pins) { const node = `${conn.ref}.${pin}`; uf.add(node); connectorPins.add(node); }
  }

  for (const c of design.connections) {
    const known = (e: string) => pinOf.has(e) || connectorPins.has(e);
    if (!known(c.from)) throw new Error(`Connection references unknown pin "${c.from}"`);
    if (!known(c.to)) throw new Error(`Connection references unknown pin "${c.to}"`);
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
  for (const node of [...pinOf.keys(), ...connectorPins]) {
    const root = uf.find(node);
    const g = groups.get(root);
    if (g) g.push(node); else groups.set(root, [node]);
  }

  const nets: ResolvedNet[] = [];
  const usedIds = new Set<string>();
  let n = 0;
  for (const members of groups.values()) {
    const pins = members.filter((m) => pinOf.has(m)).map((m) => pinOf.get(m)!);
    if (!pins.length) continue; // a net of only connector pins (nothing docked) — skip
    const sources = pins.filter((p) => p.def.role === "out");
    const sinks = pins
      .filter((p) => p.def.role === "in")
      .map((p) => ({ pin: p, current: p.def.i }));
    const vsrc = sources.find((p) => p.def.v) ?? pins.find((p) => p.def.v);
    const external = members.some((m) => connectorPins.has(m)) || pins.some((p) => p.def.external);
    let id = netName(design, new Set(members)) ?? `net${n}`;
    n++;
    if (usedIds.has(id)) { let k = 2; while (usedIds.has(`${id}#${k}`)) k++; id = `${id}#${k}`; } // keep ids unique
    usedIds.add(id);
    nets.push({
      id, type: netType(pins), voltage: vsrc?.def.v,
      sources, sinks, members: pins, open: pins.length === 1, external,
    });
  }

  return { design, instances, nets };
}
