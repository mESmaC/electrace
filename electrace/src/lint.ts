import { rmax } from "./types.js";
import type { Finding, ResolvedDesign, Rule, Range } from "./types.js";

// ── Faults (deterministic arithmetic / threshold) ──────────────────────────

/** An exposed terminal wired to nothing — unless it's declared off-board (externally driven). */
const openNet: Rule = (rd) =>
  rd.nets
    .filter((net) => net.open && !net.members.some((p) => p.def.external))
    .map((net) => {
      const p = net.members[0];
      return {
        rule: "connectivity/open-net",
        severity: "warn",
        category: "connectivity",
        at: [p.node],
        message: `${p.instance}.${p.terminal} (${p.def.type}) isn't wired to anything yet.`,
        fix: { label: "Connect it, or mark it unused" },
      } satisfies Finding;
    });

/** Σ declared sink current on a power/rail net vs the source's declared capability. */
const overCurrent: Rule = (rd) =>
  rd.nets
    .filter((net) => net.type === "rail" || net.type === "power")
    .flatMap((net): Finding[] => {
      const src = net.sources.find((s) => rmax(s.def.i) != null);
      if (!src) return [];
      const cap = rmax(src.def.i)!;
      const draw = net.sinks.reduce((a, s) => a + (rmax(s.current) ?? 0), 0);
      if (draw > cap)
        return [{
          rule: "current/over-budget", severity: "error", category: "current", at: [net.id],
          message: `${net.id} needs ${round(draw)} A but its source provides ${cap} A.`,
          derivation: `Σ sinks = ${round(draw)} A  >  source ${cap} A`,
        } satisfies Finding];
      if (draw > 0.85 * cap)
        return [{
          rule: "current/over-budget", severity: "warn", category: "current", at: [net.id],
          message: `${net.id} works, but only ${round(cap - draw)} A spare.`,
          derivation: `${round(draw)} A of ${cap} A used`,
        } satisfies Finding];
      return [];
    });

/** A net's worst-case voltage exceeds a connected input's accepted max. */
const overVoltage: Rule = (rd) =>
  rd.nets.flatMap((net) => {
    const v = rmax(net.voltage);
    if (v == null) return [];
    return net.sinks.flatMap((s) => {
      const lim = rmax(s.pin.def.v);
      if (lim != null && v > lim + 1e-9)
        return [{
          rule: "voltage/over-input", severity: "error", category: "voltage",
          at: [net.id, s.pin.node],
          message: `${net.id} can reach ${v} V but ${s.pin.instance}.${s.pin.terminal} accepts max ${lim} V.`,
          derivation: `net ${v} V  >  input max ${lim} V`,
        } satisfies Finding];
      return [];
    });
  });

// ── Recommendations (curated expert rules-of-thumb; advisory) ───────────────

/** A linear regulator dropping a lot of voltage at current burns it as heat. */
const lowEfficiency: Rule = (rd) =>
  rd.instances.flatMap((inst): Finding[] => {
    const b = inst.def;
    if (b.topology !== "linear" || !b.spec) return [];
    const vin = rmax(b.spec.vin as Range);
    const vout = num(b.spec.vout);
    const iout = num(b.spec.iout_max);
    if (vin == null || vout == null || iout == null) return [];
    const diss = (vin - vout) * iout;
    if (diss <= 1) return [];
    return [{
      rule: "thermal/low-efficiency", severity: "recommendation", category: "thermal",
      at: [inst.ref],
      message: `${inst.ref} (${b.name}) burns ~${round(diss)} W as heat dropping ${vin}→${vout} V at ${iout} A. A switching regulator would run far cooler.`,
      derivation: `(${vin} − ${vout}) V × ${iout} A = ${round(diss)} W dissipated`,
    } satisfies Finding];
  });

/** Recommend test points on the main power-entry rail (+ its ground). */
const testPoints: Rule = (rd) =>
  rd.nets
    .filter((net) => net.type === "power")
    .flatMap((net): Finding[] => {
      // crude "main entry" heuristic: a power net driven by a source with no upstream sink
      if (net.sources.length === 0) return [];
      return [{
        rule: "debug/test-points", severity: "recommendation", category: "debug", at: [net.id],
        message: `This looks like your main power-entry rail. Add a test point on both ${net.id} and ground — if the board ever won't power up, the fastest first thing to rule out is whether it's getting ample power.`,
        fix: { label: "Add power + ground test points" },
      } satisfies Finding];
    });

/** Power/rail terminal tied to ground (or mixed polarity) — likely a wiring error. */
const polarityConflict: Rule = (rd) =>
  rd.nets.flatMap((net): Finding[] => {
    const hasHot = net.members.some((m) => m.def.type === "power" || m.def.type === "rail");
    const hasGnd = net.members.some((m) => m.def.type === "gnd");
    if (hasHot && hasGnd)
      return [{
        rule: "polarity/conflict", severity: "error", category: "polarity", at: [net.id],
        message: `${net.id} ties a power/signal terminal straight to ground — check the wiring.`,
      }];
    const pols = new Set(net.members.map((m) => m.def.polarity).filter(Boolean));
    if (pols.has("+") && pols.has("-"))
      return [{
        rule: "polarity/conflict", severity: "error", category: "polarity", at: [net.id],
        message: `${net.id} mixes + and − polarity terminals.`,
      }];
    return [];
  });

/** A source rated far above its actual load → suggest a smaller, cheaper part. */
const underUtilized: Rule = (rd) =>
  rd.nets
    .filter((net) => net.type === "rail" || net.type === "power")
    .flatMap((net): Finding[] => {
      const src = net.sources.find((s) => rmax(s.def.i) != null);
      if (!src) return [];
      const cap = rmax(src.def.i)!;
      const draw = net.sinks.reduce((a, s) => a + (rmax(s.current) ?? 0), 0);
      if (cap > 0 && draw > 0 && draw < 0.4 * cap)
        return [{
          rule: "current/under-utilized", severity: "recommendation", category: "current", at: [net.id],
          message: `${net.id}'s source is rated ${cap} A but only ~${round(draw)} A is used — a smaller, cheaper part would do.`,
          derivation: `${round(draw)} A of ${cap} A (${Math.round((draw / cap) * 100)} %)`,
        }];
      return [];
    });

// ── Registry ────────────────────────────────────────────────────────────────

export const RULES: Rule[] = [
  openNet, overCurrent, overVoltage, polarityConflict,   // faults
  lowEfficiency, underUtilized, testPoints,              // recommendations
];

const SEVERITY_ORDER = { error: 0, warn: 1, recommendation: 2, info: 3, unknown: 4 } as const;

/** Run every rule and return findings, most severe first. */
export function lint(rd: ResolvedDesign): Finding[] {
  return RULES.flatMap((rule) => rule(rd))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// helpers
function num(x: unknown): number | undefined {
  if (typeof x === "number") return x;
  if (x && typeof x === "object" && "value" in (x as Range)) return (x as Range).value;
  return undefined;
}
function round(n: number): number { return Math.round(n * 100) / 100; }
