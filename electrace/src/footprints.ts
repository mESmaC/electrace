// PCB land patterns. Real pad geometry in millimetres for the common package families,
// dimensioned close to IPC-7351 nominal / KiCad libraries. A resolver maps a part (its footprint
// code or, failing that, its type + pin count) to a footprint and a pin→pad map, so the schematic
// pins land on the correct physical pads. Pinouts for 3-terminal parts are sensible *defaults*
// (true pinout is part-specific); the land geometry itself is accurate.
import type { FlatPart } from "./types.js";

export interface LandPad { num: string; x: number; y: number; w: number; h: number; round?: number; drill?: number }
export interface Footprint { id: string; kind: "smd" | "tht"; pads: LandPad[]; w: number; h: number }

const courtyard = (pads: LandPad[], extra = 0.6) => {
  const xs = pads.flatMap((p) => [p.x - p.w / 2, p.x + p.w / 2]);
  const ys = pads.flatMap((p) => [p.y - p.h / 2, p.y + p.h / 2]);
  return { w: Math.max(...xs) - Math.min(...xs) + extra * 2, h: Math.max(...ys) - Math.min(...ys) + extra * 2 };
};
const fp = (id: string, kind: Footprint["kind"], pads: LandPad[], extra?: number): Footprint => ({ id, kind, pads, ...courtyard(pads, extra) });

// ── two-terminal SMD chip land patterns (centre-to-centre gap + pad w×h), KiCad-ish ──────────
const CHIP: Record<string, { c: number; w: number; h: number }> = {
  "0201": { c: 0.46, w: 0.4, h: 0.4 }, "0402": { c: 0.51, w: 0.6, h: 0.65 },
  "0603": { c: 0.825, w: 0.9, h: 0.95 }, "0805": { c: 0.95, w: 1.15, h: 1.4 },
  "1206": { c: 1.475, w: 1.15, h: 1.8 }, "1210": { c: 1.475, w: 1.15, h: 2.65 },
};
const chip = (code: string): Footprint => {
  const s = CHIP[code] ?? CHIP["0805"];
  return fp(code, "smd", [{ num: "1", x: -s.c, y: 0, w: s.w, h: s.h, round: 0.25 }, { num: "2", x: s.c, y: 0, w: s.w, h: s.h, round: 0.25 }]);
};

// ── gull-wing dual (SOIC / SOP / SSOP / TSSOP / MSOP): pin 1 top-left, down left, up right ────
function dual(id: string, n: number, pitch: number, padW: number, padL: number, span: number): Footprint {
  const per = n / 2, pads: LandPad[] = [];
  const y0 = -((per - 1) / 2) * pitch;
  for (let i = 0; i < per; i++) pads.push({ num: `${i + 1}`, x: -span / 2, y: y0 + i * pitch, w: padL, h: padW, round: 0.2 });        // left ↓
  for (let i = 0; i < per; i++) pads.push({ num: `${n - i}`, x: span / 2, y: y0 + i * pitch, w: padL, h: padW, round: 0.2 });          // right (bottom→top)
  return fp(id, "smd", pads);
}

// ── gull-wing quad (QFP / QFN): CCW from pin 1 top-left ──────────────────────────────────────
function quad(id: string, n: number, pitch: number, padW: number, padL: number, span: number): Footprint {
  // distribute n across the 4 sides (extras to the earlier sides) so non-multiples-of-4 don't short a side
  const base = Math.floor(n / 4), extra = n % 4;
  const side = [0, 1, 2, 3].map((i) => base + (i < extra ? 1 : 0)); // left, bottom, right, top
  const startFor = (cnt: number) => -((cnt - 1) / 2) * pitch;       // centre each side's run
  const pads: LandPad[] = [];
  let k = 1, s = startFor(side[0]);
  for (let i = 0; i < side[0]; i++) pads.push({ num: `${k++}`, x: -span / 2, y: s + i * pitch, w: padL, h: padW, round: 0.2 });        // left ↓
  s = startFor(side[1]);
  for (let i = 0; i < side[1]; i++) pads.push({ num: `${k++}`, x: s + i * pitch, y: span / 2, w: padW, h: padL, round: 0.2 });         // bottom →
  s = startFor(side[2]);
  for (let i = 0; i < side[2]; i++) pads.push({ num: `${k++}`, x: span / 2, y: -(s + i * pitch), w: padL, h: padW, round: 0.2 });      // right ↑
  s = startFor(side[3]);
  for (let i = 0; i < side[3]; i++) pads.push({ num: `${k++}`, x: -(s + i * pitch), y: -span / 2, w: padW, h: padL, round: 0.2 });     // top ←
  return fp(id, "smd", pads);
}

// ── through-hole: DIP, pin headers, radial cap, axial diode ───────────────────────────────────
function dip(n: number): Footprint {
  const per = n / 2, pads: LandPad[] = [], y0 = -((per - 1) / 2) * 2.54;
  for (let i = 0; i < per; i++) pads.push({ num: `${i + 1}`, x: -3.81, y: y0 + i * 2.54, w: 1.6, h: 1.6, drill: 0.8, round: i === 0 ? 0 : 0.5 });
  for (let i = 0; i < per; i++) pads.push({ num: `${n - i}`, x: 3.81, y: y0 + i * 2.54, w: 1.6, h: 1.6, drill: 0.8, round: 0.5 });
  return fp(`DIP-${n}`, "tht", pads);
}
function header(n: number, pitch = 2.54): Footprint {
  const pads = Array.from({ length: n }, (_, i) => ({ num: `${i + 1}`, x: (i - (n - 1) / 2) * pitch, y: 0, w: 1.7, h: 1.7, drill: 1.0, round: i === 0 ? 0 : 0.5 }));
  return fp(`HDR-1x${n}`, "tht", pads);
}
/** A `rows`×`cols` pin-header grid (e.g. 2×20). Pads numbered 1..rows*cols column-major (1,2 down the
 *  first column), so a 2×20 lands ~25×5 mm instead of a 100 mm single row. */
function headerGrid(rows: number, cols: number, pitch = 2.54): Footprint {
  const pads: LandPad[] = [];
  const x0 = -((cols - 1) / 2) * pitch, y0 = -((rows - 1) / 2) * pitch;
  let num = 1;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++)
    pads.push({ num: `${num++}`, x: x0 + c * pitch, y: y0 + r * pitch, w: 1.7, h: 1.7, drill: 1.0, round: num === 2 ? 0 : 0.5 });
  return fp(`HDR-${rows}x${cols}`, "tht", pads);
}

/** A physical connector's land pattern, by its catalog id (id encodes geometry better than the part's
 *  footprint string). Pads are numbered in catalog-pin order so the ratsnest maps cleanly. */
export function connectorFootprint(id: string, pins: string[]): { footprint: Footprint; pinToPad: Record<string, string> } {
  const n = pins.length;
  let footprint: Footprint;
  const grid = id.match(/^hdr-(\d+)x(\d+)/);
  if (grid) footprint = headerGrid(Number(grid[1]), Number(grid[2]));
  else if (id.startsWith("hdr-")) footprint = header(n);
  else if (id.startsWith("screw-")) footprint = header(n, 5.0);
  else if (id === "barrel") footprint = SPECIFIC["DCJACK"]();
  else if (id.startsWith("jst-ph")) footprint = header(n, 2.0);   // JST PH: 2.0 mm pitch
  else if (id.startsWith("jst-xh")) footprint = header(n, 2.5);   // JST XH: 2.5 mm pitch
  else if (id === "audio-3.5") footprint = header(n, 2.54);       // TRS jack stand-in: inline THT
  else if (id === "rj45") footprint = headerGrid(2, Math.ceil(n / 2));
  else footprint = header(n); // usb / unknown — placeholder pad row (real USB lands are a later refinement)
  // map each connector pin (in catalog order) to pad number = its position
  const padSet = new Set(footprint.pads.map((p) => p.num));
  const pinToPad: Record<string, string> = {};
  pins.forEach((p, i) => { const pad = `${i + 1}`; if (padSet.has(pad)) pinToPad[p] = pad; });
  return { footprint, pinToPad };
}
function radial(diamMm: number): Footprint {
  const lead = diamMm <= 6.3 ? 2.5 : diamMm <= 8 ? 3.5 : 5.0; // lead spacing by can diameter
  return fp(`RADIAL-${diamMm}MM`, "tht", [
    { num: "1", x: -lead / 2, y: 0, w: 1.6, h: 1.6, drill: 0.8, round: 0 },
    { num: "2", x: lead / 2, y: 0, w: 1.6, h: 1.6, drill: 0.8, round: 0.5 },
  ], 1.2);
}

// ── specific small packages ───────────────────────────────────────────────────────────────────
const SPECIFIC: Record<string, () => Footprint> = {
  "SOT-23": () => fp("SOT-23", "smd", [
    { num: "1", x: -0.95, y: 0.9, w: 1.0, h: 0.9, round: 0.2 }, { num: "2", x: 0.95, y: 0.9, w: 1.0, h: 0.9, round: 0.2 }, { num: "3", x: 0, y: -0.9, w: 1.0, h: 0.9, round: 0.2 },
  ]),
  "SOT-23-5": () => fp("SOT-23-5", "smd", [
    { num: "1", x: -0.95, y: 1.1, w: 0.6, h: 1.0, round: 0.2 }, { num: "2", x: 0, y: 1.1, w: 0.6, h: 1.0, round: 0.2 }, { num: "3", x: 0.95, y: 1.1, w: 0.6, h: 1.0, round: 0.2 },
    { num: "4", x: 0.95, y: -1.1, w: 0.6, h: 1.0, round: 0.2 }, { num: "5", x: -0.95, y: -1.1, w: 0.6, h: 1.0, round: 0.2 },
  ]),
  "SOT-223": () => fp("SOT-223", "smd", [
    { num: "1", x: -2.3, y: 3.0, w: 1.0, h: 1.6, round: 0.2 }, { num: "2", x: 0, y: 3.0, w: 1.0, h: 1.6, round: 0.2 }, { num: "3", x: 2.3, y: 3.0, w: 1.0, h: 1.6, round: 0.2 }, { num: "4", x: 0, y: -3.0, w: 3.6, h: 1.6, round: 0.2 },
  ]),
  "SOD-123": () => fp("SOD-123", "smd", [{ num: "1", x: -1.6, y: 0, w: 0.9, h: 1.2, round: 0.2 }, { num: "2", x: 1.6, y: 0, w: 0.9, h: 1.2, round: 0.2 }]),
  "SMA": () => fp("SMA", "smd", [{ num: "1", x: -2.3, y: 0, w: 1.5, h: 1.6, round: 0.2 }, { num: "2", x: 2.3, y: 0, w: 1.5, h: 1.6, round: 0.2 }]),
  "DO-41": () => fp("DO-41", "tht", [{ num: "1", x: -5.08, y: 0, w: 1.8, h: 1.8, drill: 0.9, round: 0 }, { num: "2", x: 5.08, y: 0, w: 1.8, h: 1.8, drill: 0.9, round: 0.5 }]),
  "HC-49": () => fp("HC-49", "tht", [{ num: "1", x: -2.44, y: 0, w: 1.8, h: 1.8, drill: 0.8, round: 0 }, { num: "2", x: 2.44, y: 0, w: 1.8, h: 1.8, drill: 0.8, round: 0.5 }]),
  "SMB": () => fp("SMB", "smd", [{ num: "1", x: -2.85, y: 0, w: 1.7, h: 2.1, round: 0.2 }, { num: "2", x: 2.85, y: 0, w: 1.7, h: 2.1, round: 0.2 }]),
  "IND-5040": () => fp("IND-5040", "smd", [{ num: "1", x: -1.9, y: 0, w: 1.6, h: 4.6, round: 0.15 }, { num: "2", x: 1.9, y: 0, w: 1.6, h: 4.6, round: 0.15 }]),
  "DCJACK": () => fp("DCJACK", "tht", [
    { num: "1", x: -2.3, y: 0, w: 2.2, h: 2.2, drill: 1.1, round: 0 }, { num: "2", x: 2.3, y: 0, w: 2.2, h: 2.2, drill: 1.1, round: 0.5 }, { num: "3", x: 0, y: -4.5, w: 2.2, h: 2.2, drill: 1.1, round: 0.5 },
  ]),
};

const DUAL_FAM: Record<string, { pitch: number; padW: number; padL: number; span: number }> = {
  SOIC: { pitch: 1.27, padW: 0.6, padL: 1.55, span: 5.4 },
  SOP: { pitch: 1.27, padW: 0.6, padL: 1.55, span: 5.4 },
  SSOP: { pitch: 0.65, padW: 0.4, padL: 1.5, span: 5.72 },
  TSSOP: { pitch: 0.65, padW: 0.41, padL: 1.0, span: 5.6 },
  MSOP: { pitch: 0.65, padW: 0.4, padL: 1.0, span: 4.4 },
};
const QUAD_FAM: Record<string, { pitch: number; padW: number; padL: number }> = {
  QFP: { pitch: 0.8, padW: 0.45, padL: 1.5 }, LQFP: { pitch: 0.5, padW: 0.3, padL: 1.5 },
  TQFP: { pitch: 0.5, padW: 0.3, padL: 1.5 }, QFN: { pitch: 0.5, padW: 0.28, padL: 0.75 },
};

/** Build a footprint from a normalized code like "SOIC-8" / "QFN-32" / "0805" / "HDR-1x4". */
function fromCode(code: string, fallbackN: number): Footprint | null {
  const C = code.toUpperCase();
  if (CHIP[C]) return chip(C);
  if (SPECIFIC[C]) return SPECIFIC[C]();
  if (C.startsWith("RADIAL")) return radial(parseFloat(C.replace(/[^0-9.]/g, "")) || 6.3);
  const m = C.match(/^([A-Z]+)-?(\d+)?/);
  const fam = m?.[1] ?? "", n = m?.[2] ? Number(m[2]) : fallbackN;
  if (DUAL_FAM[fam]) { const d = DUAL_FAM[fam]; return dual(`${fam}-${n}`, n % 2 ? n + 1 : n, d.pitch, d.padW, d.padL, d.span); }
  if (QUAD_FAM[fam]) { const q = QUAD_FAM[fam]; return quad(`${fam}-${n}`, n, q.pitch, q.padW, q.padL, n / 4 * q.pitch + 2.4); }
  if (fam === "DIP") return dip(n % 2 ? n + 1 : n);
  if (C.startsWith("HDR") || fam === "HEADER") return header(n);
  return null;
}

const numeric = (ids: string[]) => ids.every((s) => /^\d+$/.test(s));
const setEq = (ids: string[], want: string[]) => ids.length === want.length && want.every((w) => ids.includes(w));

/** Known pin→pad maps for recognized pin sets; null when we should distribute instead. */
function knownMap(pins: string[]): Record<string, string> | null {
  if (numeric(pins)) return Object.fromEntries(pins.map((p) => [p, p]));   // pin number = pad number
  if (setEq(pins, ["+", "-"])) return { "+": "1", "-": "2" };
  if (setEq(pins, ["B", "C", "E"])) return { B: "1", E: "2", C: "3" };     // common SOT-23 BJT
  if (setEq(pins, ["G", "D", "S"])) return { G: "1", S: "2", D: "3" };     // common SOT-23 FET
  if (setEq(pins, ["IN", "OUT", "GND"])) return { GND: "1", OUT: "2", IN: "3" }; // SOT-223 LDO default
  return null;
}

const QUAD_PROFILES = new Set(["qfp", "lqfp", "tqfp", "qfn"]);
const DUAL_PROFILES = new Set(["soic", "sop", "ssop", "tssop", "msop"]);
/** A package code (→ fromCode) from a chip's profile + pin count, e.g. qfp/32 → "QFP-32". */
export function chipPackageCode(chip: { profile: string; pins: number }): string {
  const p = (chip.profile || "").toLowerCase(), n = chip.pins || 0;
  if (QUAD_PROFILES.has(p) || DUAL_PROFILES.has(p)) return `${p.toUpperCase()}-${n}`;
  if (p === "dip") return `DIP-${n}`;
  if (p === "sot") return n <= 3 ? "SOT-23" : "SOT-23-5";
  return `SOIC-${n}`; // sensible dual default for unknown profiles
}

/** Infer a footprint when the part has no usable `footprint` code, from its type + pin count. */
function infer(type: string, n: number): Footprint {
  switch (type) {
    case "res": case "cap": return chip("0603");
    case "inductor": return chip("1210");
    case "led": return chip("0805");
    case "diode": return SPECIFIC["SOD-123"]();
    case "tvs": return SPECIFIC["SMA"]();
    case "bjt": case "mosfet": return n <= 3 ? SPECIFIC["SOT-23"]() : SPECIFIC["SOT-23-5"]();
    case "ic": return dual(`SOIC-${n <= 8 ? 8 : n}`, n <= 8 ? 8 : (n % 2 ? n + 1 : n), 1.27, 0.6, 1.55, 5.4);
    case "connector": return header(n || 2);
    case "relay": return n > 5 ? dip(n % 2 ? n + 1 : n) : header(n || 5); // multi-pin relay: pads match its pins
    case "crystal": return SPECIFIC["HC-49"]();
    case "battery": case "source": return header(2);
    // the long tail — sensible physical defaults instead of a blind 0805
    case "fuse": return chip("1206");
    case "thermistor": return chip("0603");
    case "ldr": case "phototransistor": return radial(5);     // classic 5 mm THT photo devices
    case "varistor": return radial(7);
    case "scr": case "triac": return header(3, 2.54);         // TO-220 leads: 3 inline at 2.54 mm
    case "jfet": return SPECIFIC["SOT-23"]();
    case "diac": return SPECIFIC["SOD-123"]();
    case "switch": return n <= 2 ? header(2) : dual("TACT-6x6", 4, 4.5, 1.0, 1.4, 6.5); // 6 mm tact
    case "buzzer": return radial(12);
    case "motor": case "speaker": case "lamp": return header(2); // off-board: wire pads
    case "transformer": return header(n || 4, 2.54);
    case "testpoint": return header(1);
    case "antenna": return chip("1206");                       // chip antenna stand-in
    default: return chip("0805");
  }
}

/** Resolve a part to a physical footprint + the map from its schematic pins to pad numbers. */
export function resolveFootprint(part: FlatPart, pins: string[]): { footprint: Footprint; pinToPad: Record<string, string> } {
  // An authored chip lands its REAL package: all pins as pads (not just the wired ones), with its
  // function-named pins (VCC, PD0…) mapped onto the correct physical pad via the chip's map (pad = pin number).
  if (part.chip) {
    const footprint = fromCode(chipPackageCode(part.chip), part.chip.pins) ?? infer("ic", part.chip.pins);
    const padSet = new Set(footprint.pads.map((p) => p.num));
    const fnToNum: Record<string, string> = {};
    for (const [num, fn] of Object.entries(part.chip.names ?? {})) if (fn && !(fn in fnToNum)) fnToNum[fn] = num;
    const pinToPad: Record<string, string> = {};
    for (const pin of pins) { const pad = fnToNum[pin] ?? pin; if (padSet.has(pad)) pinToPad[pin] = pad; }
    return { footprint, pinToPad };
  }
  const code = (part.footprint ?? "").toUpperCase();
  // pull a known chip size out of "C0805" / "R0603", etc.
  const chipKey = Object.keys(CHIP).find((k) => code.includes(k));
  const footprint = (chipKey && chip(chipKey)) || fromCode(code, pins.length) || infer(part.type, pins.length);
  const padNums = footprint.pads.map((p) => p.num);
  const padSet = new Set(padNums);
  const known = knownMap(pins);
  const pinToPad: Record<string, string> = {};
  if (known) {
    for (const [pin, pad] of Object.entries(known)) if (padSet.has(pad)) pinToPad[pin] = pad;
  } else {
    // unrecognized named pins: spread them evenly across the footprint's pads so airwires fan out
    // to distinct pads instead of clustering in one corner (placeholder until real pinouts arrive)
    const n = pins.length;
    pins.forEach((pin, i) => {
      const idx = n <= 1 ? 0 : Math.round((i * (padNums.length - 1)) / (n - 1));
      pinToPad[pin] = padNums[Math.min(idx, padNums.length - 1)];
    });
  }
  return { footprint, pinToPad };
}
