// Machine-readable catalog of the building blocks an editor/agent can place: each symbol's
// pin ids, its BOM part type, and how it groups in a palette. This is the canonical vocabulary
// — validation checks layouts against it, and an authoring agent reads it to know, e.g., that a
// regulator has pins IN/OUT/GND and a resistor has 1/2. (The web editor adds the drawings.)

export type SymbolGroup =
  | "passive" | "diode" | "transistor" | "integrated"
  | "source" | "power" | "electromechanical" | "connector" | "port";

export interface CatalogEntry {
  label: string;
  group: SymbolGroup;
  defaultRef: string;   // reference-designator prefix (R, C, U, …)
  partType: string;     // BOM/part type the symbol maps to
  pins: string[];       // pin ids (empty + parametric:true for chips)
  parametric?: boolean; // pins depend on a package profile + count (chips)
  terminal?: boolean;   // a block boundary terminal, not a real part (the `port` symbol)
}

export const SYMBOL_CATALOG: Record<string, CatalogEntry> = {
  // ── Passive
  resistor:      { label: "Resistor", group: "passive", defaultRef: "R", partType: "res", pins: ["1", "2"] },
  potentiometer: { label: "Potentiometer", group: "passive", defaultRef: "RV", partType: "res", pins: ["1", "2", "W"] },
  capacitor:     { label: "Capacitor", group: "passive", defaultRef: "C", partType: "cap", pins: ["1", "2"] },
  "cap-pol":     { label: "Polarized Cap", group: "passive", defaultRef: "C", partType: "cap", pins: ["1", "2"] },
  inductor:      { label: "Inductor", group: "passive", defaultRef: "L", partType: "inductor", pins: ["1", "2"] },
  transformer:   { label: "Transformer", group: "passive", defaultRef: "T", partType: "transformer", pins: ["P1", "P2", "S1", "S2"] },
  ferrite:       { label: "Ferrite Bead", group: "passive", defaultRef: "FB", partType: "inductor", pins: ["1", "2"] },
  crystal:       { label: "Crystal", group: "passive", defaultRef: "Y", partType: "crystal", pins: ["1", "2"] },
  fuse:          { label: "Fuse", group: "passive", defaultRef: "F", partType: "fuse", pins: ["1", "2"] },
  // ── Diode
  diode:      { label: "Diode", group: "diode", defaultRef: "D", partType: "diode", pins: ["1", "2"] },
  schottky:   { label: "Schottky", group: "diode", defaultRef: "D", partType: "diode", pins: ["1", "2"] },
  zener:      { label: "Zener", group: "diode", defaultRef: "D", partType: "diode", pins: ["1", "2"] },
  led:        { label: "LED", group: "diode", defaultRef: "D", partType: "led", pins: ["1", "2"] },
  photodiode: { label: "Photodiode", group: "diode", defaultRef: "D", partType: "diode", pins: ["1", "2"] },
  // ── Transistor
  npn:  { label: "NPN BJT", group: "transistor", defaultRef: "Q", partType: "bjt", pins: ["B", "C", "E"] },
  pnp:  { label: "PNP BJT", group: "transistor", defaultRef: "Q", partType: "bjt", pins: ["B", "C", "E"] },
  nmos: { label: "N-MOSFET", group: "transistor", defaultRef: "Q", partType: "mosfet", pins: ["G", "D", "S"] },
  pmos: { label: "P-MOSFET", group: "transistor", defaultRef: "Q", partType: "mosfet", pins: ["G", "D", "S"] },
  // ── Integrated
  ic:        { label: "IC", group: "integrated", defaultRef: "U", partType: "ic", pins: ["1", "2", "3", "4"] },
  opamp:     { label: "Op-Amp", group: "integrated", defaultRef: "U", partType: "ic", pins: ["in+", "in-", "out"] },
  regulator: { label: "Regulator", group: "integrated", defaultRef: "U", partType: "ic", pins: ["IN", "OUT", "GND"] },
  chip:      { label: "Chip / IC", group: "integrated", defaultRef: "U", partType: "ic", pins: [], parametric: true },
  // ── Source
  battery:  { label: "Battery / Source", group: "source", defaultRef: "BT", partType: "battery", pins: ["+", "-"] },
  isource:  { label: "Current Source", group: "source", defaultRef: "I", partType: "source", pins: ["1", "2"] },
  acsource: { label: "AC Source", group: "source", defaultRef: "V", partType: "source", pins: ["1", "2"] },
  // ── Power
  ground: { label: "Ground", group: "power", defaultRef: "GND", partType: "gnd", pins: ["1"] },
  vcc:    { label: "Power (V+)", group: "power", defaultRef: "VCC", partType: "power", pins: ["1"] },
  // ── Electromechanical
  switch:  { label: "Switch", group: "electromechanical", defaultRef: "SW", partType: "switch", pins: ["1", "2"] },
  button:  { label: "Push Button", group: "electromechanical", defaultRef: "SW", partType: "switch", pins: ["1", "2"] },
  relay:   { label: "Relay", group: "electromechanical", defaultRef: "K", partType: "relay", pins: ["A", "B", "COM", "NO", "NC"] },
  motor:   { label: "Motor", group: "electromechanical", defaultRef: "M", partType: "motor", pins: ["1", "2"] },
  speaker: { label: "Speaker", group: "electromechanical", defaultRef: "LS", partType: "speaker", pins: ["1", "2"] },
  buzzer:  { label: "Buzzer", group: "electromechanical", defaultRef: "BZ", partType: "buzzer", pins: ["1", "2"] },
  lamp:    { label: "Lamp", group: "electromechanical", defaultRef: "LP", partType: "lamp", pins: ["1", "2"] },
  // ── Connector
  header2:   { label: "Header 2", group: "connector", defaultRef: "J", partType: "connector", pins: ["1", "2"] },
  header4:   { label: "Header 4", group: "connector", defaultRef: "J", partType: "connector", pins: ["1", "2", "3", "4"] },
  testpoint: { label: "Test Point", group: "connector", defaultRef: "TP", partType: "testpoint", pins: ["1"] },
  antenna:   { label: "Antenna", group: "connector", defaultRef: "ANT", partType: "antenna", pins: ["1"] },
  // ── Boundary
  port: { label: "Port", group: "port", defaultRef: "P", partType: "port", pins: ["1"], terminal: true },
};

/** Chip package families and their pin-numbering scheme. */
export const PACKAGES: { id: string; name: string; kind: "dual" | "quad" | "grid" }[] = [
  { id: "dip", name: "DIP", kind: "dual" }, { id: "soic", name: "SOIC", kind: "dual" },
  { id: "tssop", name: "TSSOP", kind: "dual" }, { id: "ssop", name: "SSOP", kind: "dual" },
  { id: "msop", name: "MSOP", kind: "dual" }, { id: "sot23", name: "SOT-23", kind: "dual" },
  { id: "qfp", name: "QFP", kind: "quad" }, { id: "lqfp", name: "LQFP", kind: "quad" },
  { id: "tqfp", name: "TQFP", kind: "quad" }, { id: "qfn", name: "QFN", kind: "quad" },
  { id: "bga", name: "BGA", kind: "grid" },
];

/** Pin ids for a parametric chip — 1..N for dual/quad, A1.. row-major for BGA grids. */
export function chipPinIds(profile: string, count: number): string[] {
  const n = Math.max(1, Math.floor(count));
  const kind = PACKAGES.find((p) => p.id === profile)?.kind ?? "dual";
  if (kind !== "grid") return Array.from({ length: n }, (_, i) => `${i + 1}`);
  const cols = Math.ceil(Math.sqrt(n)), ids: string[] = [];
  for (let r = 0; ids.length < n; r++) for (let c = 0; c < cols && ids.length < n; c++) ids.push(`${String.fromCharCode(65 + r)}${c + 1}`);
  return ids;
}

/** Pin ids for any catalog symbol (`chip` needs profile/count, supplied via opts). */
export function pinsOf(type: string, opts?: { profile?: string; count?: number }): string[] {
  const e = SYMBOL_CATALOG[type];
  if (!e) return [];
  if (e.parametric && opts?.count) return chipPinIds(opts.profile ?? "soic", opts.count);
  return e.pins;
}
