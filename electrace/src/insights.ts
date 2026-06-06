// Schematic-level circuit insights: detect common component arrangements (parallel/series R and C,
// voltage dividers) from a component+net graph and compute their combined values. Pure + tested —
// the editor surfaces these numbers, so the topology detection and the math both have to be right.
import { parseValue, parallelResistance, seriesSum, formatValue } from "./values.js";

/** A component reduced to what the analysis needs: a type, an optional value, and pin→net ids. */
export interface InsightComponent {
  ref: string;
  type: string;                    // "resistor" | "capacitor" | …
  value?: string;
  pins: Record<string, number>;    // pinId → net id
}

export interface Insight {
  kind: "parallel-r" | "series-r" | "parallel-c" | "series-c" | "divider";
  refs: string[];
  text: string;
}

const nets = (c: InsightComponent) => Object.values(c.pins);
const twoNets = (c: InsightComponent): [number, number] | null => {
  const n = nets(c);
  return n.length === 2 && n[0] !== n[1] ? [n[0], n[1]] : null;
};

/** "R1 ∥ R2 = 5kΩ", or a prompt to set values if any are missing/unparseable. */
function valueLine(refs: string[], joiner: string, verb: string, vals: (number | null)[], combine: (n: number[]) => number, unit: string): string {
  const label = refs.join(` ${joiner} `);
  const known = vals.filter((v): v is number => v != null && v > 0);
  return known.length === vals.length
    ? `${label} ${verb} = ${formatValue(combine(known))}${unit}`
    : `${label} ${verb} (give them values to compute)`;
}

/** Resistors/capacitors whose two pins land on the same pair of nets → in parallel. */
function parallelGroups(comps: InsightComponent[], type: string): InsightComponent[][] {
  const by = new Map<string, InsightComponent[]>();
  for (const c of comps) {
    if (c.type !== type) continue;
    const np = twoNets(c);
    if (!np) continue;
    const key = `${Math.min(np[0], np[1])}-${Math.max(np[0], np[1])}`;
    (by.get(key) ?? by.set(key, []).get(key)!).push(c);
  }
  return [...by.values()].filter((g) => g.length >= 2);
}

/** Maximal chains of same-type 2-terminal parts linked through degree-2 nodes (a series string). */
function seriesChains(comps: InsightComponent[], type: string, degree: Map<number, number>): InsightComponent[][] {
  const parts = comps.filter((c) => c.type === type && twoNets(c));
  const byRef = new Map(parts.map((c) => [c.ref, c]));
  const onNet = new Map<number, string[]>();
  for (const c of parts) for (const n of nets(c)) (onNet.get(n) ?? onNet.set(n, []).get(n)!).push(c.ref);
  const adj = new Map<string, Set<string>>(parts.map((c) => [c.ref, new Set<string>()]));
  for (const [n, refs] of onNet) {
    // a clean series node: exactly two component pins total on it, and both are parts of this type
    if (degree.get(n) === 2 && refs.length === 2 && refs[0] !== refs[1]) {
      adj.get(refs[0])!.add(refs[1]);
      adj.get(refs[1])!.add(refs[0]);
    }
  }
  const seen = new Set<string>();
  const chains: InsightComponent[][] = [];
  for (const c of parts) {
    if (seen.has(c.ref)) continue;
    const stack = [c.ref], group: string[] = [];
    while (stack.length) {
      const r = stack.pop()!;
      if (seen.has(r)) continue;
      seen.add(r); group.push(r);
      adj.get(r)!.forEach((x) => { if (!seen.has(x)) stack.push(x); });
    }
    if (group.length >= 2) chains.push(group.map((r) => byRef.get(r)!));
  }
  return chains;
}

/** Detect parallel/series R & C and voltage dividers, with combined values. */
export function schematicInsights(comps: InsightComponent[]): Insight[] {
  const out: Insight[] = [];
  const degree = new Map<number, number>();
  for (const c of comps) for (const n of nets(c)) degree.set(n, (degree.get(n) ?? 0) + 1);

  for (const g of parallelGroups(comps, "resistor"))
    out.push({ kind: "parallel-r", refs: g.map((c) => c.ref), text: valueLine(g.map((c) => c.ref), "∥", "in parallel", g.map((c) => parseValue(c.value)), parallelResistance, "Ω") });
  for (const g of parallelGroups(comps, "capacitor"))
    out.push({ kind: "parallel-c", refs: g.map((c) => c.ref), text: valueLine(g.map((c) => c.ref), "∥", "in parallel", g.map((c) => parseValue(c.value)), seriesSum, "F") }); // caps add in parallel

  for (const chain of seriesChains(comps, "resistor", degree))
    out.push({ kind: "series-r", refs: chain.map((c) => c.ref), text: valueLine(chain.map((c) => c.ref), "+", "in series", chain.map((c) => parseValue(c.value)), seriesSum, "Ω") });
  for (const chain of seriesChains(comps, "capacitor", degree))
    out.push({ kind: "series-c", refs: chain.map((c) => c.ref), text: valueLine(chain.map((c) => c.ref), "+", "in series", chain.map((c) => parseValue(c.value)), parallelResistance, "F") }); // caps: reciprocal

  // voltage divider: two resistors share one net whose midpoint is actually used (degree ≥ 3),
  // with their other ends on different nets.
  const rs = comps.filter((c) => c.type === "resistor" && twoNets(c));
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a1, a2] = twoNets(rs[i])!, [b1, b2] = twoNets(rs[j])!;
    const shared = [a1, a2].find((n) => n === b1 || n === b2);
    if (shared == null || (degree.get(shared) ?? 0) < 3) continue;
    const aOther = a1 === shared ? a2 : a1, bOther = b1 === shared ? b2 : b1;
    if (aOther === bOther) continue; // same span ends = parallel, not a divider
    const ra = parseValue(rs[i].value), rb = parseValue(rs[j].value);
    const refs = [rs[i].ref, rs[j].ref];
    const ratio = ra != null && rb != null && ra + rb > 0
      ? ` — tap = in × ${(rb / (ra + rb)).toPrecision(3)} (or ×${(ra / (ra + rb)).toPrecision(3)} from the other end)`
      : " (give them values for the ratio)";
    out.push({ kind: "divider", refs, text: `${refs.join(" / ")} form a voltage divider${ratio}` });
  }

  return out;
}
