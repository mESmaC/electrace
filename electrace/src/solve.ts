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
  ratingWatts?: number;      // declared rating beats footprint inference
  ohms: number;
  volts: number;             // across the part
  amps: number;
  watts: number;
}

export interface DcSolve {
  /** Solved node voltages by flat-net name — only nets inside solved subcircuits appear. */
  netVolts: Record<string, number>;
  /** "REF/<part>.<pin>" → flat-net name — self-asserts anchor to part pins (stable across
   *  layout re-derivation, where internal net NAMES are not). */
  pinNet: Record<string, string>;
  /** "REF.terminal" → flat-net name (from flatten) — the UI's lookup from a design net member. */
  termNet: Record<string, string>;
  /** Voltage across each capacitor whose two nets solved — feeds the cap voltage-rating rule. */
  caps: { ref: string; volts: number; ratingVolts?: number }[];
  /** Diodes/LEDs solved with the fixed-drop model. ON: amps = forward current. OFF: reverseV =
   *  the blocked voltage (checked against a declared PIV rating), and amps = leakage backflow
   *  when the part declares rating.leak — the µA that sneak through a "blocking" diode. */
  diodes: { ref: string; on: boolean; amps: number; vf: number; reverseV?: number; pivVolts?: number }[];
  /** Per boundary source: the current it actually delivers at this operating point. */
  sources: { node: string; instance: string; amps: number }[];
  /** standby mode only: supply inputs that declare an active draw but no iStandby (assumed 0). */
  undeclaredStandby: string[];
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

/** Options for solveDc. `inject` adds a test current INTO a node (Thévenin probing).
 *  `standby` solves the OFF state: declared load draws are replaced by declared iStandby
 *  (absent = 0) — resistive paths and diode leakage stay, because they never sleep. */
export interface DcSolveOpts { inject?: { node: string; amps: number }; standby?: boolean }

export function solveDc(rd: ResolvedDesign, opts?: DcSolveOpts): DcSolve {
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
  const conducts: { a: string; b: string; g: number; ohms: number; ref: string; footprint?: string; ratingWatts?: number }[] = [];
  const capPins: { ref: string; a: string; b: string; ratingVolts?: number }[] = [];
  // fixed-drop diode model: ON = ideal Vf source anode→cathode (current must flow forward),
  // OFF = open (anode-cathode voltage must stay below Vf). Solved by assumption-flipping
  // iteration — the textbook method, convergence capped honestly.
  const diodes: { ref: string; anode: string; cathode: string; vf: number; on: boolean; gRev?: number; pivVolts?: number }[] = [];
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
      conducts.push({ a, b, g: 1 / ohms, ohms, ref: p.ref, footprint: p.footprint, ratingWatts: p.rating?.watts });
    } else if (p.type === "diode" || p.type === "schottky" || p.type === "led") {
      const a = N(netOfPart(p.ref, "1")), b = N(netOfPart(p.ref, "2"));
      if (!a || !b || a === b) continue;
      const parsed = p.value != null ? parseValue(p.value) : null;
      const vf = parsed != null && parsed > 0.1 && parsed < 5 ? parsed
        : p.type === "led" ? 2.0 : p.type === "schottky" ? 0.3 : 0.7;
      // declared reverse leakage (datasheet I_R at V_R) → backflow resistance when OFF
      const lk = p.rating?.leak;
      const gRev = lk && lk.ua > 0 && lk.atVolts > 0 ? (lk.ua * 1e-6) / lk.atVolts : undefined;
      diodes.push({ ref: p.ref, anode: a, cathode: b, vf, on: true, gRev, pivVolts: p.rating?.volts });
    } else if (p.type === "cap" || p.type === "cap-pol" || p.type === "capacitor") {
      const a = N(netOfPart(p.ref, "1")), b = N(netOfPart(p.ref, "2"));
      if (a && b && a !== b) capPins.push({ ref: p.ref, a, b, ratingVolts: p.rating?.volts });
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
  for (const c of capPins) { c.a = uf.find(c.a); c.b = uf.find(c.b); }
  for (const d of diodes) { d.anode = uf.find(d.anode); d.cathode = uf.find(d.cathode); }

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

  const vsources: { plus: string; minus: string; volts: number; node: string; instance: string }[] = [];
  const isinks: { from: string; to: string; amps: number; node: string }[] = [];
  const undeclaredStandby: string[] = [];
  const seenSrc = new Set<string>();
  for (const net of rd.nets) {
    for (const s of net.sources) {
      const v = s.def.v;
      const volts = v?.value ?? v?.max;
      if (volts == null || seenSrc.has(s.node)) continue;
      const plus = N(nodeNet(s.node)), minus = gndNetOf(s.instance);
      if (!plus || !minus || plus === minus) continue;
      seenSrc.add(s.node);
      vsources.push({ plus, minus, volts, node: s.node, instance: s.instance });
    }
    for (const sk of net.sinks) {
      const amps = opts?.standby ? rmax(sk.pin.def.iStandby) ?? 0 : rmax(sk.current);
      if (opts?.standby && rmax(sk.pin.def.iStandby) == null && rmax(sk.current) != null) {
        undeclaredStandby.push(sk.pin.node);
      }
      if (amps == null || amps <= 0) continue;
      const from = N(nodeNet(sk.pin.node)), to = gndNetOf(sk.pin.instance);
      if (!from || !to || from === to) continue;
      isinks.push({ from, to, amps, node: sk.pin.node });
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
  for (const d of diodes) { touch(d.anode); touch(d.cathode); comp.union(d.anode, d.cathode); }
  for (const i of liveSinks) { touch(i.from); touch(i.to); comp.union(i.from, i.to); }

  const byComp = new Map<string, string[]>();
  for (const n of comp.keys()) {
    const root = comp.find(n);
    (byComp.get(root) ?? byComp.set(root, []).get(root)!).push(n);
  }

  const netVolts: Record<string, number> = {};
  const parts: DcPartResult[] = [];
  let solved = 0;

  const injectNet = opts?.inject
    ? (() => { const f = nodeNet(opts.inject!.node) ?? opts.inject!.node; return uf.find(f); })()
    : null;

  const diodeResults: DcSolve["diodes"] = [];
  const sourceResults: DcSolve["sources"] = [];
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
    const n = idx.size;
    const at = (name: string) => (name === ref ? -1 : idx.get(name)!);
    const compDiodes = diodes.filter((d) => inComp.has(d.anode));
    compDiodes.forEach((d) => { d.on = true; }); // optimistic start

    // fixed-drop iteration: solve under assumed diode states, flip violators, repeat.
    let x: number[] | null = null;
    let onList: typeof compDiodes = [];
    let converged = false;
    for (let iter = 0; iter < 10; iter++) {
      onList = compDiodes.filter((d) => d.on);
      const m = vs.length + onList.length;
      const A = Array.from({ length: n + m }, () => new Array(n + m).fill(0));
      const z = new Array(n + m).fill(0);
      for (const c of conducts) {
        if (!inComp.has(c.a)) continue;
        const ia = at(c.a), ib = at(c.b);
        if (ia >= 0) A[ia][ia] += c.g;
        if (ib >= 0) A[ib][ib] += c.g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= c.g; A[ib][ia] -= c.g; }
      }
      const stampV = (plus: string, minus: string, volts: number, row: number) => {
        const ip = at(plus), im = at(minus);
        if (ip >= 0) { A[row][ip] += 1; A[ip][row] += 1; }
        if (im >= 0) { A[row][im] -= 1; A[im][row] -= 1; }
        z[row] = volts;
      };
      vs.forEach((v, k) => stampV(v.plus, v.minus, v.volts, n + k));
      onList.forEach((d, j) => stampV(d.anode, d.cathode, d.vf, n + vs.length + j));
      for (const d of compDiodes) {
        if (d.on || !d.gRev) continue; // OFF + declared leakage = a real (huge) resistance, not a perfect open
        const ia = at(d.anode), ib = at(d.cathode);
        if (ia >= 0) A[ia][ia] += d.gRev;
        if (ib >= 0) A[ib][ib] += d.gRev;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= d.gRev; A[ib][ia] -= d.gRev; }
      }
      for (const s of liveSinks) {
        if (!inComp.has(s.from)) continue;
        const ifr = at(s.from), ito = at(s.to);
        if (ifr >= 0) z[ifr] -= s.amps;
        if (ito >= 0) z[ito] += s.amps;
      }
      if (injectNet && inComp.has(injectNet)) {
        const ii = at(injectNet);
        if (ii >= 0) z[ii] += opts!.inject!.amps; // current INTO the node
      }
      x = gauss(A, z);
      if (!x) break; // singular under these assumptions — report below
      const volt = (name: string) => (name === ref ? 0 : x![idx.get(name)!]);
      // check assumptions: ON diodes must conduct forward; OFF diodes must stay below Vf
      let flips = 0;
      onList.forEach((d, j) => {
        if (x![n + vs.length + j] < -1e-9) { d.on = false; flips++; }
      });
      for (const d of compDiodes) {
        if (d.on) continue; // ON diodes were checked via their current above
        if (volt(d.anode) - volt(d.cathode) > d.vf + 1e-6) { d.on = true; flips++; }
      }
      if (!flips) { converged = true; break; }
    }
    if (!x || !converged) {
      findings.push({
        rule: "solve/unsolvable", severity: "info", category: "completeness", at: [nodes[0]],
        message: !x
          ? "A subcircuit's operating point couldn't be computed (singular system — usually a section with no path to its source). Skipped honestly."
          : "A subcircuit's diode states wouldn't settle (oscillating assumptions) — its operating point was not computed.",
      });
      continue;
    }
    vs.forEach((v, k) => {
      // x[n+k] is the current leaving the + node INTO the source; delivering = negative → flip
      sourceResults.push({ node: v.node, instance: v.instance, amps: Math.max(0, -x![n + k]) });
    });
    {
      const volt = (name: string) => (name === ref ? 0 : x![idx.get(name)!]);
      for (const d of compDiodes) {
        const j = onList.indexOf(d);
        const reverseV = d.on ? 0 : Math.max(0, volt(d.cathode) - volt(d.anode));
        diodeResults.push({
          ref: d.ref, on: d.on, vf: d.vf,
          amps: d.on && j >= 0 ? Math.max(0, x[n + vs.length + j]) : d.gRev ? reverseV * d.gRev : 0,
          reverseV, pivVolts: d.pivVolts,
        });
      }
    }
    solved++;
    const volt = (name: string) => (name === ref ? 0 : x[idx.get(name)!]);
    for (const node of nodes) netVolts[node] = volt(node);
    for (const c of conducts) {
      if (!inComp.has(c.a)) continue;
      const dv = volt(c.a) - volt(c.b);
      const amps = dv * c.g;
      parts.push({ ref: c.ref, footprint: c.footprint, ratingWatts: c.ratingWatts, ohms: c.ohms, volts: Math.abs(dv), amps: Math.abs(amps), watts: dv * amps });
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

  // pre-merge flat names alias to their solved root (shorts merged names away; lookups shouldn't care)
  for (const net of flat.nets) {
    const root = uf.find(net.name);
    if (netVolts[net.name] == null && netVolts[root] != null) netVolts[net.name] = netVolts[root];
  }

  const caps: DcSolve["caps"] = [];
  for (const c of capPins) {
    const va = netVolts[c.a], vb = netVolts[c.b];
    if (va == null || vb == null) continue; // both ends must be in solved subcircuits
    caps.push({ ref: c.ref, volts: Math.abs(va - vb), ratingVolts: c.ratingVolts });
  }

  return { netVolts, pinNet: Object.fromEntries(pinNet), termNet, caps, diodes: diodeResults, sources: sourceResults, undeclaredStandby, parts, findings, solvedComponents: solved };
}


/** Thévenin equivalent seen from a node — stage 2 of the analysis ladder, and exactly two
 *  solver runs: Voc from the normal operating point, then inject a 1 A test current and read
 *  the voltage rise (Rth = ΔV / 1 A). node = "REF.terminal" or a flat-net name. Returns null
 *  when the node isn't in a solvable subcircuit. NOTE: linear elements only — conducting
 *  diodes are treated at their fixed drop, which is the standard small-signal simplification. */
export function theveninAt(rd: ResolvedDesign, node: string): { voc: number; rth: number; isc: number } | null {
  const base = solveDc(rd);
  const flat = base.termNet[node] ?? base.pinNet[node] ?? node;
  const voc = base.netVolts[flat];
  if (voc == null) return null;
  const probed = solveDc(rd, { inject: { node, amps: 1 } });
  const v2 = probed.netVolts[flat];
  if (v2 == null) return null;
  const rth = Math.max(0, v2 - voc); // ΔV per 1 A; tiny negative = numerical noise
  return { voc, rth, isc: rth > 1e-9 ? voc / rth : Infinity };
}


export interface StandbyReport {
  /** Per boundary source: the always-on floor it supplies when everything sleeps. */
  perSource: {
    node: string;            // "BAT1.vout"
    instance: string;
    amps: number;
    /** What's still drawing: resistive paths (they never sleep), diode leakage, declared sleep draws. */
    contributors: { label: string; amps: number; kind: "resistive" | "leakage" | "standby" }[];
    /** Days the declared capacity survives this floor — only when the source block declares
     *  a capacity spec (any spec key matching /mah|capacity/i). */
    lifeDays?: number;
  }[];
  /** Supply inputs that declare an active draw but no iStandby — assumed 0, honestly flagged. */
  undeclared: string[];
  findings: Finding[];
}

/** The standby/off-state draw floor — Cameron's "off doesn't mean no draw". Pure solved
 *  arithmetic: dividers, pull-ups, and leakage have no sleep mode; declared iStandby covers
 *  what does. NOT modeled (and said so): logic-state-dependent draws and charging circuits —
 *  this number is the MINIMUM your design can never beat. */
export function standbyDraw(rd: ResolvedDesign): StandbyReport {
  const sol = solveDc(rd, { standby: true });
  const contributors: StandbyReport["perSource"][number]["contributors"] = [];
  for (const p of sol.parts) if (p.amps > 1e-9) contributors.push({ label: `${p.ref} (${p.ohms} Ω path)`, amps: p.amps, kind: "resistive" });
  for (const d of sol.diodes) {
    if (d.on && d.amps > 1e-9) contributors.push({ label: `${d.ref} (conducting)`, amps: d.amps, kind: "resistive" });
    else if (!d.on && d.amps > 1e-9) contributors.push({ label: `${d.ref} (reverse leakage)`, amps: d.amps, kind: "leakage" });
  }
  for (const net of rd.nets) {
    for (const sk of net.sinks) {
      const a = sk.pin.def.iStandby;
      const amps = a?.max ?? a?.value;
      if (amps != null && amps > 0) contributors.push({ label: `${sk.pin.node} (declared sleep draw)`, amps, kind: "standby" });
    }
  }
  contributors.sort((a, b) => b.amps - a.amps);
  const perSource = sol.sources.filter((s) => s.amps > 1e-9).map((s) => {
    const inst = rd.instances.find((i) => i.ref === s.instance);
    let lifeDays: number | undefined;
    for (const [k, v] of Object.entries(inst?.def.spec ?? {})) {
      if (!/mah|capacity/i.test(k)) continue;
      const mah = typeof v === "number" ? v : typeof v === "object" && v !== null ? (v as { value?: number }).value : undefined;
      if (mah && mah > 0) { lifeDays = (mah / 1000) / s.amps / 24; break; }
    }
    // single-source designs (the battery norm): every contributor is theirs. Multi-source
    // attribution is graph work — v1 reports the shared list rather than guessing splits.
    return { node: s.node, instance: s.instance, amps: s.amps, contributors, lifeDays };
  });
  return { perSource, undeclared: sol.undeclaredStandby, findings: sol.findings };
}
