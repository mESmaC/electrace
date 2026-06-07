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

/** One component in a block's internal subcircuit: a discrete (type+value) or a chip (with its pinout). */
export interface PartSpec { ref: string; type?: string; value?: string; mpn?: string; chip?: ChipSpec }
/** One net inside the block: the pins it joins (each "ref.pin" — for a chip, "ref.FUNCNAME" works too).
 *  `expose` makes it a block terminal of that name; otherwise it's an internal node. */
export interface NetSpec { connect: string[]; expose?: string; role?: "in" | "out"; type?: NetType }

/** Build a block's INTERNAL SCHEMATIC as a real functional subcircuit: several parts wired together,
 *  exposing only the pins the rest of the design connects to. This is the primitive that lets a block
 *  be what blocks actually are — an oscillator (crystal + 2 load caps), a power supply (regulator +
 *  caps + diode), an MCU (chip + decoupling + reset) — instead of one component per block.
 *
 *  Endpoints are "ref.pin"; for a chip part, the pin may be a function name (it's mapped to the pin
 *  number via the chip's `names`). Returns the layout plus the exposed terminals (role/type inferred
 *  from each exposed net's name unless overridden). */
export function buildBlockLayout(parts: PartSpec[], nets: NetSpec[]): { layout: SchematicLayout; terminals: Terminal[] } {
  const symbols: PlacedSymbol[] = [];
  const wires: SchematicWire[] = [];
  const terminals: Terminal[] = [];
  const seen = new Set<string>();

  parts.forEach((p, i) => {
    const x = 220 + (i % 3) * 150, y = 120 + Math.floor(i / 3) * 130;
    if (p.chip) symbols.push({ id: p.ref, type: "chip", ref: p.ref, x, y, chip: p.chip });
    else symbols.push({ id: p.ref, type: p.type ?? "ic", ref: p.ref, x, y, ...(p.value ? { value: p.value } : {}) });
  });

  // a chip pin can be addressed by function name ("U1.VCC") — translate to its pin number ("U1.4")
  const pinOf = (ref: string, pin: string): string => {
    const names = parts.find((q) => q.ref === ref)?.chip?.names;
    if (names) for (const [num, fn] of Object.entries(names)) if (fn === pin) return num;
    return pin;
  };

  nets.forEach((net, ni) => {
    const eps = (net.connect ?? []).map((e) => {
      const dot = e.indexOf(".");
      if (dot < 0) return "";
      return `${e.slice(0, dot)}.${pinOf(e.slice(0, dot), e.slice(dot + 1))}`;
    }).filter(Boolean);
    let anchor: string | undefined;
    if (net.expose && !seen.has(net.expose)) {
      seen.add(net.expose);
      const portId = `P_${net.expose.replace(/[^A-Za-z0-9]+/g, "_")}`;
      symbols.push({ id: portId, type: "port", ref: net.expose, x: 40, y: 40 + ni * 40 });
      anchor = `${portId}.1`;
      const inf = inferRoleType(net.expose);
      terminals.push({ id: net.expose, role: net.role ?? inf.role, type: net.type ?? inf.type });
    }
    if (anchor === undefined) anchor = eps[0];
    if (anchor) for (const ep of eps) if (ep !== anchor) wires.push({ from: anchor, to: ep });
  });

  return { layout: { symbols, wires }, terminals };
}
