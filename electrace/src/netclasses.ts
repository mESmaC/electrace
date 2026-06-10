// Signal-integrity net classes: declared intent for what a net IS (RS-485 bus, I2C at 400 kHz,
// a USB differential pair), so the engine can enforce what that class physically requires —
// termination present, rise time achievable, traces short enough for the edge rate, pair lengths
// matched. Deterministic math on declared values; the same philosophy as the checks and the
// isolation constraints, applied to signals.
import type { Range } from "./types.js";

export interface NetClassDef {
  id: string;
  name: string;
  kind: "buspair" | "diffpair" | "single";
  z0?: number;          // characteristic impedance the wiring should present, ohms
  termOhms?: number;    // required termination across the pair (buspair)
  riseNsMax?: number;   // max allowed RC rise time (open-drain buses: I2C)
  edgeNs?: number;      // signal edge rate — sets the critical trace length on the PCB
  skewMm?: number;      // max routed length mismatch between the pair's two nets
  note?: string;
}

export const NET_CLASSES: Record<string, NetClassDef> = {
  "rs485": { id: "rs485", name: "RS-485 bus (A/B)", kind: "buspair", z0: 120, termOhms: 120, edgeNs: 10, skewMm: 10,
    note: "120 Ω termination at each physical end of the bus; carry A/B as a twisted pair off-board." },
  "can": { id: "can", name: "CAN bus (H/L)", kind: "buspair", z0: 120, termOhms: 120, edgeNs: 12, skewMm: 10,
    note: "120 Ω at both ends of the bus (60 Ω seen at any node); twisted pair off-board." },
  "i2c-100k": { id: "i2c-100k", name: "I2C @ 100 kHz", kind: "single", riseNsMax: 1000,
    note: "Rise time set by pull-up × bus capacitance must stay under 1000 ns." },
  "i2c-400k": { id: "i2c-400k", name: "I2C @ 400 kHz", kind: "single", riseNsMax: 300,
    note: "Fast-mode: rise under 300 ns — strong pull-ups or low bus capacitance." },
  "usb-fs": { id: "usb-fs", name: "USB full-speed (D+/D−)", kind: "diffpair", z0: 90, edgeNs: 4, skewMm: 4,
    note: "90 Ω differential; keep D+/D− matched within a few mm." },
  "fast-edge": { id: "fast-edge", name: "Fast edge (2 ns)", kind: "single", edgeNs: 2,
    note: "Any sharp digital edge — clocks, strobes. Traces past the critical length behave as transmission lines." },
};

/** Assignment of a class to the net containing `pin` (and `pairPin`'s net for pair classes).
 *  Pin-keyed so it survives rewiring; resolved to nets at analysis time. */
export interface NetClassAssignment {
  pin: string;                 // "REF.terminal"
  cls: string;                 // NET_CLASSES id
  pairPin?: string;            // the pair's other side (B / L / D−)
  pullupOhms?: number;         // I2C: pull-up value (default 4700)
  busCapPf?: number;           // I2C: bus capacitance override (default 20 + 10/device)
  terminated?: "external";     // user asserts termination exists off-board — silences the check
}

/** Critical length: edges faster than the round-trip make a trace a transmission line.
 *  l_crit ≈ (edge ns × ~150 mm/ns propagation) / 6 — the standard rule-of-thumb divisor. */
export const criticalLengthMm = (edgeNs: number): number => Math.round((edgeNs * 150) / 6);
