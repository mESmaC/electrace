// Group a schematic's wire connections into electrical nets.
//
// This is the block-internal counterpart to resolve.ts (which stitches design-level
// nets across blocks): both project a set of connections into connected components via
// union-find. The editor resolves each wire end to one of these abstract endpoints
// (a real pin, a floating free point, or a broken reference) and asks for the nets back,
// so wire colouring / live checks reflect true connectivity rather than per-wire guesses.
import { UnionFind } from "./uf.js";

export type SchEndpoint =
  | { kind: "pin"; sym: string; pin: string } // lands on a real symbol pin
  | { kind: "free"; key: string }             // floats in empty space (key = coordinate)
  | { kind: "broken"; key: string };          // references a pin that no longer exists

export interface SchConnection { id: string; a: SchEndpoint; b: SchEndpoint }

export interface SchNet {
  id: number;
  pins: string[];     // distinct "sym.pin" members
  connIds: string[];  // connections on this net
  hasFree: boolean;   // touches a floating point
  hasBroken: boolean; // touches a broken reference
  shorts: string[];   // sym ids whose part is shorted across itself (a two-pin part with both pins here)
}

export interface SchematicNets {
  nets: SchNet[];
  netOfConn: Map<string, number>; // connection id → net id
  connectedPins: Set<string>;     // "sym.pin" touched by any connection
}

function nodeKey(e: SchEndpoint): string {
  switch (e.kind) {
    case "pin": return `p:${e.sym}.${e.pin}`;
    case "free": return `f:${e.key}`;
    case "broken": return `x:${e.key}`; // unique per end ⇒ broken stubs never merge
  }
}

/** Project schematic connections into electrical nets via union-find over endpoints.
 *  `twoPinSyms` lists symbol ids that have exactly two pins; a net carrying both pins
 *  of such a part is reported as a short across that part. */
export function deriveSchematicNets(conns: SchConnection[], twoPinSyms: Iterable<string> = []): SchematicNets {
  const uf = new UnionFind();
  const two = new Set(twoPinSyms);
  const meta = new Map<string, { pin?: string; free?: boolean; broken?: boolean }>();

  const note = (e: SchEndpoint) => {
    const k = nodeKey(e);
    uf.add(k);
    const m = meta.get(k) ?? {};
    if (e.kind === "pin") m.pin = `${e.sym}.${e.pin}`;
    else if (e.kind === "free") m.free = true;
    else m.broken = true;
    meta.set(k, m);
  };

  for (const c of conns) {
    note(c.a); note(c.b);
    uf.union(nodeKey(c.a), nodeKey(c.b));
  }

  // gather connected components
  const groups = new Map<string, string[]>();
  for (const k of uf.keys()) {
    const r = uf.find(k);
    const g = groups.get(r);
    if (g) g.push(k); else groups.set(r, [k]);
  }

  const repToId = new Map<string, number>();
  const nets: SchNet[] = [];
  for (const [rep, keys] of groups) {
    const id = nets.length;
    repToId.set(rep, id);
    const pinSet = new Set<string>();
    let hasFree = false, hasBroken = false;
    for (const k of keys) {
      const m = meta.get(k)!;
      if (m.pin) pinSet.add(m.pin);
      if (m.free) hasFree = true;
      if (m.broken) hasBroken = true;
    }
    const pins = [...pinSet];
    const bySym = new Map<string, number>();
    for (const p of pins) {
      const sym = p.slice(0, p.lastIndexOf("."));
      bySym.set(sym, (bySym.get(sym) ?? 0) + 1);
    }
    const shorts = [...bySym].filter(([sym, n]) => two.has(sym) && n >= 2).map(([sym]) => sym);
    nets.push({ id, pins, connIds: [], hasFree, hasBroken, shorts });
  }

  const netOfConn = new Map<string, number>();
  const connectedPins = new Set<string>();
  for (const c of conns) {
    const id = repToId.get(uf.find(nodeKey(c.a)))!;
    netOfConn.set(c.id, id);
    nets[id].connIds.push(c.id);
    for (const e of [c.a, c.b]) if (e.kind === "pin") connectedPins.add(`${e.sym}.${e.pin}`);
  }

  return { nets, netOfConn, connectedPins };
}
