// Catalog of physical connectors placeable on a design (board I/O). Each is a real part with a fixed
// pinout + footprint. A block terminal docked onto a connector pin leaves the board there, so the
// connector is the physical home for off-board nets (the 1-pin case is the old off-board marker).

import type { ConnectorPinSpec } from "./types.js";

export interface ConnectorPart {
  id: string;
  name: string;
  pins: string[];            // pin ids in physical order
  footprint?: string;
  pinAmps?: number;          // per-contact current rating (typical datasheet value for the family)
  /** Pin meanings inherent to the part (a USB receptacle's VBUS IS 5 V power in — that's not a user
   *  choice). Per-instance ConnectorInstance.pins entries override these field-by-field. Generic
   *  connectors (headers, screw terminals) have none: their pins mean whatever the user says. */
  defaults?: Record<string, ConnectorPinSpec>;
}

const numbered = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

const USB_PWR: Record<string, ConnectorPinSpec> = {
  VBUS: { name: "VBUS", type: "power", role: "out", v: { value: 5, unit: "V" } },
  GND: { name: "GND", type: "gnd" },
};

export const CONNECTOR_CATALOG: Record<string, ConnectorPart> = {
  "jst-ph-2": { id: "jst-ph-2", name: "JST PH 2-pin (LiPo)", pins: numbered(2), footprint: "JST_PH_1x02_P2.00mm", pinAmps: 2, defaults: { "1": { name: "BAT+", type: "power", role: "out", v: { min: 3, max: 4.2, unit: "V" } }, "2": { name: "BAT\u2212", type: "gnd" } } },
  "jst-xh-2": { id: "jst-xh-2", name: "JST XH 2-pin", pins: numbered(2), footprint: "JST_XH_1x02_P2.50mm", pinAmps: 3 },
  "jst-xh-3": { id: "jst-xh-3", name: "JST XH 3-pin", pins: numbered(3), footprint: "JST_XH_1x03_P2.50mm", pinAmps: 3 },
  "jst-xh-4": { id: "jst-xh-4", name: "JST XH 4-pin", pins: numbered(4), footprint: "JST_XH_1x04_P2.50mm", pinAmps: 3 },
  "audio-3.5": { id: "audio-3.5", name: "Audio jack 3.5 mm (TRS)", pins: ["tip", "ring", "sleeve"], footprint: "Jack_3.5mm_TRS", pinAmps: 1, defaults: { sleeve: { name: "GND", type: "gnd" } } },
  "hdr-2":    { id: "hdr-2",    name: "Header 1×2",   pins: numbered(2),  footprint: "PinHeader_1x02_P2.54mm", pinAmps: 3 },
  "hdr-3":    { id: "hdr-3",    name: "Header 1×3",   pins: numbered(3),  footprint: "PinHeader_1x03_P2.54mm", pinAmps: 3 },
  "hdr-4":    { id: "hdr-4",    name: "Header 1×4",   pins: numbered(4),  footprint: "PinHeader_1x04_P2.54mm", pinAmps: 3 },
  "hdr-6":    { id: "hdr-6",    name: "Header 1×6",   pins: numbered(6),  footprint: "PinHeader_1x06_P2.54mm", pinAmps: 3 },
  "hdr-8":    { id: "hdr-8",    name: "Header 1×8",   pins: numbered(8),  footprint: "PinHeader_1x08_P2.54mm", pinAmps: 3 },
  "hdr-2x5":  { id: "hdr-2x5",  name: "Header 2×5 (10)",  pins: numbered(10), footprint: "PinHeader_2x05_P2.54mm", pinAmps: 3 },
  "hdr-2x10": { id: "hdr-2x10", name: "Header 2×10 (20)", pins: numbered(20), footprint: "PinHeader_2x10_P2.54mm", pinAmps: 3 },
  "hdr-2x20": { id: "hdr-2x20", name: "Header 2×20 (40)", pins: numbered(40), footprint: "PinHeader_2x20_P2.54mm", pinAmps: 3 },
  "screw-2":  { id: "screw-2",  name: "Screw terminal 2", pins: numbered(2), footprint: "TerminalBlock_P5.0mm_2", pinAmps: 10 },
  "screw-3":  { id: "screw-3",  name: "Screw terminal 3", pins: numbered(3), footprint: "TerminalBlock_P5.0mm_3", pinAmps: 10 },
  "barrel":   { id: "barrel",   name: "Barrel jack 2.1mm", pins: ["+", "-"], footprint: "BarrelJack_Horizontal", pinAmps: 5, defaults: { "+": { name: "V+", type: "power", role: "out" }, "-": { name: "GND", type: "gnd" } } },
  "usb-c":    { id: "usb-c",    name: "USB-C receptacle", pins: ["VBUS", "GND", "D+", "D-", "CC1", "CC2", "SBU1", "SBU2"], footprint: "USB_C_Receptacle", pinAmps: 5, defaults: { ...USB_PWR, VBUS: { ...USB_PWR.VBUS, i: { max: 3, unit: "A" } } } },
  "usb-a":    { id: "usb-a",    name: "USB-A receptacle", pins: ["VBUS", "D-", "D+", "GND"], footprint: "USB_A", pinAmps: 1.5, defaults: { ...USB_PWR, VBUS: { ...USB_PWR.VBUS, i: { max: 0.5, unit: "A" } } } },
  "usb-mini-b":  { id: "usb-mini-b",  name: "USB Mini-B",  pins: ["VBUS", "D-", "D+", "ID", "GND", "SHIELD"], footprint: "USB_Mini-B", pinAmps: 1, defaults: { ...USB_PWR, VBUS: { ...USB_PWR.VBUS, i: { max: 0.5, unit: "A" } }, SHIELD: { name: "SHIELD", type: "gnd" } } },
  "usb-micro-b": { id: "usb-micro-b", name: "USB Micro-B", pins: ["VBUS", "D-", "D+", "ID", "GND", "SHIELD"], footprint: "USB_Micro-B", pinAmps: 1.8, defaults: { ...USB_PWR, VBUS: { ...USB_PWR.VBUS, i: { max: 0.5, unit: "A" } }, SHIELD: { name: "SHIELD", type: "gnd" } } },
  "rj45":     { id: "rj45",     name: "RJ45", pins: numbered(8), footprint: "RJ45", pinAmps: 1.5 },
};

export const connectorPart = (id: string): ConnectorPart | undefined => CONNECTOR_CATALOG[id];

/** The effective declaration for one pin: catalog defaults merged field-by-field under any
 *  per-instance spec. Undefined when neither says anything (the pin stays a bare graph node). */
export function effectivePinSpec(
  part: ConnectorPart,
  instPins: Record<string, ConnectorPinSpec> | undefined,
  pin: string,
): ConnectorPinSpec | undefined {
  const d = part.defaults?.[pin];
  const o = instPins?.[pin];
  if (!d && !o) return undefined;
  return { ...d, ...o };
}
