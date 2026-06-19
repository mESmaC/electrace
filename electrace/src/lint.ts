import { rmax } from "./types.js";
import { CONNECTOR_CATALOG } from "./connectors.js";
import { NET_CLASSES } from "./netclasses.js";
import { parseValue } from "./values.js";
import { solveDc } from "./solve.js";
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
      // sum every source that declares a rating — paralleled supplies/regulators feeding one rail add
      // their capability. Taking only the FIRST source fabricated a phantom over-budget error (audit).
      const rated = net.sources.map((s) => rmax(s.def.i)).filter((c): c is number => c != null);
      if (!rated.length) return [];
      const cap = rated.reduce((a, c) => a + c, 0);
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

/** Current through a declared connector pin vs the family's per-contact rating. A pin that FEEDS
 *  the board (role out) carries the net's whole draw; a pin the board feeds carries its own draw.
 *  Undeclared pins stay unchecked — direction (and therefore through-current) is unknowable. */
const connectorPinCurrent: Rule = (rd) =>
  rd.nets.flatMap((net): Finding[] => {
    const draw = net.sinks.reduce((a, s) => a + (rmax(s.current) ?? 0), 0);
    const out: Finding[] = [];
    for (const p of net.members) {
      if (!p.block.id.startsWith("connector:")) continue;
      const part = CONNECTOR_CATALOG[p.block.id.slice("connector:".length)];
      const rating = part?.pinAmps;
      if (rating == null) continue;
      const through = p.def.role === "out" ? draw : rmax(p.def.i) ?? 0;
      if (through > rating)
        out.push({
          rule: "current/connector-pin", severity: "error", category: "current", at: [net.id, p.node],
          message: `${p.instance} pin ${p.terminal} (${part.name}) carries up to ${round(through)} A but one contact is rated ${rating} A.`,
          derivation: `through-pin ${round(through)} A  >  contact rating ${rating} A`,
          fix: { label: "Parallel more pins, or use a higher-rated connector" },
        } satisfies Finding);
      else if (through > 0.85 * rating)
        out.push({
          rule: "current/connector-pin", severity: "warn", category: "current", at: [net.id, p.node],
          message: `${p.instance} pin ${p.terminal} (${part.name}) runs at ${round(through)} A — close to its ${rating} A contact rating.`,
          derivation: `${round(through)} A of ${rating} A rating used`,
        } satisfies Finding);
    }
    return out;
  });

/** USB inrush: hard-attached bulk capacitance on a USB-fed rail vs the ~10 µF the spec allows.
 *  Not a transient simulation — pure declared-value arithmetic: at plug-in, every bulk cap on
 *  VBUS is a momentary near-short, and the USB spec caps the hard-attached charge (~10 µF
 *  equivalent) precisely so hosts don't brown-out or trip their port protection. Bulk = a cap
 *  inside any block whose one pin reaches the VBUS net and whose other pin reaches a gnd net. */
const usbInrush: Rule = (rd) =>
  rd.nets
    .filter((net) => (net.connectorPins ?? []).some((cp) => {
      const dot = cp.indexOf(".");
      const conn = (rd.design.connectors ?? []).find((c) => c.ref === cp.slice(0, dot));
      return !!conn && conn.connector.startsWith("usb") && cp.slice(dot + 1) === "VBUS";
    }))
    .flatMap((net): Finding[] => {
      const reaches = (inst: (typeof rd.instances)[number], partPin: string): Set<string> => {
        const out = new Set<string>();
        for (const inet of inst.def.schematic?.nets ?? []) {
          if (!inet.connect.includes(partPin)) continue;
          for (const c of inet.connect) {
            if (!c.startsWith("@")) continue;
            const dn = rd.nets.find((n) => n.members.some((m) => m.node === `${inst.ref}.${c.slice(1)}`));
            if (dn) out.add(dn.id);
          }
        }
        return out;
      };
      const isGnd = (ids: Set<string>) => rd.nets.some((n) => n.type === "gnd" && ids.has(n.id));
      const contributors: { label: string; f: number }[] = [];
      for (const inst of rd.instances) {
        for (const part of inst.def.schematic?.parts ?? []) {
          if (part.type !== "cap" && part.type !== "cap-pol") continue;
          const f = part.value ? parseValue(part.value) : undefined;
          if (f == null || f <= 0) continue;
          const r1 = reaches(inst, `${part.ref}.1`), r2 = reaches(inst, `${part.ref}.2`);
          const other = r1.has(net.id) ? r2 : r2.has(net.id) ? r1 : null;
          if (!other || !isGnd(other)) continue;
          contributors.push({ label: `${part.ref} ${part.value} in ${inst.ref}`, f });
        }
      }
      const total = contributors.reduce((a, c) => a + c.f, 0);
      const LIMIT = 10e-6;
      if (total <= LIMIT * 1.1) return []; // 10% grace — the canonical single 10 µF input cap stays quiet
      const uF = (x: number) => Math.round(x * 1e7) / 10;
      return [{
        rule: "current/usb-inrush", severity: "warn", category: "current", at: [net.id],
        message: `${net.id} hangs ~${uF(total)} µF of hard-attached bulk capacitance off a USB port (${contributors.map((c) => c.label).join(", ")}) — the spec allows about 10 µF before plug-in inrush can brown-out or trip the host. Add inrush limiting (a load switch / soft-start), or move the bulk behind it.`,
        derivation: `Σ bulk C on ${net.id} = ${uF(total)} µF  >  ~10 µF USB hard-attach allowance`,
        fix: { label: "Add a soft-start / load switch, or reduce hard-attached bulk" },
      } satisfies Finding];
    });

/** The DC operating point (stage 1 of the analysis ladder): run MNA over the flattened design
 *  and compare every resistor's REAL dissipation against its package rating. Also forwards the
 *  solver's honesty stream (missing values, nonlinear parts left open, skipped subcircuits). */
const RATING: [RegExp, number][] = [
  [/0402/, 0.0625], [/0603/, 0.1], [/0805/, 0.125], [/1206/, 0.25], [/1210/, 0.5], [/2010/, 0.75], [/2512/, 1],
];
const round2 = (x: number) => Math.round(x * 100) / 100;
const dcOperatingPoint: Rule = (rd) => {
  const sol = solveDc(rd);
  const out: Finding[] = [...sol.findings];
  for (const p of sol.parts) {
    if (p.watts < 0.005) continue; // milliwatt noise
    const instance = p.ref.slice(0, p.ref.indexOf("/"));
    const rating = p.ratingWatts ?? RATING.find(([re]) => re.test(p.footprint ?? ""))?.[1]; // declared truth first
    const derivation = `${round2(p.volts)} V across ${p.ohms} Ω → ${round2(p.amps * 1000) / 1000} A → P = ${round2(p.watts)} W`;
    if (rating != null && p.watts > rating) {
      out.push({
        rule: "thermal/resistor-dissipation", severity: "error", category: "thermal", at: [instance, p.ref],
        message: `${p.ref} dissipates ${round2(p.watts)} W — its package is rated ${rating} W. It will burn.`,
        derivation, fix: { label: "Bigger package, higher resistance, or rethink the path" },
      } satisfies Finding);
    } else if (rating != null && p.watts > 0.7 * rating) {
      out.push({
        rule: "thermal/resistor-dissipation", severity: "warn", category: "thermal", at: [instance, p.ref],
        message: `${p.ref} runs at ${round2(p.watts)} W — over 70% of its ${rating} W package rating. It will run hot.`,
        derivation,
      } satisfies Finding);
    } else if (rating == null && p.watts > 0.25) {
      out.push({
        rule: "thermal/resistor-dissipation", severity: "warn", category: "thermal", at: [instance, p.ref],
        message: `${p.ref} dissipates ${round2(p.watts)} W — more than a typical small resistor's ¼ W. Check the part's actual rating.`,
        derivation,
      } satisfies Finding);
    }
  }
  // diode reverse voltage vs declared PIV; leakage backflow worth knowing about
  for (const d of sol.diodes) {
    if (d.on || !d.reverseV) continue;
    const instance = d.ref.slice(0, d.ref.indexOf("/"));
    if (d.pivVolts != null && d.reverseV > d.pivVolts) {
      out.push({
        rule: "voltage/diode-piv", severity: "error", category: "voltage", at: [instance, d.ref],
        message: `${d.ref} blocks ${round2(d.reverseV)} V in reverse — its rated reverse voltage is ${d.pivVolts} V. It will avalanche.`,
        derivation: `solved reverse ${round2(d.reverseV)} V  >  PIV ${d.pivVolts} V`,
        fix: { label: "Use a higher-PIV diode" },
      } satisfies Finding);
    } else if (d.pivVolts != null && d.reverseV > 0.8 * d.pivVolts) {
      out.push({
        rule: "voltage/diode-piv", severity: "warn", category: "voltage", at: [instance, d.ref],
        message: `${d.ref} blocks ${round2(d.reverseV)} V — over 80% of its ${d.pivVolts} V reverse rating.`,
        derivation: `solved reverse ${round2(d.reverseV)} V  >  80% of ${d.pivVolts} V`,
      } satisfies Finding);
    }
    if (d.amps > 1e-8) { // declared leakage = the user wants the number; floor is numerical noise only
      out.push({
        rule: "current/diode-leakage", severity: "info", category: "current", at: [instance, d.ref],
        message: `${d.ref} is blocking, but its declared leakage lets ~${d.amps >= 1e-3 ? `${round2(d.amps * 1000)} mA` : `${round2(d.amps * 1e6)} µA`} flow backwards anyway — on a battery, that's a slow drain that never sleeps.`,
        derivation: `reverse ${round2(d.reverseV)} V × declared leakage`,
      } satisfies Finding);
    }
  }
  // capacitor working-voltage vs the solved DC across it (declared rating only — no guessing)
  for (const c of sol.caps) {
    if (c.ratingVolts == null || c.volts < 0.01) continue;
    const instance = c.ref.slice(0, c.ref.indexOf("/"));
    if (c.volts > c.ratingVolts) {
      out.push({
        rule: "voltage/cap-rating", severity: "error", category: "voltage", at: [instance, c.ref],
        message: `${c.ref} sees ${round2(c.volts)} V at the operating point — it's rated ${c.ratingVolts} V. Electrolytics vent; ceramics crack.`,
        derivation: `solved ${round2(c.volts)} V  >  rated ${c.ratingVolts} V`,
        fix: { label: "Use a higher-voltage part" },
      } satisfies Finding);
    } else if (c.volts > 0.8 * c.ratingVolts) {
      out.push({
        rule: "voltage/cap-rating", severity: "warn", category: "voltage", at: [instance, c.ref],
        message: `${c.ref} runs at ${round2(c.volts)} V — over 80% of its ${c.ratingVolts} V rating. Standard derating says leave 20% headroom.`,
        derivation: `solved ${round2(c.volts)} V  >  80% of ${c.ratingVolts} V`,
      } satisfies Finding);
    }
  }
  // self-asserts: the block's own operating-point claims, checked against the solve
  for (const inst of rd.instances) {
    for (const a of inst.def.asserts ?? []) {
      const flat = sol.pinNet[`${inst.ref}/${a.pin}`];
      const v = flat != null ? sol.netVolts[flat] : undefined;
      const tol = a.tol ?? Math.max(0.05, Math.abs(a.volts) * 0.05);
      if (v == null) {
        out.push({
          rule: "assert/unverified", severity: "info", category: "completeness", at: [inst.ref],
          message: `${inst.def.name} asserts the node at ${a.pin} ≈ ${a.volts} V, but it wasn't solvable here (nonlinear path or no source) — the claim is unverified, not wrong.`,
        } satisfies Finding);
      } else if (Math.abs(v - a.volts) > tol) {
        out.push({
          rule: "assert/failed", severity: "error", category: "voltage", at: [inst.ref],
          message: `${inst.def.name}'s own spec says the node at ${a.pin} should sit at ${a.volts} V — it solves to ${round2(v)} V. Something in this block's values or wiring no longer does what the block claims.`,
          derivation: `assert ${a.volts} V ± ${round2(tol)}; solved ${round2(v)} V`,
          fix: { label: "Fix the values/wiring, or update the block's assert" },
        } satisfies Finding);
      }
    }
  }
  return out;
};

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

/** A linear regulator dropping a lot of voltage at current burns it as heat. The design knows
 *  more than the datasheet: when the ACTUAL incoming rail and the ACTUAL declared load are
 *  resolvable, use them — telling a user their 5 V-fed, 40 mA LDO "burns 4.35 W" because the
 *  part's spec allows 12 V at 0.5 A is a wrong number, and a wrong number reads as a broken tool. */
const lowEfficiency: Rule = (rd) =>
  rd.instances.flatMap((inst): Finding[] => {
    const b = inst.def;
    if (b.topology !== "linear" || !b.spec) return [];
    const vinSpec = rmax(b.spec.vin as Range);
    const vout = num(b.spec.vout);
    const ioutSpec = num(b.spec.iout_max);
    if (vinSpec == null || vout == null || ioutSpec == null) return [];
    const netOf = (tid: string) => rd.nets.find((n) => n.members.some((m) => m.node === `${inst.ref}.${tid}`));
    const tin = b.terminals.find((t) => t.role === "in" && t.type === "power");
    const tout = b.terminals.find((t) => t.role === "out" && (t.type === "rail" || t.type === "power"));
    const vinNet = tin?.id ? netOf(tin.id)?.voltage : undefined;
    const drawNet = tout?.id ? netOf(tout.id)?.sinks.reduce((a, s) => a + (rmax(s.current) ?? 0), 0) : undefined;
    const vin = (vinNet ? rmax(vinNet) : undefined) ?? vinSpec;
    const iout = drawNet && drawNet > 0 ? Math.min(drawNet, ioutSpec) : ioutSpec;
    const actual = vinNet != null && drawNet != null && drawNet > 0;
    const diss = (vin - vout) * iout;
    if (diss <= 1) return [];
    return [{
      rule: "thermal/low-efficiency", severity: "recommendation", category: "thermal",
      at: [inst.ref],
      message: `${inst.ref} (${b.name}) burns ~${round(diss)} W as heat dropping ${vin}→${vout} V at ${round(iout)} A${actual ? "" : " (worst case from its spec — wire its rails for the real number)"}. A switching regulator would run far cooler.`,
      derivation: `(${vin} − ${vout}) V × ${round(iout)} A = ${round(diss)} W dissipated`,
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
          // the block AUTHOR tied these terminals in the internal schematic — a deliberate
          // passthrough (USB-C vbus≡vout), not a user mis-wire. Authoring mistakes belong to
          // block-level review, not to every design that places the block.
          const ta = rd.internalTies?.[a.node], tb = rd.internalTies?.[b.node];
          if (ta != null && ta === tb) continue;
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
      // sum every source that declares a rating — paralleled supplies/regulators feeding one rail add
      // their capability. Taking only the FIRST source fabricated a phantom over-budget error (audit).
      const rated = net.sources.map((s) => rmax(s.def.i)).filter((c): c is number => c != null);
      if (!rated.length) return [];
      const cap = rated.reduce((a, c) => a + c, 0);
      const draw = net.sinks.reduce((a, s) => a + (rmax(s.current) ?? 0), 0);
      if (cap > 0 && draw > 0 && draw < 0.4 * cap)
        return [{
          rule: "current/under-utilized", severity: "recommendation", category: "current", at: [net.id],
          message: `${net.id}'s source is rated ${cap} A but only ~${round(draw)} A is used — a smaller, cheaper part would do.`,
          derivation: `${round(draw)} A of ${cap} A (${Math.round((draw / cap) * 100)} %)`,
        }];
      return [];
    });

/** A wire whose endpoint no longer exists (block re-authored, terminal renamed). Resolve skips it
 *  rather than dying; this rule turns each skip into a precise repair instruction — naming the
 *  endpoint's valid terminals — so neither humans nor agents are left guessing (lint principle 4). */
const danglingWire: Rule = (rd) =>
  (rd.invalid ?? []).map((c) => {
    const fix = c.missing.map((e) => {
      const ref = e.split(".")[0];
      const inst = rd.instances.find((i) => i.ref === ref);
      if (inst) return `${e} doesn't exist — ${ref}'s terminals are: ${inst.def.terminals.map((t) => t.id).join(", ")}`;
      const conn = (rd.design.connectors ?? []).find((x) => x.ref === ref);
      if (conn) return `${e} doesn't exist — ${ref}'s pins are: ${CONNECTOR_CATALOG[conn.connector]?.pins.join(", ") ?? "?"}`;
      return `no instance "${ref}" on the design`;
    }).join("; ");
    return {
      rule: "connectivity/dangling-wire",
      severity: "error" as const,
      category: "connectivity" as const,
      at: [c.from, c.to],
      message: `Wire ${c.from} ↔ ${c.to} references a missing endpoint: ${fix}. Reconnect it or remove the wire.`,
    };
  });

// ── Registry ────────────────────────────────────────────────────────────────


/** A signal OUTPUT driving more total load than it's rated for (GPIO sums, totem-pole limits).
 *  Needs propagation-era data: sink draws are declared; the source's i is its ceiling. */
const signalOverCurrent: Rule = (rd) =>
  rd.nets.flatMap((net) => {
    if (net.type !== "signal") return [];
    return net.sources.flatMap((src) => {
      const cap = rmax(src.def.i);
      if (cap == null) return [];
      const draw = net.sinks.reduce((a, s) => (s.pin.instance === src.instance ? a : a + (rmax(s.current) ?? 0)), 0);
      if (draw > cap + 1e-9)
        return [{
          rule: "current/signal-over-source", severity: "error", category: "current",
          at: [net.id, src.node],
          message: `${src.instance}.${src.terminal} is rated ${cap} A but its loads draw ${Math.round(draw * 1000) / 1000} A.`,
          derivation: `Σ load ${Math.round(draw * 1000) / 1000} A  >  source ${cap} A`,
        } satisfies Finding];
      return [];
    });
  });

/** A power/rail source and a ground pin on the SAME net — a wired short, the checker's
 *  equivalent of the magic-smoke moment. (gnd type wins in netType, so look at members.) */
const shortCircuit: Rule = (rd) =>
  rd.nets.flatMap((net) => {
    if (net.type !== "gnd") return [];
    const hot = net.sources.filter((p) => (p.def.type === "power" || p.def.type === "rail") && p.def.v && (p.def.v.max != null || p.def.v.value != null));
    if (!hot.length) return [];
    return [{
      rule: "connectivity/short-circuit", severity: "error", category: "connectivity",
      at: [net.id, ...hot.map((p) => p.node)],
      message: `${hot.map((p) => `${p.instance}.${p.terminal}`).join(", ")} ${hot.length > 1 ? "are" : "is"} wired straight to ground — that's a short, not a circuit.`,
      derivation: `power source and gnd pins share net ${net.id}`,
    } satisfies Finding];
  });

/** A rail's worst-case LOW end sits below a connected input's declared minimum — brown-out
 *  territory: works on the bench at nominal, dies at the bottom of the input range. */
const underVoltage: Rule = (rd) =>
  rd.nets.flatMap((net) => {
    if (net.type !== "power" && net.type !== "rail") return [];
    const lo = net.voltage?.min;
    if (lo == null) return [];
    return net.sinks.flatMap((s) => {
      const need = s.pin.def.v?.min;
      if (need != null && lo < need - 1e-9)
        return [{
          rule: "voltage/under-input", severity: "warn", category: "voltage",
          at: [net.id, s.pin.node],
          message: `${net.id} can sag to ${lo} V but ${s.pin.instance}.${s.pin.terminal} needs at least ${need} V — fine at nominal, brown-out at the bottom of the range.`,
          derivation: `net min ${lo} V  <  input min ${need} V`,
        } satisfies Finding];
      return [];
    });
  });


/** ACTUAL dissipation in a linear regulator at the wired loads (not the rated max — that's
 *  lowEfficiency's recommendation). (Vin_max − Vout) × Σ(actual out-net draw): the LDO-as-
 *  space-heater catch, computed from what's really connected. */
const regulatorDissipation: Rule = (rd) =>
  rd.instances.flatMap((inst): Finding[] => {
    const b = inst.def;
    if (!b.transform || b.topology !== "linear") return [];
    const outTerm = b.terminals.find((t) => t.role === "out" && (t.type === "power" || t.type === "rail"));
    const inTerm = b.terminals.find((t) => t.role === "in" && (t.type === "power" || t.type === "rail"));
    if (!outTerm || !inTerm) return [];
    const outNet = rd.nets.find((n) => n.members.some((m) => m.node === `${inst.ref}.${outTerm.id}`));
    const inNet = rd.nets.find((n) => n.members.some((m) => m.node === `${inst.ref}.${inTerm.id}`));
    const vin = rmax(inNet?.voltage);
    const vout = outTerm.v?.value ?? rmax(outTerm.v);
    if (vin == null || vout == null || !outNet) return [];
    const iOut = outNet.sinks.reduce((a, s) => (s.pin.instance === inst.ref ? a : a + (rmax(s.current) ?? 0)), 0);
    const diss = (vin - vout) * iOut;
    if (diss < 0.5) return [];
    const sev = diss >= 1.5 ? "error" : "warn";
    return [{
      rule: "thermal/regulator-dissipation", severity: sev, category: "thermal",
      at: [inst.ref],
      message: `${inst.ref} dissipates ~${round(diss)} W at the connected load (dropping ${vin}→${vout} V at ${round(iOut * 1000) / 1000 * 1000} mA${diss >= 1.5 ? " — that needs a heatsink or a switcher, not hope" : " — check the package can shed it"}).`,
      derivation: `(${vin} − ${vout}) V × ${Math.round(iOut * 1000)} mA = ${round(diss)} W in the pass element`,
    } satisfies Finding];
  });


/** Declared galvanic-isolation constraints: "these blocks must share NO conductive path."
 *  Builds the conduction graph — nets connect their member terminals; a block connects its own
 *  terminals EXCEPT across its declared isolation groups (an optocoupler's two sides) — then
 *  BFS from A to B. A violation names the bridging path: the actionable part. */
const isolationBridged: Rule = (rd) => {
  const constraints = rd.design.isolation ?? [];
  if (!constraints.length) return [];
  const adj = new Map<string, { to: string; via: string }[]>();
  const link = (a: string, b: string, via: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, via });
    adj.get(b)!.push({ to: a, via });
  };
  for (const net of rd.nets) {
    const m = net.members;
    for (let i = 1; i < m.length; i++) link(m[0].node, m[i].node, `net ${net.id}`);
  }
  for (const inst of rd.instances) {
    const groups = inst.def.isolation ?? [inst.def.terminals.map((t) => t.id)];
    for (const g of groups) for (let i = 1; i < g.length; i++) link(`${inst.ref}.${g[0]}`, `${inst.ref}.${g[i]}`, `inside ${inst.ref}`);
  }
  const pathBetween = (aRef: string, bRef: string): string[] | null => {
    const starts = rd.instances.find((i) => i.ref === aRef)?.def.terminals.map((t) => `${aRef}.${t.id}`) ?? [];
    const goal = new Set(rd.instances.find((i) => i.ref === bRef)?.def.terminals.map((t) => `${bRef}.${t.id}`) ?? []);
    const seen = new Set(starts);
    const q: { node: string; vias: string[] }[] = starts.map((n) => ({ node: n, vias: [] }));
    while (q.length) {
      const cur = q.shift()!;
      if (goal.has(cur.node)) return cur.vias;
      for (const e of adj.get(cur.node) ?? []) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        q.push({ node: e.to, vias: cur.vias[cur.vias.length - 1] === e.via ? cur.vias : [...cur.vias, e.via] });
      }
    }
    return null;
  };
  const out: Finding[] = [];
  const done = new Set<string>();
  for (const c of constraints) {
    const targets = c.b === "*" ? rd.instances.map((i) => i.ref).filter((r) => r !== c.a) : [c.b];
    for (const t of targets) {
      const key = [c.a, t].sort().join("|");
      if (done.has(key) || c.a === t) continue;
      done.add(key);
      if (!rd.instances.some((i) => i.ref === t) || !rd.instances.some((i) => i.ref === c.a)) continue;
      const vias = pathBetween(c.a, t);
      if (vias) {
        out.push({
          rule: "isolation/bridged", severity: "error", category: "connectivity",
          at: [c.a, t, ...vias.filter((v) => v.startsWith("net ")).map((v) => v.slice(4))],
          message: `${c.a} and ${t} are declared galvanically isolated, but they're conductively bridged: ${vias.join(" → ")}.`,
          derivation: `isolation constraint ${c.a} ↮ ${c.b === "*" ? "all" : c.b}; conductive path exists`,
        });
      }
    }
  }
  return out;
};


/** SI: a declared bus pair (RS-485 / CAN) must have its termination resistor actually present —
 *  found by scanning the FLATTENED part-level netlist for a resistor of ≈ the class's value
 *  bridging the two bus nets. `terminated: "external"` silences it (termination off-board). */
const busTermination: Rule = (rd) => {
  const assigns = (rd.design.signals ?? []).filter((a) => {
    const cls = NET_CLASSES[a.cls];
    return cls?.kind === "buspair" && cls.termOhms != null && a.terminated !== "external" && a.pairPin;
  });
  if (!assigns.length) return [];
  // F13: a net's connector pins live in net.connectorPins (string[]), NOT in net.members — an
  // unspec'd connector pin (e.g. a bare hdr-2 contact) never enters pinOf/members. Matching members
  // alone made an RS-485 class declared ON connector pins resolve to no net → silent no-fire. Also
  // match connectorPins so connector-anchored bus pairs are seen. (reaches/hasTerm route through this
  // same helper and compare on net.id, so the termination-FOUND path self-heals — a terminated pair
  // stays silent; no false-fire.)
  const netOf = (pin: string) => rd.nets.find((n) => n.members.some((m) => m.node === pin) || (n.connectorPins?.includes(pin) ?? false));
  return assigns.flatMap((a) => {
    const cls = NET_CLASSES[a.cls];
    const netA = netOf(a.pin), netB = netOf(a.pairPin!);
    if (!netA || !netB) return [];
    // a terminator = a resistor of ≈ the class value INSIDE any block, whose two pins reach
    // terminals landing on the two bus nets. Inspect block internals directly.
    const reaches = (inst: (typeof rd.instances)[number], partPin: string): Set<string> => {
      // internal nets containing this part pin → their @terminal exposures → design nets
      const out = new Set<string>();
      for (const inet of inst.def.schematic?.nets ?? []) {
        if (!inet.connect.includes(partPin)) continue;
        for (const c of inet.connect) {
          if (!c.startsWith("@")) continue;
          const dn = netOf(`${inst.ref}.${c.slice(1)}`);
          if (dn) out.add(dn.id);
        }
      }
      return out;
    };
    const hasTerm = rd.instances.some((inst) =>
      (inst.def.schematic?.parts ?? []).some((part) => {
        if (part.type !== "res") return false;
        const v = part.value ? parseValue(part.value) : undefined;
        if (v == null || Math.abs(v - cls.termOhms!) / cls.termOhms! > 0.25) return false;
        const r1 = reaches(inst, `${part.ref}.1`), r2 = reaches(inst, `${part.ref}.2`);
        return (r1.has(netA.id) && r2.has(netB.id)) || (r1.has(netB.id) && r2.has(netA.id));
      }));
    if (hasTerm) return [];
    return [{
      rule: "si/termination-missing", severity: "warn", category: "connectivity",
      at: [netA.id, netB.id],
      message: `${cls.name} declared on ${netA.id}/${netB.id}, but no ~${cls.termOhms} Ω termination bridges the pair. An unterminated bus reflects every edge — works on 10 cm of bench wire, garbles data on a real run. (Termination lives off-board? Mark it external in the signal class.)`,
      derivation: `class ${cls.id} requires ${cls.termOhms} Ω across the pair; none found in the flattened netlist`,
    } satisfies Finding];
  });
};

/** SI: I2C rise time — τ ≈ 0.847 × R_pullup × C_bus must beat the mode's limit. C_bus is
 *  estimated (20 pF + 10 pF per attached device) unless declared. All knobs overridable. */
const i2cRiseTime: Rule = (rd) =>
  (rd.design.signals ?? []).flatMap((a) => {
    const cls = NET_CLASSES[a.cls];
    if (!cls?.riseNsMax) return [];
    // F14: like the bus-pair rule (F13), an I2C class can be declared on a bare connector pin, which
    // lives in net.connectorPins — NOT net.members. Matching members alone silently no-fired on a
    // real off-board bus; and counting devices from members alone undercounted C_bus (→ a WRONG
    // rise-time number) whenever connector pins were part of the net. Match + count both.
    const net = rd.nets.find((n) => n.members.some((m) => m.node === a.pin) || (n.connectorPins?.includes(a.pin) ?? false));
    if (!net) return [];
    const r = a.pullupOhms ?? 4700;
    const devices = net.members.length + (net.connectorPins?.length ?? 0);
    const c = a.busCapPf ?? 20 + devices * 10;
    const rise = 0.847 * r * c / 1000; // ns
    if (rise <= cls.riseNsMax) return [];
    const need = Math.floor((cls.riseNsMax * 1000) / (0.847 * c) / 100) * 100;
    return [{
      rule: "si/i2c-rise-time", severity: "warn", category: "connectivity",
      at: [net.id],
      message: `${net.id} as ${cls.name}: ${r / 1000}k pull-ups into ~${c} pF rise in ~${Math.round(rise)} ns — over the ${cls.riseNsMax} ns limit. Drop the pull-ups to ≤${need} Ω or shorten the bus.`,
      derivation: `0.847 × ${r} Ω × ${c} pF = ${Math.round(rise)} ns  >  ${cls.riseNsMax} ns`,
    } satisfies Finding];
  });

/** Reliability: an IC's supply pin wants a local decoupling capacitor to ground. Flags a chip whose
 *  power/rail supply net carries NO capacitor-to-ground ANYWHERE in the flattened netlist — the most
 *  common real-world omission (flaky, hard-to-reproduce behavior). Recommendation tier on purpose:
 *  lenient on LOCALITY (any cap on the net to gnd counts as bypassed) so it never false-fires on a
 *  rail that's bulk-decoupled elsewhere; it speaks only when there is genuinely none. */
const decoupling: Rule = (rd) => {
  // map a part pin ("U1.1") to the design net ids it reaches via its block's @terminal exposures
  const reaches = (inst: (typeof rd.instances)[number], partPin: string): Set<string> => {
    const out = new Set<string>();
    for (const inet of inst.def.schematic?.nets ?? []) {
      if (!inet.connect.includes(partPin)) continue;
      for (const c of inet.connect) {
        if (!c.startsWith("@")) continue;
        const dn = rd.nets.find((n) => n.members.some((m) => m.node === `${inst.ref}.${c.slice(1)}`));
        if (dn) out.add(dn.id);
      }
    }
    return out;
  };
  const isGnd = (ids: Set<string>) => rd.nets.some((n) => n.type === "gnd" && ids.has(n.id));
  // every design net a capacitor bridges to ground = a bypassed/decoupled net
  const bypassed = new Set<string>();
  for (const inst of rd.instances) {
    for (const part of inst.def.schematic?.parts ?? []) {
      if (part.type !== "cap" && part.type !== "cap-pol") continue;
      const r1 = reaches(inst, `${part.ref}.1`), r2 = reaches(inst, `${part.ref}.2`);
      if (isGnd(r2)) r1.forEach((id) => bypassed.add(id));
      if (isGnd(r1)) r2.forEach((id) => bypassed.add(id));
    }
  }
  const SUPPLY = /^[+]?(a?v(cc|dd)|v(bat|sys|in|ddio|dda|ref)|\d*v\d+|\d+v\d*)\w*$/i;
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const inst of rd.instances) {
    for (const part of inst.def.schematic?.parts ?? []) {
      if (!part.chip?.names) continue; // real ICs only — passives don't get a decoupling check
      for (const [pinNum, fn] of Object.entries(part.chip.names)) {
        if (!fn || !SUPPLY.test(fn)) continue;
        for (const id of reaches(inst, `${part.ref}.${pinNum}`)) {
          const net = rd.nets.find((n) => n.id === id);
          if (!net || (net.type !== "power" && net.type !== "rail")) continue;
          if (bypassed.has(id) || seen.has(`${inst.ref}:${id}`)) continue;
          seen.add(`${inst.ref}:${id}`);
          out.push({
            rule: "reliability/decoupling-missing", severity: "recommendation", category: "connectivity",
            at: [net.id, `${inst.ref}.${part.ref}`],
            message: `${inst.ref}'s ${fn} (${net.id}) has no decoupling capacitor to ground — add a 0.1 µF close to the pin. Missing decoupling is the classic cause of flaky, hard-to-reproduce IC behavior.`,
            derivation: `IC supply net ${net.id} carries no cap-to-ground in the flattened netlist`,
            fix: { label: "Add a 0.1 µF (plus bulk if needed) from the supply pin to GND" },
          } satisfies Finding);
        }
      }
    }
  }
  return out;
};

export const RULES: Rule[] = [
  danglingWire,
  openNet, overCurrent, connectorPinCurrent, usbInrush, dcOperatingPoint, overVoltage, underVoltage, signalOverCurrent, shortCircuit, polarityConflict, multipleDrivers, undrivenRail, internalShort, regulatorDissipation, isolationBridged, busTermination, i2cRiseTime, // faults + SI
  decoupling, lowEfficiency, underUtilized, testPoints, emptyBlock, connectorFull,  // recommendations + completeness
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
