// Canonical telemetry event schema. Events reference structured entities (block ids, terminal
// ids, net types, symbol types, finding/issue codes) — never raw UI coordinates or PII — so the
// captured stream is anonymizable and model-ready (it mirrors the shapes in context.ts/validate.ts).
// The web app emits these through a consent-gated capture hook; this module is just the contract.
import type { NetType } from "./types.js";

export type ElectraceEvent =
  // ── design level
  | { kind: "block.add"; block: string }                                   // block id@version
  | { kind: "block.remove"; block: string }
  | { kind: "connect"; from: string; to: string; netType?: NetType }       // instanceRef.terminal pairs
  | { kind: "disconnect"; from: string; to: string }
  | { kind: "value.edit"; block: string; terminal: string; field: string; value: number }
  | { kind: "drill.in"; block: string }
  | { kind: "design.lint"; codes: string[]; errors: number; warns: number } // finding rule codes present
  // ── block-internal (schematic) level
  | { kind: "sym.add"; block: string; symbol: string }                     // symbol type placed
  | { kind: "sym.remove"; block: string; count: number }
  | { kind: "wire.add"; block: string; from: string; to: string }          // pin refs
  | { kind: "sym.rotate"; block: string }
  | { kind: "pin.name"; block: string; sym: string; pin: string; name: string }
  | { kind: "mpn.enter"; block: string; sym: string; mpn: string }
  | { kind: "block.validate"; block: string; issues: string[] }            // validation issue codes
  // ── purchase intent (BOM → distributor) — strong corpus signal: this design got real enough to buy
  | { kind: "bom.buy"; q: string }                                         // one row's outbound query
  | { kind: "bom.cart"; parts: number };                                   // whole-BOM cart push, line count

/** A captured event: the structured event + when and which anonymous session. */
export interface CapturedEvent {
  t: number;        // epoch ms (stamped at capture)
  session: string;  // anonymous per-session id
  ev: ElectraceEvent;
}
