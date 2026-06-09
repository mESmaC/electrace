import { rmax } from "./types.js";
import { CONNECTOR_CATALOG } from "./connectors.js";
import type { Finding, ResolvedDesign, ResolvedNet, ResolvedPin, Rule, Range } from "./types.js";

// ── Faults (deterministic arithmetic / threshold) ──────────────────────────

/** An exposed terminal wired to nothing — unless it's declared off-board (externally driven). */
const openNet: Rule = (rd) =>
  rd.nets
    .filter((net) => net.open && !net.external)
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

/** Two or more drivers on one net — a conflict unless they're diode-OR'd / open-drain / load-shared. */
const multipleDrivers: Rule = (rd) =>
  rd.nets
    .filter((net) => net.type !== "gnd" && net.sources.length >= 2)
    .map((net) => ({
      rule: "connectivity/multiple-drivers", severity: "warn", category: "connectivity", at: [net.id],
      message: `${net.id} has ${net.sources.length} drivers (${net.sources.map((s) => `${s.instance}.${s.terminal}`).join(", ")}) — fine if they're diode-OR'd or open-drain, otherwise two outputs are fighting.`,
    } satisfies Finding));

/** A power/rail net feeding loads with nothing driving it (and not declared off-board). */
const undrivenRail: Rule = (rd) =>
  rd.nets
    .filter((net) => (net.type === "power" || net.type === "rail")
      && net.sinks.length >= 1 && net.sources.length === 0 && !net.external)
    .map((net) => ({
      rule: "connectivity/undriven-rail", severity: "warn", category: "connectivity", at: [net.id],
      message: `${net.id} powers ${net.sinks.length} load${net.sinks.length === 1 ? "" : "s"} but nothing drives it — connect a source, or mark it off-board.`,
    } satisfies Finding));

/** A placed block with no internal parts — an interface shell that won't appear in the BOM yet.
 *  Info-level: hollow blocks are a legitimate top-down step, but the analyzer should say so out loud
 *  so "0 errors" can't hide a board that's missing its real components. */
const emptyBlock: Rule = (rd) =>
  rd.instances
    .filter((inst) => !inst.def.schematic?.parts?.length)
    .map((inst) => ({
      rule: "completeness/empty-block", severity: "info", category: "completeness", at: [inst.ref],
      message: `${inst.ref} (${inst.def.name}) has no components yet — it's an interface shell, so it won't appear in the BOM. Populate it with the real part(s).`,
      fix: { label: "Assign the part(s) this block represents" },
    } satisfies Finding));

/** A multi-pin connector with every pin wired — no spare. Often fine, but when a signal elsewhere is
 *  left unconnected, running out of connector pins is usually why (it can't silently grow past its pin
 *  count). Advisory, and only for connectors big enough that being maxed is noteworthy (≥6 pins) so a
 *  2-pin power jack doesn't nag. */
const connectorFull: Rule = (rd) => {
  const out: Finding[] = [];
  for (const conn of rd.design.connectors ?? []) {
    const part = CONNECTOR_CATALOG[conn.connector];
    if (!part || part.pins.length < 6) continue;
    const used = new Set<string>();
    for (const c of rd.design.connections) for (const ep of [c.from, c.to]) {
      const d = ep.indexOf(".");
      if (d > 0 && ep.slice(0, d) === conn.ref) used.add(ep.slice(d + 1));
    }
    if (used.size >= part.pins.length) out.push({
      rule: "completeness/connector-full", severity: "recommendation", category: "completeness", at: [conn.ref],
      message: `${conn.ref} (${part.name}) is full — all ${part.pins.length} pins wired, no spare. If a signal is left unconnected elsewhere, you've likely run out of pins here; size up the connector.`,
    });
  }
  return out;
};

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

/** A block whose OWN terminals are shorted together inside it — the internal schematic ties two
 *  exposed terminals of incompatible declared voltage (a 5 V rail to a 3.3 V rail) or a rail to ground
 *  onto one net. Resolve's intra-block equivalence then collapses those rails across the whole design,
 *  which surfaces downstream as phantom over-voltage / multiple-driver / polarity findings on the user's
 *  wiring. This points at the actual cause — the block — so those symptoms make sense. Usually a
 *  hollow/auto-generated block with an invalid internal net. */
/** Find every net where one instance shorts two of its own incompatible terminals together. Shared by
 *  the `internalShort` rule (to report it) and by `lint()` (to suppress the phantom symptoms it causes). */
function internalShorts(rd: ResolvedDesign): { net: ResolvedNet; inst: string; a: ResolvedPin; b: ResolvedPin }[] {
  const out: { net: ResolvedNet; inst: string; a: ResolvedPin; b: ResolvedPin }[] = [];
  for (const net of rd.nets) {
    const byInst = new Map<string, ResolvedPin[]>();
    for (const p of net.members) {
      const g = byInst.get(p.instance);
      if (g) g.push(p); else byInst.set(p.instance, [p]);
    }
    for (const [inst, pins] of byInst) {
      if (pins.length < 2) continue;
      for (let i = 0; i < pins.length; i++)
        for (let j = i + 1; j < pins.length; j++) {
          const a = pins[i], b = pins[j];
          const va = rmax(a.def.v), vb = rmax(b.def.v);
          const vClash = va != null && vb != null && Math.abs(va - vb) > 1e-9;
          const gndA = a.def.type === "gnd", gndB = b.def.type === "gnd";
          const hotA = a.def.type === "power" || a.def.type === "rail";
          const hotB = b.def.type === "power" || b.def.type === "rail";
          if (vClash || (gndA && hotB) || (gndB && hotA)) { out.push({ net, inst, a, b }); i = pins.length; break; }
        }
    }
  }
  return out;
}

const internalShort: Rule = (rd) =>
  internalShorts(rd).map(({ net, inst, a, b }): Finding => {
    const lbl = (p: ResolvedPin) => { const v = rmax(p.def.v); return v != null ? `${p.terminal} (${v} V)` : `${p.terminal} (${p.def.type})`; };
    const blk = rd.instances.find((x) => x.ref === inst);
    return {
      rule: "connectivity/internal-short", severity: "error", category: "connectivity",
      at: [inst, a.node, b.node],
      message: `${inst}${blk ? ` (${blk.def.name})` : ""} internally ties ${lbl(a)} and ${lbl(b)} to the same net (${net.id}) — the block's own terminals are shorted, so its rails collapse together across the design. Fix ${inst}'s internal schematic.`,
    };
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
  openNet, overCurrent, overVoltage, polarityConflict, multipleDrivers, undrivenRail, internalShort, // faults
  lowEfficiency, underUtilized, testPoints, emptyBlock, connectorFull,  // recommendations + completeness
];

const SEVERITY_ORDER = { error: 0, warn: 1, recommendation: 2, info: 3, unknown: 4 } as const;

/** A finding's identity: its rule + the subjects it points at (order-independent). Used by the UI to
 *  toggle a single finding's acknowledgement. */
export const findingKey = (f: { rule: string; at: string[] }): string => `${f.rule}@${[...f.at].sort().join(",")}`;

/** Does an acknowledgement cover this finding? Same rule, and every subject the finding points at is
 *  within the ack's `at`. Subset (not exact) so ONE grouped ack — e.g. all 16 SPI pins listed together
 *  — mutes each per-net open-net finding (which points at a single pin), not just an identical set. */
const ackCovers = (ack: { rule: string; at: string[] }, f: { rule: string; at: string[] }): boolean => {
  if (ack.rule !== f.rule || !f.at.length) return false;
  const set = new Set(ack.at);
  return f.at.every((x) => set.has(x));
};

/** Run every rule and return findings, most severe first. Findings the user/agent marked intended
 *  (design.acks) are flagged `acknowledged` (with the note) so consumers can mute them and drop them
 *  from the error/warning counts — keeping the linter trustworthy instead of noisy-but-correct. */
export function lint(rd: ResolvedDesign): Finding[] {
  const acks = rd.design.acks ?? [];
  // Nets collapsed by a block shorting its own terminals produce phantom symptoms (over-voltage, dueling
  // drivers, over-budget current) on the user's correct wiring. Suppress those on a shorted net — the
  // internal-short error already names the real cause — so the report isn't drowned in derivative noise.
  const shortedNetIds = new Set(internalShorts(rd).map((s) => s.net.id));
  const SYMPTOMS = new Set(["voltage/over-input", "connectivity/multiple-drivers", "current/over-budget", "polarity/conflict"]);
  return RULES.flatMap((rule) => rule(rd))
    .filter((f) => !(f.rule !== "connectivity/internal-short" && SYMPTOMS.has(f.rule) && f.at.some((x) => shortedNetIds.has(x))))
    .map((f) => { const a = acks.find((ack) => ackCovers(ack, f)); return a ? { ...f, acknowledged: { note: a.note } } : f; })
    .sort((a, b) => Number(!!a.acknowledged) - Number(!!b.acknowledged) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// helpers
function num(x: unknown): number | undefined {
  if (typeof x === "number") return x;
  if (x && typeof x === "object" && "value" in (x as Range)) return (x as Range).value;
  return undefined;
}
function round(n: number): number { return Math.round(n * 100) / 100; }
