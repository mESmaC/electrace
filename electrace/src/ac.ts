// Stage 3 of the analysis ladder: phasor steady-state AC. The same MNA as solve.ts with
// complex admittances at a chosen frequency — closed-form, deterministic, explainable.
// NOT transient simulation: we answer "what does this network do to a sinusoid at f?",
// which buys real filter response from the user's actual schematic, impedance at a port,
// and resonance found where it actually lives.
//
// Honesty rules (same charter as the DC solver):
//  · R → 1/R, C → jωC, L → 1/jωL (the parts that ARE the frequency behavior)
//  · ideal declared DC sources are AC-shorted (superposition — a stiff rail is AC ground)
//  · nonlinear parts (diodes, transistors, chips) stay OPEN and are NOTED, never linearized
//    by guesswork — small-signal models need bias data we don't pretend to have
//  · ferrites/fuses stay shorts (a ferrite's real Z(f) needs a part model; "short" is the
//    honest floor, and the note says so when one is present)
import type { ResolvedDesign, FlatSchematic } from "./types.js";
import { flatten } from "./flatten.js";
import { parseValue } from "./values.js";
import { UnionFind } from "./uf.js";

// ── tiny complex kit (no deps) ───────────────────────────────────────────────────────────
export interface Cx { re: number; im: number }
const cx = (re: number, im = 0): Cx => ({ re, im });
const cadd = (a: Cx, b: Cx): Cx => cx(a.re + b.re, a.im + b.im);
const csub = (a: Cx, b: Cx): Cx => cx(a.re - b.re, a.im - b.im);
const cmul = (a: Cx, b: Cx): Cx => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a: Cx, b: Cx): Cx => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = (a: Cx): number => Math.hypot(a.re, a.im);

const SHORT_AT_AC = new Set(["ferrite", "fuse"]); // honest floors — see header
const ZERO = 1e-12;

interface AcNetwork {
  nodes: string[];                       // flat net names (ground excluded per solve)
  ys: { a: string; b: string; y: (w: number) => Cx; ref: string }[];
  grounded: Set<string>;                 // nets AC-shorted to reference (declared DC source terminals)
  open: string[];                        // nonlinear parts left open (refs, for the notes)
  ferrites: string[];
  flat: FlatSchematic;
}

function buildNetwork(rd: ResolvedDesign): AcNetwork {
  const flat = flatten(rd);
  const pinNet = new Map<string, string>();
  for (const net of flat.nets) for (const p of net.pins) pinNet.set(p, net.name);
  const uf = new UnionFind();
  for (const net of flat.nets) uf.add(net.name);
  const netOfPart = (ref: string, pin: string) => pinNet.get(`${ref}.${pin}`);
  // hard shorts merge first (0 Ω resistors, fuses, ferrites, closed paths)
  for (const p of flat.parts) {
    const a = netOfPart(p.ref, "1"), b = netOfPart(p.ref, "2");
    if (!a || !b) continue;
    if (SHORT_AT_AC.has(p.type)) { uf.union(a, b); continue; }
    if (p.type === "res" && p.value != null && parseValue(p.value) === 0) uf.union(a, b);
  }
  const N = (n?: string) => (n ? uf.find(n) : undefined);

  const ys: AcNetwork["ys"] = [];
  const open: string[] = [];
  const ferrites: string[] = [];
  for (const p of flat.parts) {
    const a = N(netOfPart(p.ref, "1")), b = N(netOfPart(p.ref, "2"));
    if (SHORT_AT_AC.has(p.type)) { if (p.type === "ferrite") ferrites.push(p.ref); continue; }
    if (!a || !b || a === b) continue;
    const v = p.value != null ? parseValue(p.value) : null;
    if (p.type === "res") {
      if (v != null && isFinite(v) && v > 0) ys.push({ a, b, y: () => cx(1 / v), ref: p.ref });
    } else if (p.type === "cap" || p.type === "cap-pol" || p.type === "capacitor") {
      if (v != null && isFinite(v) && v > 0) ys.push({ a, b, y: (w) => cx(0, w * v), ref: p.ref });
    } else if (p.type === "inductor") {
      if (v != null && isFinite(v) && v > 0) ys.push({ a, b, y: (w) => cx(0, -1 / (w * v)), ref: p.ref });
    } else {
      open.push(p.ref); // diodes, transistors, chips, crystals… honest opens at small signal
    }
  }

  // declared DC source terminals: ideal rails are AC ground (superposition)
  const grounded = new Set<string>();
  for (const net of rd.nets) {
    for (const s of net.sources) {
      const v = s.def.v;
      if (v?.value == null && v?.max == null) continue;
      const flatN = N(flat.termNet?.[s.node] ?? pinNet.get(s.node));
      if (flatN) grounded.add(flatN);
    }
    // gnd-typed nets are reference by definition
    if (net.type === "gnd") {
      for (const m of net.members) {
        const flatN = N(flat.termNet?.[m.node] ?? pinNet.get(m.node));
        if (flatN) grounded.add(flatN);
      }
    }
  }

  const nodes = [...new Set(ys.flatMap((e) => [e.a, e.b]))].filter((n) => !grounded.has(n));
  return { nodes, ys, grounded, open, ferrites, flat };
}

/** Solve node phasor voltages with a 1∠0 V drive on `driveNet`. Returns net → Cx. */
function solveAt(net: AcNetwork, w: number, driveNet: string): Map<string, Cx> | null {
  const idx = new Map<string, number>();
  for (const n of net.nodes) if (n !== driveNet) idx.set(n, idx.size);
  const n = idx.size;
  // dense complex Y matrix + current vector (drive enters as known-voltage elimination)
  const A: Cx[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => cx(0)));
  const I: Cx[] = Array.from({ length: n }, () => cx(0));
  for (const e of net.ys) {
    const y = e.y(w);
    const ia = idx.get(e.a), ib = idx.get(e.b);
    const aG = net.grounded.has(e.a) || e.a === driveNet ? null : ia;
    const bG = net.grounded.has(e.b) || e.b === driveNet ? null : ib;
    if (aG != null) A[aG][aG] = cadd(A[aG][aG], y);
    if (bG != null) A[bG][bG] = cadd(A[bG][bG], y);
    if (aG != null && bG != null) { A[aG][bG] = csub(A[aG][bG], y); A[bG][aG] = csub(A[bG][aG], y); }
    // a neighbor pinned at the 1∠0 drive contributes a known current
    if (aG != null && e.b === driveNet) I[aG] = cadd(I[aG], y);
    if (bG != null && e.a === driveNet) I[bG] = cadd(I[bG], y);
  }
  // gaussian elimination, partial pivot on |·|
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (cabs(A[r][c]) > cabs(A[piv][c])) piv = r;
    if (cabs(A[piv][c]) < ZERO) return null;
    if (piv !== c) { [A[piv], A[c]] = [A[c], A[piv]]; [I[piv], I[c]] = [I[c], I[piv]]; }
    for (let r = c + 1; r < n; r++) {
      if (cabs(A[r][c]) < ZERO) continue;
      const f = cdiv(A[r][c], A[c][c]);
      for (let k = c; k < n; k++) A[r][k] = csub(A[r][k], cmul(f, A[c][k]));
      I[r] = csub(I[r], cmul(f, I[c]));
    }
  }
  const x: Cx[] = Array.from({ length: n }, () => cx(0));
  for (let r = n - 1; r >= 0; r--) {
    let s = I[r];
    for (let k = r + 1; k < n; k++) s = csub(s, cmul(A[r][k], x[k]));
    x[r] = cdiv(s, A[r][r]);
  }
  const out = new Map<string, Cx>();
  for (const [name, i] of idx) out.set(name, x[i]);
  out.set(driveNet, cx(1));
  for (const g of net.grounded) out.set(g, cx(0));
  return out;
}

export interface AcPoint { f: number; mag: number; db: number; phaseDeg: number }
export interface AcResponse {
  points: AcPoint[];
  notes: string[];   // honesty: which parts were left open / floored
}

/** Resolve a "REF.term" (or flat net name) to its flat net. */
function flatNetOf(rd: ResolvedDesign, flat: FlatSchematic, node: string): string | undefined {
  return flat.termNet?.[node] ?? (flat.nets.some((n) => n.name === node) ? node : undefined);
}

/** H(jω) from `from` to `to` (terminal nodes "REF.term" or net names) across `freqs` Hz.
 *  Drive: 1∠0 V at `from` (relative to ground/AC-grounded rails); response read at `to`. */
export function frequencyResponse(rd: ResolvedDesign, from: string, to: string, freqs: number[]): AcResponse | { error: string } {
  const net = buildNetwork(rd);
  const a = flatNetOf(rd, net.flat, from), b = flatNetOf(rd, net.flat, to);
  if (!a) return { error: `Unknown input node "${from}".` };
  if (!b) return { error: `Unknown output node "${to}".` };
  if (net.grounded.has(a)) return { error: `"${from}" is AC ground here (a declared DC rail or gnd) — drive a signal node instead.` };
  const points: AcPoint[] = [];
  for (const f of freqs) {
    const sol = solveAt(net, 2 * Math.PI * Math.max(f, 1e-3), a);
    if (!sol) return { error: "The network is singular at this frequency — likely a floating section (everything nonlinear is open at AC)." };
    const h = sol.get(b) ?? cx(0);
    const mag = cabs(h);
    points.push({ f, mag, db: 20 * Math.log10(Math.max(mag, 1e-12)), phaseDeg: Math.atan2(h.im, h.re) * 180 / Math.PI });
  }
  const notes: string[] = [];
  if (net.open.length) notes.push(`Open at AC (nonlinear, no small-signal guessing): ${net.open.slice(0, 8).join(", ")}${net.open.length > 8 ? "…" : ""}.`);
  if (net.ferrites.length) notes.push(`Ferrites treated as shorts (${net.ferrites.join(", ")}) — real Z(f) needs a part model.`);
  notes.push("Ideal declared rails are AC ground (superposition).");
  return { points, notes };
}

/** Impedance seen looking into `node` at each frequency: inject 1∠0 A, Z = V. */
export function impedanceAt(rd: ResolvedDesign, node: string, freqs: number[]): { points: { f: number; ohms: number; phaseDeg: number }[]; notes: string[] } | { error: string } {
  const net = buildNetwork(rd);
  const a = flatNetOf(rd, net.flat, node);
  if (!a) return { error: `Unknown node "${node}".` };
  if (net.grounded.has(a)) return { error: `"${node}" is AC ground here — its small-signal impedance is 0 by declaration.` };
  const points: { f: number; ohms: number; phaseDeg: number }[] = [];
  for (const f of freqs) {
    const w = 2 * Math.PI * Math.max(f, 1e-3);
    // current injection: solve with the same matrix but unit current at `a` — reuse the
    // voltage-drive solver via the reciprocal trick is fiddly; build directly instead.
    const idx = new Map<string, number>();
    for (const n of net.nodes) idx.set(n, idx.size);
    if (!idx.has(a)) { points.push({ f, ohms: Infinity, phaseDeg: 0 }); continue; }
    const n = idx.size;
    const A: Cx[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => cx(0)));
    const I: Cx[] = Array.from({ length: n }, () => cx(0));
    for (const e of net.ys) {
      const y = e.y(w);
      const ia = net.grounded.has(e.a) ? null : idx.get(e.a)!;
      const ib = net.grounded.has(e.b) ? null : idx.get(e.b)!;
      if (ia != null) A[ia][ia] = cadd(A[ia][ia], y);
      if (ib != null) A[ib][ib] = cadd(A[ib][ib], y);
      if (ia != null && ib != null) { A[ia][ib] = csub(A[ia][ib], y); A[ib][ia] = csub(A[ib][ia], y); }
    }
    I[idx.get(a)!] = cx(1);
    let singular = false;
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (cabs(A[r][c]) > cabs(A[piv][c])) piv = r;
      if (cabs(A[piv][c]) < ZERO) { singular = true; break; }
      if (piv !== c) { [A[piv], A[c]] = [A[c], A[piv]]; [I[piv], I[c]] = [I[c], I[piv]]; }
      for (let r = c + 1; r < n; r++) {
        if (cabs(A[r][c]) < ZERO) continue;
        const fct = cdiv(A[r][c], A[c][c]);
        for (let k = c; k < n; k++) A[r][k] = csub(A[r][k], cmul(fct, A[c][k]));
        I[r] = csub(I[r], cmul(fct, I[c]));
      }
    }
    if (singular) { points.push({ f, ohms: Infinity, phaseDeg: 0 }); continue; }
    const x: Cx[] = Array.from({ length: n }, () => cx(0));
    for (let r = n - 1; r >= 0; r--) {
      let s = I[r];
      for (let k = r + 1; k < n; k++) s = csub(s, cmul(A[r][k], x[k]));
      x[r] = cdiv(s, A[r][r]);
    }
    const v = x[idx.get(a)!];
    points.push({ f, ohms: cabs(v), phaseDeg: Math.atan2(v.im, v.re) * 180 / Math.PI });
  }
  const notes: string[] = [];
  if (net.open.length) notes.push(`Open at AC: ${net.open.slice(0, 8).join(", ")}${net.open.length > 8 ? "…" : ""}.`);
  return { points, notes };
}

/** A standard log sweep, decade-spaced: 10^a … 10^b with `perDecade` points. */
export function logSweep(fStart: number, fEnd: number, perDecade = 20): number[] {
  const out: number[] = [];
  const a = Math.log10(fStart), b = Math.log10(fEnd);
  const n = Math.max(2, Math.round((b - a) * perDecade));
  for (let i = 0; i <= n; i++) out.push(10 ** (a + (b - a) * (i / n)));
  return out;
}
