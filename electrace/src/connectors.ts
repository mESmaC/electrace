// Catalog of physical connectors placeable on a design (board I/O). Each is a real part with a fixed
// pinout + footprint. A block terminal docked onto a connector pin leaves the board there, so the
// connector is the physical home for off-board nets (the 1-pin case is the old off-board marker).

export interface ConnectorPart {
  id: string;
  name: string;
  pins: string[];            // pin ids in physical order
  footprint?: string;
}

const numbered = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

export const CONNECTOR_CATALOG: Record<string, ConnectorPart> = {
  "hdr-2":    { id: "hdr-2",    name: "Header 1×2",   pins: numbered(2),  footprint: "PinHeader_1x02_P2.54mm" },
  "hdr-3":    { id: "hdr-3",    name: "Header 1×3",   pins: numbered(3),  footprint: "PinHeader_1x03_P2.54mm" },
  "hdr-4":    { id: "hdr-4",    name: "Header 1×4",   pins: numbered(4),  footprint: "PinHeader_1x04_P2.54mm" },
  "hdr-6":    { id: "hdr-6",    name: "Header 1×6",   pins: numbered(6),  footprint: "PinHeader_1x06_P2.54mm" },
  "hdr-8":    { id: "hdr-8",    name: "Header 1×8",   pins: numbered(8),  footprint: "PinHeader_1x08_P2.54mm" },
  "hdr-2x5":  { id: "hdr-2x5",  name: "Header 2×5 (10)",  pins: numbered(10), footprint: "PinHeader_2x05_P2.54mm" },
  "hdr-2x10": { id: "hdr-2x10", name: "Header 2×10 (20)", pins: numbered(20), footprint: "PinHeader_2x10_P2.54mm" },
  "hdr-2x20": { id: "hdr-2x20", name: "Header 2×20 (40)", pins: numbered(40), footprint: "PinHeader_2x20_P2.54mm" },
  "screw-2":  { id: "screw-2",  name: "Screw terminal 2", pins: numbered(2), footprint: "TerminalBlock_P5.0mm_2" },
  "screw-3":  { id: "screw-3",  name: "Screw terminal 3", pins: numbered(3), footprint: "TerminalBlock_P5.0mm_3" },
  "barrel":   { id: "barrel",   name: "Barrel jack 2.1mm", pins: ["+", "-"], footprint: "BarrelJack_Horizontal" },
  "usb-c":    { id: "usb-c",    name: "USB-C receptacle", pins: ["VBUS", "GND", "D+", "D-", "CC1", "CC2", "SBU1", "SBU2"], footprint: "USB_C_Receptacle" },
  "usb-a":    { id: "usb-a",    name: "USB-A receptacle", pins: ["VBUS", "D-", "D+", "GND"], footprint: "USB_A" },
  "usb-mini-b":  { id: "usb-mini-b",  name: "USB Mini-B",  pins: ["VBUS", "D-", "D+", "ID", "GND", "SHIELD"], footprint: "USB_Mini-B" },
  "usb-micro-b": { id: "usb-micro-b", name: "USB Micro-B", pins: ["VBUS", "D-", "D+", "ID", "GND", "SHIELD"], footprint: "USB_Micro-B" },
  "rj45":     { id: "rj45",     name: "RJ45", pins: numbered(8), footprint: "RJ45" },
};

export const connectorPart = (id: string): ConnectorPart | undefined => CONNECTOR_CATALOG[id];
