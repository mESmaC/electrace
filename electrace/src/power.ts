import { rmax, rmin } from "./types.js";
import type { ResolvedDesign, ResolvedNet, Range } from "./types.js";

export interface TransformPower {
  vIn: number;   // worst-case (min) input voltage used for the current calc
  vOut: number;
  iOut: number;  // total load current on the output rail
  pOut: number;  // W
  pIn: number;   // W (= pOut / efficiency)
  iIn: number;   // A drawn from the input (worst case, at vIn min)
}
export interface PowerReport {
  transforms: Record<string, TransformPower>;
}

const valueOf = (r?: Range) => r?.value ?? r?.max ?? r?.min;
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Propagate power backward through transform blocks (regulators) so the input-side
 * current is known: P_in = P_out / efficiency, I_in = P_in / V_in(min, worst case).
 * Annotates each transform's input sink with its derived current so the current rules
 * can check the input rail too. Deterministic arithmetic on declared values — not a sim.
 */
export function annotatePower(rd: ResolvedDesign): PowerReport {
  const report: PowerReport = { transforms: {} };

  const netOfPin = new Map<string, ResolvedNet>();
  for (const net of rd.nets) for (const m of net.members) netOfPin.set(m.node, net);

  const transforms = rd.instances.filter((i) => i.def.transform);
  const transformRefs = new Set(transforms.map((t) => t.ref));
  const memo = new Map<string, number>();
  const inStack = new Set<string>();

  function inputCurrent(ref: string): number {
    if (memo.has(ref)) return memo.get(ref)!;
    if (inStack.has(ref)) return 0; // cycle guard
    inStack.add(ref);

    const inst = transforms.find((t) => t.ref === ref)!;
    const eff = inst.def.transform!.efficiency;
    const outTerm = inst.def.terminals.find((t) => t.role === "out" && (t.type === "rail" || t.type === "power"));
    const inTerm = inst.def.terminals.find((t) => t.role === "in" && (t.type === "power" || t.type === "rail"));
    if (!outTerm || !inTerm) { inStack.delete(ref); memo.set(ref, 0); return 0; }

    const vOut = valueOf(outTerm.v) ?? 0;
    const vIn = rmin(inTerm.v) ?? valueOf(inTerm.v) ?? 0;
    const outNet = netOfPin.get(`${ref}.${outTerm.id}`);

    let iOut = 0;
    if (outNet) {
      for (const s of outNet.sinks) {
        if (s.pin.instance === ref) continue;
        iOut += transformRefs.has(s.pin.instance)
          ? inputCurrent(s.pin.instance)        // downstream regulator → recurse
          : (rmax(s.current) ?? 0);             // plain consumer
      }
    }

    const pOut = vOut * iOut;
    const pIn = eff > 0 ? pOut / eff : pOut;
    const iIn = vIn > 0 ? pIn / vIn : 0;
    report.transforms[ref] = {
      vIn, vOut, iOut: round(iOut), pOut: round(pOut), pIn: round(pIn), iIn: round(iIn),
    };
    memo.set(ref, iIn);
    inStack.delete(ref);
    return iIn;
  }

  for (const t of transforms) {
    const iIn = inputCurrent(t.ref);
    const inTerm = t.def.terminals.find((x) => x.role === "in" && (x.type === "power" || x.type === "rail"));
    if (!inTerm) continue;
    const inNet = netOfPin.get(`${t.ref}.${inTerm.id}`);
    const sink = inNet?.sinks.find((s) => s.pin.instance === t.ref && s.pin.terminal === inTerm.id);
    if (sink) sink.current = { value: round(iIn), unit: "A" };
  }

  return report;
}
