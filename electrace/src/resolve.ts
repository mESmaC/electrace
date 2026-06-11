import { rmax } from "./types.js";
import type { InvalidConnection,
  Block, Design, ResolvedDesign, ResolvedInstance, ResolvedNet, ResolvedPin, NetType, InstanceOverrides, Terminal,
} from "./types.js";
import { UnionFind } from "./uf.js";
import { CONNECTOR_CATALOG, effectivePinSpec } from "./connectors.js";

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
// A human net name (not "net0"): an explicit connection label if present, else the terminal the net
// reaches — preferring a power/ground-looking rail when several terminals share the net. Returns null
// only when there are no members to name it after (the caller then uses a numbered fallback).
function netName(design: Design, members: Set<string>): string | null {
  for (const c of design.connections) {
    if (c.net && (members.has(c.from) || members.has(c.to))) return c.net;
  }
  // a named connector pin on the net names it ("VBUS", "BAT+") — the board edge is where
  // the most meaningful names live, and both catalog defaults and user pin specs are deliberate
  for (const conn of design.connectors ?? []) {
    const part = CONNECTOR_CATALOG[conn.connector];
    if (!part) continue;
    for (const pin of part.pins) {
      if (!members.has(`${conn.ref}.${pin}`)) continue;
      const nm = effectivePinSpec(part, conn.pins, pin)?.name;
      if (nm) return nm;
    }
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
  // A pin with a declaration (catalog default — USB VBUS is 5 V power in — or a per-instance spec)
  // additionally becomes a REAL pin: it types the net, declares voltage/current, and feeds every
  // rule, so the engine sees what enters and leaves the board instead of going blind at its edge.
  const connectorPins = new Set<string>();
  for (const conn of design.connectors ?? []) {
    const part = CONNECTOR_CATALOG[conn.connector];
    if (!part) throw new Error(`Unknown connector "${conn.connector}" (instance ${conn.ref})`);
    const pseudo: Block = { id: `connector:${part.id}`, name: part.name, version: "0", terminals: [] };
    for (const pin of part.pins) {
      const node = `${conn.ref}.${pin}`;
      uf.add(node);
      connectorPins.add(node);
      const spec = effectivePinSpec(part, conn.pins, pin);
      if (!spec) continue;
      const def: Terminal = {
        id: pin,
        // declared v with no explicit role = a supply arriving from off-board (drives the net);
        // otherwise the pin is a load the board feeds.
        role: spec.role ?? (spec.v ? "out" : "in"),
        type: spec.type ?? "signal",
        ...(spec.v ? { v: spec.v } : {}),
        ...(spec.i ? { i: spec.i } : {}),
        external: true,
      };
      pseudo.terminals.push(def);
      pinOf.set(node, { node, instance: conn.ref, terminal: pin, block: pseudo, def });
    }
  }

  // A connection to a pin that no longer exists (block re-authored, terminal renamed) is SKIPPED
  // and recorded — never thrown. One stale wire killing the whole analysis left users (and agents)
  // with a single cryptic error and an empty net graph; partial truth + a precise finding beats that.
  const invalid: InvalidConnection[] = [];
  for (const c of design.connections) {
    const known = (e: string) => pinOf.has(e) || connectorPins.has(e);
    const missing = [c.from, c.to].filter((e) => !known(e));
    if (missing.length) { invalid.push({ from: c.from, to: c.to, missing }); continue; }
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
  const sinkLabeled = new Set<object>();
  const usedIds = new Set<string>();
  let n = 0;
  for (const members of groups.values()) {
    const pins = members.filter((m) => pinOf.has(m)).map((m) => pinOf.get(m)!);
    // a net of only connector pins (nothing docked on-board) — skip. Declared pins enrich nets
    // they're wired into; a freshly placed connector's unwired pins must not spawn ghost nets.
    if (!pins.some((p) => !connectorPins.has(p.node))) continue;
    const sources = pins.filter((p) => p.def.role === "out");
    const sinks = pins
      .filter((p) => p.def.role === "in")
      .map((p) => ({ pin: p, current: p.def.i }));
    // exclude follows-only declarations: they're placeholders resolved by the propagation pass below
    const hasV = (p: { def: { v?: { follows?: string; min?: number; max?: number; value?: number } } }) =>
      p.def.v && (p.def.v.min != null || p.def.v.max != null || p.def.v.value != null);
    const srcV = sources.find(hasV);
    const vsrc = srcV ?? pins.find(hasV); // sink fallback labels a rail by its consumer when nothing drives it
    const connPins = members.filter((m) => connectorPins.has(m)).sort();
    const external = connPins.length > 0 || pins.some((p) => p.def.external);
    let id = netName(design, new Set(members)) ?? `net${n}`;
    n++;
    if (usedIds.has(id)) { let k = 2; while (usedIds.has(`${id}#${k}`)) k++; id = `${id}#${k}`; } // keep ids unique
    usedIds.add(id);
    const net = {
      id, type: netType(pins), voltage: vsrc?.def.v,
      sources, sinks, members: pins, ...(connPins.length ? { connectorPins: connPins } : {}),
      open: pins.length === 1, external,
    };
    nets.push(net);
    if (!srcV && vsrc) sinkLabeled.add(net); // voltage borrowed from a sink — a follows-source may override
  }

  // DC propagation: outputs declared `v: { follows: <terminal> }` swing with the net attached to
  // that sibling terminal (a 555's out follows vcc). Iterate until stable — chains like
  // supply → chip A out → chip B in are short; 8 passes covers any sane design, cycles just stop
  // changing. Propagated voltage carries the source net's max (worst case for over-voltage checks);
  // min is deliberately dropped: a full-swing output reaches 0.
  const sinkLabeledFinal = sinkLabeled; // (alias for clarity in the pass below)
  const netOfMember = new Map<string, (typeof nets)[number]>();
  for (const net of nets) for (const m of net.members) netOfMember.set(m.node, net);
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const net of nets) {
      if (net.voltage && !sinkLabeledFinal.has(net)) continue;
      for (const src of net.sources) {
        const f = src.def.v?.follows;
        if (!f) continue;
        const ref = netOfMember.get(`${src.instance}.${f}`);
        const vmax = ref?.voltage ? rmax(ref.voltage) : undefined;
        if (vmax != null) { net.voltage = { max: vmax, unit: "V" }; sinkLabeledFinal.delete(net); changed = true; break; }
      }
    }
    if (!changed) break;
  }

  return { design, instances, nets, ...(invalid.length ? { invalid } : {}) };
}
