// Programmatic block authoring: build a block's internal schematic (a real chip footprint + ports)
// from a part spec. This is what lets the assistant populate a block with an actual IC instead of
// leaving a hollow shell — the chip becomes a BOM/PCB part and the exposed pins become terminals.
import type { SchematicLayout, PlacedSymbol, SchematicWire, ChipSpec, Terminal, NetType } from "./types.js";
import { SYMBOL_CATALOG } from "./catalog.js";

const POWER_RE = /^(vdd|vcc|vbat|vin|vsys|avdd|avcc|vref|vddio|[+]?\d*v\d*|3v3|5v|1v8)$/i;
const GND_RE = /^(gnd|vss|avss|agnd|dgnd|v-|0v|gnd\d+)$/i;

/** Infer a terminal's role/type from a pin's function name (VCC→power in, GND→gnd in, else signal out). */
export function inferRoleType(name: string): { role: "in" | "out"; type: NetType } {
  const g = GND_RE.test(name), p = POWER_RE.test(name);
  return { role: g || p ? "in" : "out", type: g ? "gnd" : p ? "power" : "signal" };
}

/** Build a block's internal schematic around one chip: the chip symbol (with its pinout) plus a
 *  wired port for each exposed function pin. Returns the layout + the matching block terminals.
 *  Only functions that actually exist in the chip's pin map get exposed. */
export function authorChipLayout(ref: string, chip: ChipSpec, expose: string[]): { layout: SchematicLayout; terminals: Terminal[] } {
  const nameToPin = new Map<string, string>();
  for (const [pin, fn] of Object.entries(chip.names ?? {})) if (fn && !nameToPin.has(fn)) nameToPin.set(fn, pin);

  const symbols: PlacedSymbol[] = [{ id: ref, type: "chip", ref, x: 260, y: 120, chip }];
  const wires: SchematicWire[] = [];
  const terminals: Terminal[] = [];
  const seen = new Set<string>();
  let row = 0;
  for (const raw of expose) {
    const fn = raw.trim();
    if (!fn || seen.has(fn)) continue;
    const pin = nameToPin.get(fn);
    if (!pin) continue; // can only expose a pin the chip actually has
    seen.add(fn);
    const portId = `P_${fn.replace(/[^A-Za-z0-9]+/g, "_")}`;
    symbols.push({ id: portId, type: "port", ref: fn, x: 40, y: 40 + row * 40 });
    wires.push({ from: `${portId}.1`, to: `${ref}.${pin}` });
    terminals.push({ id: fn, ...inferRoleType(fn) });
    row++;
  }
  return { layout: { symbols, wires }, terminals };
}

/** Build a block's internal schematic around ONE discrete/passive part (resistor, capacitor, diode,
 *  crystal, regulator, transistor, source, …) wired to the block's existing terminals. This is the
 *  low-friction path for the simple parts that would otherwise be skipped or left as open pins:
 *  the part becomes a real BOM/PCB component (with its value), and the block stops being a shell.
 *
 *  `pinMap` pairs each of the block's terminals with one of the symbol's pins. When omitted, pins are
 *  assigned positionally (terminal[i] ↔ the symbol's i-th pin from the catalog) — correct for the
 *  common 2-terminal passive. Returns the layout only; the block keeps its declared terminals. */
export function authorPartLayout(
  ref: string,
  type: string,
  terminalIds: string[],
  value?: string,
  pinMap?: Record<string, string>,
): { layout: SchematicLayout } {
  const pins = SYMBOL_CATALOG[type]?.pins ?? terminalIds.map((_, i) => String(i + 1));
  const symbols: PlacedSymbol[] = [{ id: ref, type, ref, x: 220, y: 120, ...(value ? { value } : {}) }];
  const wires: SchematicWire[] = [];
  terminalIds.forEach((tid, i) => {
    const pin = pinMap?.[tid] ?? pins[i];
    if (!pin) return; // more terminals than the symbol has pins → leave the extra unwired
    const portId = `P_${tid.replace(/[^A-Za-z0-9]+/g, "_")}`;
    symbols.push({ id: portId, type: "port", ref: tid, x: 40, y: 40 + i * 40 });
    wires.push({ from: `${portId}.1`, to: `${ref}.${pin}` });
  });
  return { layout: { symbols, wires } };
}
