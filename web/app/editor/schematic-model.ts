// Shared, pure helpers for the block schematic model — used by both the interactive
// editor (BlockSchematic) and the static thumbnail (SchematicPreview).
import { SYMBOLS } from "./symbols";
import { type SchematicLayout, type SchEndpoint } from "@electrace/core";

export type Pt = { x: number; y: number };
export interface PinRef { sym: string; pin: string }
export type Endpoint = PinRef | Pt; // a wire end is either a symbol pin or a free (floating) point
export interface Pin { id: string; x: number; y: number; label?: string }
export interface Dims { w: number; h: number; pins: Pin[]; body?: { x: number; y: number; w: number; h: number }; pin1?: Pt }
/** A parametric chip: a package profile + pin count + (optionally AI/user-filled) pin names and MPN. */
export interface ChipSpec { profile: string; pins: number; names?: Record<string, string>; mpn?: string }
export interface Sym { id: string; type: string; ref?: string; value?: string; x: number; y: number; rot?: number; chip?: ChipSpec }
export interface Wire { id: string; a: Endpoint; b: Endpoint; mid: Pt[] }
export interface Model { syms: Sym[]; wires: Wire[] }

export const isPin = (e: Endpoint): e is PinRef => "sym" in e;

export const WIRE_COLOR = { ok: "#46dca6", floating: "#f7b13c", error: "#ef5d6b" } as const;
export type WireState = keyof typeof WIRE_COLOR;

export const normRot = (r: number) => ((r % 360) + 360) % 360;

// ── Parametric chip packages ───────────────────────────────────────────────
export const PROFILES: { id: string; name: string; kind: "dual" | "quad" | "grid" }[] = [
  { id: "dip", name: "DIP", kind: "dual" },
  { id: "soic", name: "SOIC", kind: "dual" },
  { id: "tssop", name: "TSSOP", kind: "dual" },
  { id: "ssop", name: "SSOP", kind: "dual" },
  { id: "msop", name: "MSOP", kind: "dual" },
  { id: "sot23", name: "SOT-23", kind: "dual" },
  { id: "qfp", name: "QFP", kind: "quad" },
  { id: "lqfp", name: "LQFP", kind: "quad" },
  { id: "tqfp", name: "TQFP", kind: "quad" },
  { id: "qfn", name: "QFN", kind: "quad" },
  { id: "bga", name: "BGA", kind: "grid" },
];
export const profileKind = (id: string) => PROFILES.find((p) => p.id === id)?.kind ?? "dual";

// All grid-aligned (multiples of 10) so a chip's pins land on the editor grid once its first pin is
// anchor-snapped — keeping pins collinear across parts and letting orthogonal wires meet them cleanly.
const PITCH = 20, STUB = 10, MARGIN = 20, GP = 20;

/** Geometry for a package: body box + pin coordinates, numbered the standard way
 *  (CCW from pin 1 at top-left for dual/quad; row-major A1.. for BGA grids). */
export function chipGeometry(profile: string, count: number): Dims {
  const n = Math.max(1, Math.floor(count));
  const kind = profileKind(profile);
  const pins: Pin[] = [];

  if (kind === "grid") {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const PAD = 10;
    const w = cols * GP + 2 * PAD, h = rows * GP + 2 * PAD;
    let k = 0;
    for (let r = 0; r < rows && k < n; r++) for (let c = 0; c < cols && k < n; c++, k++) {
      pins.push({ id: `${String.fromCharCode(65 + r)}${c + 1}`, x: PAD + GP / 2 + c * GP, y: PAD + GP / 2 + r * GP });
    }
    return { w, h, pins, body: { x: 6, y: 6, w: w - 12, h: h - 12 } };
  }

  if (kind === "quad") {
    const base = Math.floor(n / 4), extra = n % 4;
    const side = [0, 1, 2, 3].map((i) => base + (i < extra ? 1 : 0)); // left, bottom, right, top
    const inner = (Math.max(...side, 1) - 1) * PITCH + 2 * MARGIN;
    const w = inner + 2 * STUB, h = inner + 2 * STUB, start = STUB + MARGIN;
    let id = 1;
    for (let i = 0; i < side[0]; i++) pins.push({ id: `${id++}`, x: 0, y: start + i * PITCH });
    for (let i = 0; i < side[1]; i++) pins.push({ id: `${id++}`, x: start + i * PITCH, y: h });
    for (let i = 0; i < side[2]; i++) pins.push({ id: `${id++}`, x: w, y: h - start - i * PITCH });
    for (let i = 0; i < side[3]; i++) pins.push({ id: `${id++}`, x: w - start - i * PITCH, y: 0 });
    return { w, h, pins, body: { x: STUB, y: STUB, w: inner, h: inner }, pin1: { x: STUB + 5, y: STUB + 5 } };
  }

  // dual (DIP / SOIC / TSSOP / SOT…): pin 1 top-left, down the left, up the right
  const left = Math.ceil(n / 2), right = n - left;
  const rows = Math.max(left, right, 1);
  const h = MARGIN * 2 + (rows - 1) * PITCH, w = 70;
  for (let i = 0; i < left; i++) pins.push({ id: `${i + 1}`, x: 0, y: MARGIN + i * PITCH });
  for (let i = 0; i < right; i++) pins.push({ id: `${n - i}`, x: w, y: MARGIN + i * PITCH });
  return { w, h, pins, body: { x: STUB, y: 6, w: w - 2 * STUB, h: h - 12 }, pin1: { x: STUB + 5, y: MARGIN } };
}

/** Resolved geometry for any symbol — chip geometry for chips, else its static symbol def. */
export function symDims(s: Sym): Dims | null {
  if (s.chip) {
    const g = chipGeometry(s.chip.profile, s.chip.pins);
    const names = s.chip.names ?? {};
    return { ...g, pins: g.pins.map((p) => ({ ...p, label: names[p.id] || p.id })) };
  }
  const def = SYMBOLS[s.type];
  return def ? { w: def.w, h: def.h, pins: def.pins } : null;
}

/** Map a local point of a symbol's box to absolute coords, honouring the symbol's rotation
 *  (about its box centre). Mirrors the SVG `translate(x,y) rotate(rot cx cy)` transform exactly,
 *  so net/wire geometry agrees with what's drawn. */
export function symPoint(s: Sym, px: number, py: number, w: number, h: number): Pt {
  const cx = w / 2, cy = h / 2;
  const dx = px - cx, dy = py - cy;
  const rot = normRot(s.rot ?? 0);
  let rx = dx, ry = dy;
  if (rot === 90) { rx = -dy; ry = dx; }
  else if (rot === 180) { rx = -dx; ry = -dy; }
  else if (rot === 270) { rx = dy; ry = -dx; }
  return { x: s.x + cx + rx, y: s.y + cy + ry };
}

/** Axis-aligned bounding box of a (possibly rotated) symbol in absolute coords. */
export function symBounds(s: Sym, w: number, h: number): { minX: number; minY: number; maxX: number; maxY: number } {
  const cs = [symPoint(s, 0, 0, w, h), symPoint(s, w, 0, w, h), symPoint(s, w, h, w, h), symPoint(s, 0, h, w, h)];
  return {
    minX: Math.min(...cs.map((c) => c.x)), minY: Math.min(...cs.map((c) => c.y)),
    maxX: Math.max(...cs.map((c) => c.x)), maxY: Math.max(...cs.map((c) => c.y)),
  };
}

export function pinAbs(syms: Sym[], r: PinRef): Pt | null {
  const s = syms.find((x) => x.id === r.sym);
  if (!s) return null;
  const d = symDims(s);
  const pin = d?.pins.find((p) => p.id === r.pin);
  if (!d || !pin) return null;
  return symPoint(s, pin.x, pin.y, d.w, d.h);
}

export function endAbs(syms: Sym[], e: Endpoint): Pt | null {
  return isPin(e) ? pinAbs(syms, e) : { x: e.x, y: e.y };
}

/** A pin sitting exactly at (x, y), if any — lets a wire dropped on a pin count as connected. */
export function pinAtCoord(syms: Sym[], x: number, y: number): { sym: string; pin: string } | null {
  for (const s of syms) {
    const d = symDims(s);
    if (!d) continue;
    for (const p of d.pins) {
      const ap = symPoint(s, p.x, p.y, d.w, d.h);
      if (ap.x === x && ap.y === y) return { sym: s.id, pin: p.id };
    }
  }
  return null;
}

/** The pin nearest (x, y) within `tol`, in absolute coords — lets a wire end snap onto a pin instead
 *  of demanding a pixel-perfect click on the dot. */
export function nearestPin(syms: Sym[], x: number, y: number, tol: number): { sym: string; pin: string; x: number; y: number } | null {
  let best: { sym: string; pin: string; x: number; y: number } | null = null;
  let bestD = tol * tol;
  for (const s of syms) {
    const d = symDims(s);
    if (!d) continue;
    for (const p of d.pins) {
      const ap = symPoint(s, p.x, p.y, d.w, d.h);
      const dd = (ap.x - x) ** 2 + (ap.y - y) ** 2;
      if (dd <= bestD) { bestD = dd; best = { sym: s.id, pin: p.id, x: ap.x, y: ap.y }; }
    }
  }
  return best;
}

/** Snap a symbol's ORIGIN so its first pin lands exactly on the grid (honouring rotation). Off-grid
 *  local pin offsets (a resistor pin at y=14, a ground at x=17) are absorbed here, so a placed/moved
 *  part's pins fall on grid lines — orthogonal wires then meet them without a jog, and parts whose
 *  pin pitch is grid-aligned stay collinear. */
export function anchorOrigin(s: Sym, x: number, y: number, grid = 10): Pt {
  const r = (n: number) => Math.round(n / grid) * grid;
  const d = symDims(s);
  const pin = d?.pins[0];
  if (!d || !pin) return { x: r(x), y: r(y) };
  const ap = symPoint({ ...s, x, y }, pin.x, pin.y, d.w, d.h); // where pin 0 lands for origin (x, y)
  return { x: x + (r(ap.x) - ap.x), y: y + (r(ap.y) - ap.y) };
}

/** Resolve an editor wire end to a core endpoint: a real pin, a floating point, or a broken ref. */
export function toSchEndpoint(syms: Sym[], e: Endpoint, key: string): SchEndpoint {
  if (isPin(e)) {
    const s = syms.find((x) => x.id === e.sym);
    const ok = !!(s && symDims(s)?.pins.some((p) => p.id === e.pin));
    return ok ? { kind: "pin", sym: e.sym, pin: e.pin } : { kind: "broken", key };
  }
  const hit = pinAtCoord(syms, e.x, e.y);
  return hit ? { kind: "pin", sym: hit.sym, pin: hit.pin } : { kind: "free", key: `${e.x},${e.y}` };
}

/** Expand control points into the orthogonal corner sequence (horizontal then vertical). */
export function expand(points: Pt[]): Pt[] {
  if (!points.length) return [];
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i];
    out.push({ x: q.x, y: p.y }, { x: q.x, y: q.y });
  }
  return out;
}

/** Axis-aligned segments (zero-length removed) of an orthogonal point run. */
export function segmentsOf(points: Pt[]): { h: boolean; x1: number; y1: number; x2: number; y2: number }[] {
  const ex = expand(points), out = [];
  for (let i = 1; i < ex.length; i++) {
    const p = ex[i - 1], q = ex[i];
    if (p.x === q.x && p.y === q.y) continue;
    out.push({ h: p.y === q.y, x1: p.x, y1: p.y, x2: q.x, y2: q.y });
  }
  return out;
}

/** Orthogonal path string for an expanded run. */
export function ortho(points: Pt[]): string {
  const ex = expand(points);
  if (!ex.length) return "";
  return ex.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
}

export function layoutToModel(layout?: SchematicLayout): Model {
  if (!layout) return { syms: [], wires: [] };
  return {
    syms: layout.symbols.map((s) => ({ id: s.id, type: s.type, ref: s.ref, value: s.value, x: s.x, y: s.y, rot: s.rot, chip: s.chip })),
    wires: layout.wires.map((w, i) => {
      const [as, ap] = w.from.split(".");
      const [bs, bp] = w.to.split(".");
      return { id: `w${i}`, a: { sym: as, pin: ap }, b: { sym: bs, pin: bp }, mid: [] };
    }),
  };
}

/** Serialize an editor model back to the core SchematicLayout (the persisted/derivable form).
 *  Only pin-connected wires survive — floating ends carry no connectivity. Waypoints are visual. */
export function modelToLayout(model: Model): SchematicLayout {
  return {
    symbols: model.syms.map((s) => ({ id: s.id, type: s.type, ref: s.ref, value: s.value, x: s.x, y: s.y, rot: s.rot, chip: s.chip })),
    wires: model.wires
      .filter((w) => isPin(w.a) && isPin(w.b))
      .map((w) => ({ from: `${(w.a as PinRef).sym}.${(w.a as PinRef).pin}`, to: `${(w.b as PinRef).sym}.${(w.b as PinRef).pin}` })),
  };
}

/** The model to show for a block: a non-empty saved draft if present, else the authored layout. */
export function pickModel(blockId: string, layout?: SchematicLayout): Model {
  try {
    const raw = localStorage.getItem(`electrace:blocksch:${blockId}`);
    if (raw) { const d = JSON.parse(raw); if (Array.isArray(d.syms) && d.syms.length) return d; }
  } catch { /* ignore */ }
  return layoutToModel(layout);
}

/** Bounding box of a model's symbols + wire vertices (for fit-to-view). */
export function modelBounds(model: Model): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const note = (x: number, y: number) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const s of model.syms) {
    const d = symDims(s);
    if (!d) continue;
    const b = symBounds(s, d.w, d.h);
    note(b.minX, b.minY); note(b.maxX, b.maxY);
  }
  for (const w of model.wires) {
    for (const e of [w.a, w.b]) { const p = endAbs(model.syms, e); if (p) note(p.x, p.y); }
    for (const m of w.mid) note(m.x, m.y);
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
