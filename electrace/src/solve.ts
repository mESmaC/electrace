// DC operating-point solver — stage 1 of the analysis ladder (ROADMAP). Modified Nodal Analysis
// over the flattened design: closed-form linear algebra, NOT transient simulation. It solves the
// LINEAR portion of the circuit honestly:
//   · resistors stamp conductances (a 0 Ω resistor is a short)
//   · declared source terminals become ideal V-sources, referenced to their own block's gnd terminal
//   · declared input draws become constant-current sinks to their block's gnd (worst-case load model)
//   · inductors / ferrites / fuses are DC shorts · capacitors are open
//   · semiconductors and ICs are left OPEN, reported per subcircuit — solving the bias network
//     around a chip with its pins open is exactly right for pull-ups/dividers; pretending to know
//     what the silicon does is not
//   · a valueless resistor emits declaration/missing-value (severity unknown) and is skipped open
// Each connected subcircuit solves independently; anything beyond NODE_CAP nodes is skipped with
// an honest note (dense elimination is O(n³) — no real design gets near the cap).
import { rmax } from "./types.js";
import type { Finding, ResolvedDesign } from "./types.js";
import { flatten } from "./flatten.js";
import { parseValue } from "./values.js";
import { UnionFind } from "./uf.js";

export interface DcPartResult {
  ref: string;               // "REG1/R1"
  footprint?: string;
  ohms: number;
  volts: number;             // across the part
  amps: number;
  watts: number;
}

export interface DcSolve {
  /** Solved node voltages by flat-net name — only nets inside solved subcircuits appear. */
  netVolts: Record<string, number>;
  /** Per-resistor operating point for every resistor in a solved subcircuit. */
  parts: DcPartResult[];
  /** Honesty stream: missing values, ignored nonlinear parts, skipped subcircuits. */
  findings: Finding[];
  solvedComponents: number;
}

const SHORT_AT_DC = new Set(["inductor", "ferrite", "fuse"]);
const OPEN_AT_DC = new Set(["cap", "cap-pol", "capacitor", "crystal", "switch", "button", "testpoint", "antenna"]);
const NODE_CAP = 300;

const pinSplit = (pin: string): [string, string] => {
  const i = pin.lastIndexOf(".");
  return [pin.slice(0, i), pin.slice(i + 1)];
};

/** Gaussian elimination with partial pivoting. A is (n×n) row-major, z length n. Returns x or null. */
function gauss(A: number[][], z: number[]): number[] | null {
  const n = z.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null; // singular — floating section
    if (piv !== col) { [A[piv], A[col]] = [A[col], A[piv]]; [z[piv], z[col]] = [z[col], z[piv]]; }
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col];
      if (!f) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      z[r] -= f * z[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = z[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / A[r][r];
  }
  return x;
}

export function solveDc(rd: ResolvedDesign): DcSolve {
  const flat = flatten(rd);
  const termNet = flat.termNet ?? {};
  const findings: Finding[] = [];

  // pin → flat-net name
  const pinNet = new Map<string, string>();
  for (const net of flat.nets) for (const p of net.pins) pinNet.set(p, net.name);
  const nodeNet = (node: string): string | undefined => termNet[node] ?? pinNet.get(node);

  // DC shorts merge their two nets before anything else (an inductor IS a wire at DC)
  const uf = new UnionFind();
  for (const net of flat.nets) uf.add(net.name);
  const netOfPart = (ref: string, pin: string) => pinNet.get(`${ref}.${pin}`);
  for (const p of flat.parts) {
    if (!SHORT_AT_DC.has(p.type)) continue;
    const a = netOfPart(p.ref, "1"), b = netOfPart(p.ref, "2");
    if (a && b) uf.union(a, b);
  }
  const N = (name: string | undefined) => (name ? uf.find(name) : undefined);

  // elements
  const conducts: { a: string; b: string; g: number; ohms: number; ref: string; footprint?: string }[] = [];
  const nonlinearByNet = new Map<string, Set<string>>(); // merged-net → part refs left open there
  // one pass: every part's pinned nets (the per-part pinNet scan was O(parts²) at scale)
  const netsOfRef = new Map<string, string[]>();
  for (const [pin, net] of pinNet) {
    const [ref] = pinSplit(pin);
    (netsOfRef.get(ref) ?? netsOfRef.set(ref, []).get(ref)!).push(net);
  }
  for (const p of flat.parts) {
    if (p.type === "res") {
      const a = N(netOfPart(p.ref, "1")), b = N(netOfPart(p.ref, "2"));
      if (!a || !b || a === b) continue;
      const ohms = p.value != null ? parseValue(p.value) : undefined;
      if (ohms == null || !isFinite(ohms) || ohms < 0) {
        findings.push({
          rule: "declaration/missing-value", severity: "unknown", category: "completeness", at: [p.ref],
          message: `${p.ref} has no usable resistance value — the DC solver left it open, so voltages around it are not computed.`,
          fix: { label: "Give the resistor a value" },
        });
        continue;
      }
      if (ohms === 0) { uf.union(a, b); continue; }
      conducts.push({ a, b, g: 1 / ohms, ohms, ref: p.ref, footprint: p.footprint });
    } else if (SHORT_AT_DC.has(p.type) || OPEN_AT_DC.has(p.type)) {
      // handled above / genuinely open at DC
    } else {
      // semiconductors, ICs, anything else: open, but say so where it matters
      for (const net of netsOfRef.get(p.ref) ?? []) {
        const n = N(net);
        if (n) (nonlinearByNet.get(n) ?? nonlinearByNet.set(n, new Set()).get(n)!).add(p.ref);
      }
    }
  }
  // re-key shorts-merged conductances (a union after push could stale a name)
  for (const c of conducts) { c.a = uf.find(c.a); c.b = uf.find(c.b); }

  // boundary sources: declared source terminals → ideal V-sources to their own block's gnd
  const gndNetOf = (instance: string): string | undefined => {
    const inst = rd.instances.find((x) => x.ref === instance);
    for (const t of inst?.def.terminals ?? []) {
      if (t.type !== "gnd") continue;
      const n = N(nodeNet(`${instance}.${t.id}`));
      if (n) return n;
    }
    // connectors: any gnd-typed declared pin of the same ref
    for (const net of rd.nets) {
      for (const m of net.members) {
        if (m.instance !== instance || m.def.type !== "gnd") continue;
        const n = N(nodeNet(m.node));
        if (n) return n;
      }
    }
    return undefined;
  };

  const vsources: { plus: string; minus: string; volts: number }[] = [];
  const isinks: { from: string; to: string; amps: number }[] = [];
  const seenSrc = new Set<string>();
  for (const net of rd.nets) {
    for (const s of net.sources) {
      const v = s.def.v;
      const volts = v?.value ?? v?.max;
      if (volts == null || seenSrc.has(s.node)) continue;
      const plus = N(nodeNet(s.node)), minus = gndNetOf(s.instance);
      if (!plus || !minus || plus === minus) continue;
      seenSrc.add(s.node);
      vsources.push({ plus, minus, volts });
    }
    for (const sk of net.sinks) {
      const amps = rmax(sk.current);
      if (amps == null || amps <= 0) continue;
      const from = N(nodeNet(sk.pin.node)), to = gndNetOf(sk.pin.instance);
      if (!from || !to || from === to) continue;
      isinks.push({ from, to, amps });
    }
  }

  // an unwired declared load is a current sink on a node with no conductive path — KCL would
  // demand 0 = I and the whole component's matrix goes singular. The open-net rule already
  // flags the dangling pin; the solver just refuses to let it poison the rest of the solve.
  const degree = new Map<string, number>();
  const bump = (n: string) => degree.set(n, (degree.get(n) ?? 0) + 1);
  for (const c of conducts) { bump(c.a); bump(c.b); }
  for (const v of vsources) { bump(v.plus); bump(v.minus); }
  const liveSinks = isinks.filter((s) => (degree.get(s.from) ?? 0) > 0);

  // partition into connected subcircuits
  const comp = new UnionFind();
  const touch = (n: string) => comp.add(n);
  for (const c of conducts) { touch(c.a); touch(c.b); comp.union(c.a, c.b); }
  for (const v of vsources) { touch(v.plus); touch(v.minus); comp.union(v.plus, v.minus); }
  for (const i of liveSinks) { touch(i.from); touch(i.to); comp.union(i.from, i.to); }

  const byComp = new Map<string, string[]>();
  for (const n of comp.keys()) {
    const root = comp.find(n);
    (byComp.get(root) ?? byComp.set(root, []).get(root)!).push(n);
  }

  const netVolts: Record<string, number> = {};
  const parts: DcPartResult[] = [];
  let solved = 0;

  for (const nodes of byComp.values()) {
    const inComp = new Set(nodes);
    const vs = vsources.filter((v) => inComp.has(v.plus));
    if (!vs.length) continue; // no excitation — nothing to solve, nothing to claim
    if (nodes.length > NODE_CAP) {
      findings.push({
        rule: "solve/subcircuit-too-large", severity: "info", category: "completeness", at: [nodes[0]],
        message: `A subcircuit with ${nodes.length} electrical nodes exceeds the DC solver's ${NODE_CAP}-node budget — its operating point was not computed.`,
      });
      continue;
    }
    // reference = first V-source's negative rail (a gnd by construction)
    const ref = vs[0].minus;
    const idx = new Map<string, number>();
    for (const n of nodes) if (n !== ref) idx.set(n, idx.size);
    const n = idx.size, m = vs.length;
    const A = Array.from({ length: n + m }, () => new Array(n + m).fill(0));
    const z = new Array(n + m).fill(0);
    const at = (name: string) => (name === ref ? -1 : idx.get(name)!);
    for (const c of conducts) {
      if (!inComp.has(c.a)) continue;
      const ia = at(c.a), ib = at(c.b);
      if (ia >= 0) A[ia][ia] += c.g;
      if (ib >= 0) A[ib][ib] += c.g;
      if (ia >= 0 && ib >= 0) { A[ia][ib] -= c.g; A[ib][ia] -= c.g; }
    }
    vs.forEach((v, k) => {
      const ip = at(v.plus), im = at(v.minus), row = n + k;
      if (ip >= 0) { A[row][ip] += 1; A[ip][row] += 1; }
      if (im >= 0) { A[row][im] -= 1; A[im][row] -= 1; }
      z[row] = v.volts;
    });
    for (const s of liveSinks) {
      if (!inComp.has(s.from)) continue;
      const ifr = at(s.from), ito = at(s.to);
      if (ifr >= 0) z[ifr] -= s.amps;
      if (ito >= 0) z[ito] += s.amps;
    }
    const x = gauss(A, z);
    if (!x) {
      findings.push({
        rule: "solve/unsolvable", severity: "info", category: "completeness", at: [nodes[0]],
        message: "A subcircuit's operating point couldn't be computed (singular system — usually a section with no path to its source). Skipped honestly.",
      });
      continue;
    }
    solved++;
    const volt = (name: string) => (name === ref ? 0 : x[idx.get(name)!]);
    for (const node of nodes) netVolts[node] = volt(node);
    for (const c of conducts) {
      if (!inComp.has(c.a)) continue;
      const dv = volt(c.a) - volt(c.b);
      const amps = dv * c.g;
      parts.push({ ref: c.ref, footprint: c.footprint, ohms: c.ohms, volts: Math.abs(dv), amps: Math.abs(amps), watts: dv * amps });
    }
    // nonlinear honesty: one note per subcircuit, only when something was actually left open
    const ignored = new Set<string>();
    for (const node of nodes) for (const r of nonlinearByNet.get(node) ?? []) ignored.add(r);
    if (ignored.size) {
      findings.push({
        rule: "solve/nonlinear-open", severity: "info", category: "completeness", at: [[...ignored][0]],
        message: `DC solve treated ${[...ignored].slice(0, 6).join(", ")}${ignored.size > 6 ? ` (+${ignored.size - 6} more)` : ""} as open (semiconductors/ICs aren't linear) — bias networks around them solve correctly; paths through them don't.`,
      });
    }
  }

  return { netVolts, parts, findings, solvedComponents: solved };
}
