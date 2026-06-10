// Shared, pure helpers for the block schematic model — used by both the interactive
// editor (BlockSchematic) and the static thumbnail (SchematicPreview).
import { SYMBOLS } from "./symbols";
import { type SchematicLayout, type SchEndpoint } from "@electrace/core";

export type Pt = { x: number; y: number };
export interface PinRef { sym: string; pin: string }
/** A junction tap BOUND to its host wire: `t` is the fraction (0..1, by arc length) along the host's
 *  drawn path. Bound taps move WITH the host when its symbols drag or Align re-snaps — unlike the
 *  legacy fixed-coordinate taps (a free Pt that merely lies on the wire), which strand when it moves. */
export interface WireTap { wire: string; t: number }
export type Endpoint = PinRef | Pt | WireTap; // a wire end: a symbol pin, a bound tap, or a free (floating) point
export interface Pin { id: string; x: number; y: number; label?: string }
export interface Dims { w: number; h: number; pins: Pin[]; body?: { x: number; y: number; w: number; h: number }; pin1?: Pt }
/** A parametric chip: a package profile + pin count + (optionally AI/user-filled) pin names and MPN. */
export interface ChipSpec { profile: string; pins: number; names?: Record<string, string>; mpn?: string }
export interface Sym { id: string; type: string; ref?: string; value?: string; x: number; y: number; rot?: number; chip?: ChipSpec }
export interface Wire { id: string; a: Endpoint; b: Endpoint; mid: Pt[] }
export interface Model { syms: Sym[]; wires: Wire[] }

export const isPin = (e: Endpoint): e is PinRef => "sym" in e;
export const isTap = (e: Endpoint): e is WireTap => "wire" in e;

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

export function endAbs(syms: Sym[], e: Endpoint, wires: Wire[] = [], seen?: Set<string>): Pt | null {
  if (isPin(e)) return pinAbs(syms, e);
  if (isTap(e)) {
    if (seen?.has(e.wire)) return null; // tap cycle (A taps B taps A) — treat as broken
    const host = wires.find((w) => w.id === e.wire);
    if (!host) return null; // host wire deleted
    const s = new Set(seen); s.add(e.wire);
    return pointAt(expand(wireAbsPath(syms, host, wires, s)), e.t);
  }
  return { x: e.x, y: e.y };
}

/** The point a fraction `t` (0..1, by arc length) along an orthogonal point run. */
function pointAt(pts: Pt[], t: number): Pt | null {
  if (!pts.length) return null;
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
  if (!total) return pts[0];
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    if (want <= L || i === pts.length - 1) {
      const f = L ? Math.min(1, want / L) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
    }
    want -= L;
  }
  return pts[pts.length - 1];
}

/** Auto-orient every port so its pin faces the wire it connects to (snapped to the nearest cardinal).
 *  Authors — and AI — shouldn't have to hand-set port rotation; getting it wrong is the usual cause of
 *  "ports point the wrong way / look disconnected". We compare the port's (rotation-invariant) center to
 *  the OTHER end of its wire, so there's no chicken-and-egg with the pin position. Non-ports untouched. */
export function orientPorts(model: Model): Model {
  const rotFor = (p: Sym): number | undefined => {
    const cx = p.x + 15, cy = p.y + 10; // port symbol is 30×20
    for (const w of model.wires) {
      const other: Endpoint | null = isPin(w.a) && w.a.sym === p.id ? w.b : isPin(w.b) && w.b.sym === p.id ? w.a : null;
      if (!other) continue;
      const o = endAbs(model.syms, other, model.wires);
      if (!o) continue;
      const dx = o.x - cx, dy = o.y - cy;
      // pin-side by rotation: 0 → left, 180 → right, 90 → top, 270 → bottom
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 180 : 0;
      return dy >= 0 ? 270 : 90;
    }
    return undefined;
  };
  return { ...model, syms: model.syms.map((s) => (s.type === "port" ? { ...s, rot: rotFor(s) ?? s.rot ?? 0 } : s)) };
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

/** Resolve an editor wire end to a core endpoint: a real pin, a floating point, or a broken ref.
 *  A bound tap resolves to its HOST wire's `a` endpoint — electrically the tap IS the host's net. */
export function toSchEndpoint(syms: Sym[], e: Endpoint, key: string, wires: Wire[] = [], seen?: Set<string>): SchEndpoint {
  if (isPin(e)) {
    const s = syms.find((x) => x.id === e.sym);
    const ok = !!(s && symDims(s)?.pins.some((p) => p.id === e.pin));
    return ok ? { kind: "pin", sym: e.sym, pin: e.pin } : { kind: "broken", key };
  }
  if (isTap(e)) {
    if (seen?.has(e.wire)) return { kind: "broken", key };
    const host = wires.find((w) => w.id === e.wire);
    if (!host) return { kind: "broken", key };
    const s = new Set(seen); s.add(e.wire);
    return toSchEndpoint(syms, host.a, `${host.id}:a`, wires, s);
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
      return { id: `w${i}`, a: { sym: as, pin: ap }, b: { sym: bs, pin: bp }, mid: (w.via ?? []).map(([x, y]) => ({ x, y })) };
    }),
  };
}

/** The absolute orthogonal point run of a wire: [start, …waypoints, end]. */
export function wireAbsPath(syms: Sym[], w: Wire, wires: Wire[] = [], seen?: Set<string>): Pt[] {
  const a = endAbs(syms, w.a, wires, seen), b = endAbs(syms, w.b, wires, seen);
  if (!a || !b) return [];
  return [a, ...w.mid, b];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The closest point lying ON any wire's segment within `tol` (a junction tap point), or null. Skips
 *  `excludeId` (the wire being drawn) so it can't tap itself. `t` is the arc-length fraction of that
 *  point along the wire's drawn path — store `{ wire, t }` so the tap stays bound when the wire moves. */
export function nearestWirePoint(syms: Sym[], wires: Wire[], p: Pt, tol: number, excludeId?: string): { x: number; y: number; wireId: string; t: number } | null {
  let best: { x: number; y: number; wireId: string; t: number } | null = null;
  let bestD = tol * tol;
  for (const w of wires) {
    if (w.id === excludeId) continue;
    const pts = expand(wireAbsPath(syms, w, wires));
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    let cum = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const h = a.y === b.y;
      const L = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const qx = h ? clamp(p.x, Math.min(a.x, b.x), Math.max(a.x, b.x)) : a.x;
      const qy = h ? a.y : clamp(p.y, Math.min(a.y, b.y), Math.max(a.y, b.y));
      const dd = (qx - p.x) ** 2 + (qy - p.y) ** 2;
      if (dd <= bestD) {
        const along = Math.abs(qx - a.x) + Math.abs(qy - a.y);
        bestD = dd; best = { x: qx, y: qy, wireId: w.id, t: total ? (cum + along) / total : 0 };
      }
      cum += L;
    }
  }
  return best;
}

const ptOnSeg = (P: Pt, s: { h: boolean; x1: number; y1: number; x2: number; y2: number }, eps = 0.01): boolean =>
  s.h ? Math.abs(P.y - s.y1) <= eps && P.x >= Math.min(s.x1, s.x2) - eps && P.x <= Math.max(s.x1, s.x2) + eps
      : Math.abs(P.x - s.x1) <= eps && P.y >= Math.min(s.y1, s.y2) - eps && P.y <= Math.max(s.y1, s.y2) + eps;

/** The id of a wire whose segment passes exactly through P (a junction tap), or null. Skips `excludeId`. */
export function wireAtPoint(syms: Sym[], wires: Wire[], P: Pt, excludeId?: string): string | null {
  for (const v of wires) {
    if (v.id === excludeId) continue;
    if (segmentsOf(wireAbsPath(syms, v, wires)).some((s) => ptOnSeg(P, s))) return v.id;
  }
  return null;
}

/** Extra pin-to-pin connections implied by junctions: a free wire end that lands on another wire (a
 *  mid-span tap) or coincides with another free end joins their nets. Returns minimal bridges across the
 *  pin-wired components that a junction merges — so connectivity follows the drawing, not just pin pairs. */
export function junctionBridges(model: Model): { from: string; to: string }[] {
  const { syms, wires } = model;
  const pinOf = (e: Endpoint): string | null => {
    if (isPin(e)) return `${e.sym}.${e.pin}`;
    if (isTap(e)) return null; // bound taps connect via their host, below
    const hit = pinAtCoord(syms, e.x, e.y);
    return hit ? `${hit.sym}.${hit.pin}` : null;
  };
  const keyOf = (e: Endpoint): string => {
    const p = pinOf(e);
    if (p) return p;
    if (isTap(e)) { const at = endAbs(syms, e, wires); return at ? `@${at.x},${at.y}` : `~broken:${e.wire}:${e.t}`; }
    return `@${(e as Pt).x},${(e as Pt).y}`;
  };

  // geometric union-find over every endpoint node (pin keys + free-coord keys)
  const par = new Map<string, string>();
  const find = (x: string): string => { if (!par.has(x)) par.set(x, x); let r = x; while (par.get(r) !== r) r = par.get(r)!; return r; };
  const union = (a: string, b: string) => { par.set(find(a), find(b)); };
  for (const w of wires) union(keyOf(w.a), keyOf(w.b)); // two ends of a wire (and coincident free ends, by shared key)
  for (const w of wires) {
    for (const e of [w.a, w.b]) {
      if (isTap(e)) {
        // a BOUND tap joins its host wire's net by reference — no geometry involved
        const host = wires.find((x) => x.id === e.wire);
        if (host) union(keyOf(e), keyOf(host.a));
        continue;
      }
      if (pinOf(e) !== null) continue; // pin / on-a-pin ends already connect by key
      // legacy fixed-coordinate tap: a free end lying on another wire's segment taps it
      const hit = wireAtPoint(syms, wires, e as Pt, w.id);
      if (hit) { const v = wires.find((x) => x.id === hit)!; union(keyOf(e), keyOf(v.a)); }
    }
  }
  // direct union-find: pins joined by genuine pin-to-pin wires (what core already gets)
  const dpar = new Map<string, string>();
  const dfind = (x: string): string => { if (!dpar.has(x)) dpar.set(x, x); let r = x; while (dpar.get(r) !== r) r = dpar.get(r)!; return r; };
  for (const w of wires) { const a = pinOf(w.a), b = pinOf(w.b); if (a && b) dpar.set(dfind(a), dfind(b)); }

  // for each geometric net, bridge the distinct pin-wired components a junction merged
  const geoNets = new Map<string, string[]>();
  for (const k of par.keys()) { if (k.startsWith("@")) continue; const r = find(k); (geoNets.get(r) ?? geoNets.set(r, []).get(r)!).push(k); }
  const bridges: { from: string; to: string }[] = [];
  for (const pins of geoNets.values()) {
    const reps = new Map<string, string>(); // direct-root → representative pin
    for (const p of pins) { const dr = dfind(p); if (!reps.has(dr)) reps.set(dr, p); }
    const rs = [...reps.values()];
    for (let i = 1; i < rs.length; i++) bridges.push({ from: rs[0], to: rs[i] });
  }
  return bridges;
}

/** Serialize an editor model back to the core SchematicLayout (the persisted/derivable form). Genuine
 *  pin-to-pin wires survive as-is (preserving the picture); junction taps (a wire ending on another wire)
 *  add bridge connections so they're electrically joined. Floating ends carry no connectivity. */
export function modelToLayout(model: Model): SchematicLayout {
  return {
    symbols: model.syms.map((s) => ({ id: s.id, type: s.type, ref: s.ref, value: s.value, x: s.x, y: s.y, rot: s.rot, chip: s.chip })),
    wires: [
      ...model.wires
        .filter((w) => isPin(w.a) && isPin(w.b))
        .map((w) => ({
          from: `${(w.a as PinRef).sym}.${(w.a as PinRef).pin}`, to: `${(w.b as PinRef).sym}.${(w.b as PinRef).pin}`,
          ...(w.mid.length ? { via: w.mid.map((p) => [p.x, p.y] as [number, number]) } : {}), // bends survive the round-trip
        })),
      ...junctionBridges(model),
    ],
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

// ── label placement ────────────────────────────────────────────────────────
// Labels (ref + value) must never sit on other text, symbols, or wires. Strategy:
//  · big-bodied parts (chips, ICs, regulators, op-amps) carry their label ON the body;
//  · IEC box-style passives (resistor/fuse/ferrite, drawn horizontal) take the VALUE inside
//    the box — that's what the box is for — with the ref placed beside;
//  · everything else tries a ring of candidate spots around the symbol (preferring the side
//    away from a port's wire) and takes the first collision-free one;
//  · when the winning spot is far from the symbol, the label gets a light dotted leader line
//    back to its component so ownership stays obvious.

export interface PlacedLabel {
  sym: string;
  lines: string[];            // word-wrapped — long labels break instead of running over neighbours
  x: number; y: number;       // anchor: textAnchor=middle, first line's baseline derived from these
  fontSize: number;
  inside?: boolean;           // mounted on the body
  port?: boolean;             // styling hint (ports colour their label by net type)
  leader?: { x1: number; y1: number; x2: number; y2: number };
}

type LRect = { x: number; y: number; w: number; h: number };
const lrOverlap = (a: LRect, b: LRect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const labelW = (text: string, fs: number) => Math.max(10, text.length * fs * 0.62);
const LINE_H = (fs: number) => fs + 2.5;

/** Greedy word-wrap to a pixel budget — a long label becomes a small stack, not a runway. */
export function wrapLabel(text: string, fs: number, maxW = 86): string[] {
  if (labelW(text, fs) <= maxW) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && labelW(next, fs) > maxW) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
const blockW = (lines: string[], fs: number) => Math.max(...lines.map((l) => labelW(l, fs)));
const blockH = (lines: string[], fs: number) => lines.length * LINE_H(fs);
const ON_BODY = new Set(["chip", "ic", "regulator", "opamp", "relay", "ssr"]);
const IEC_BOX = new Set(["resistor", "fuse", "ferrite", "thermistor", "ldr", "varistor"]);

/** Where a segment from `from` toward the centre of `r` crosses r's edge (for leader endpoints). */
function edgeToward(r: LRect, from: Pt): Pt {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const dx = cx - from.x, dy = cy - from.y;
  let t = 1;
  if (dx) t = Math.min(t, Math.max((r.x - from.x) / dx, (r.x + r.w - from.x) / dx));
  if (dy) t = Math.min(t, Math.max((r.y - from.y) / dy, (r.y + r.h - from.y) / dy));
  return { x: from.x + dx * Math.max(0, t), y: from.y + dy * Math.max(0, t) };
}

export function placeLabels(model: Model, symStyle: string, extraObstacles: { x: number; y: number; w: number; h: number }[] = []): PlacedLabel[] {
  // obstacles: every symbol's (inflated) box and every wire segment as a thin rect
  const symRects = new Map<string, LRect>();
  for (const s of model.syms) {
    const d = symDims(s);
    if (!d) continue;
    const b = symBounds(s, d.w, d.h);
    symRects.set(s.id, { x: b.minX - 2, y: b.minY - 2, w: b.maxX - b.minX + 4, h: b.maxY - b.minY + 4 });
  }
  const wireRects: LRect[] = [];
  for (const w of model.wires) {
    for (const seg of segmentsOf(expand(wireAbsPath(model.syms, w, model.wires)))) {
      wireRects.push(seg.h
        ? { x: Math.min(seg.x1, seg.x2) - 1, y: seg.y1 - 3, w: Math.abs(seg.x2 - seg.x1) + 2, h: 6 }
        : { x: seg.x1 - 3, y: Math.min(seg.y1, seg.y2) - 1, w: 6, h: Math.abs(seg.y2 - seg.y1) + 2 });
    }
  }
  const placed: LRect[] = [];
  const out: PlacedLabel[] = [];
  const collides = (r: LRect, ownId: string): boolean =>
    extraObstacles.some((o) => lrOverlap(r, o)) ||
    placed.some((p) => lrOverlap(r, p)) ||
    wireRects.some((wr) => lrOverlap(r, wr)) ||
    [...symRects.entries()].some(([id, o]) => id !== ownId && lrOverlap(r, o));

  /** Try candidate anchor points around `own`; commit the first free spot (or the last, with a leader). */
  const placeAround = (s: Sym, text: string, fs: number, isPort: boolean, pinSide?: number) => {
    const own = symRects.get(s.id)!;
    const lines = wrapLabel(text, fs);
    const w = blockW(lines, fs), h = blockH(lines, fs);
    const cx = own.x + own.w / 2, cy = own.y + own.h / 2;
    // direction order: away from a port's pin first, else above-first (the classic spot)
    const dirs: [number, number][] = [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]];
    if (isPort && pinSide != null) {
      // pin side by rotation: 0 → left, 180 → right, 90 → top, 270 → bottom — label goes opposite
      const away: [number, number] = pinSide === 0 ? [1, 0] : pinSide === 180 ? [-1, 0] : pinSide === 90 ? [0, 1] : [0, -1];
      dirs.sort((a, b) => (b[0] * away[0] + b[1] * away[1]) - (a[0] * away[0] + a[1] * away[1]));
    }
    let last: { x: number; y: number } | null = null;
    for (const dist of [5, 12, 22, 34, 50]) {
      for (const [dx, dy] of dirs) {
        const ax = cx + dx * (own.w / 2 + dist + (dx ? w / 2 : 0));
        const ay = cy + dy * (own.h / 2 + dist + (dy ? h / 2 : 0));
        const r: LRect = { x: ax - w / 2, y: ay - h / 2, w, h };
        last = { x: ax, y: ay };
        if (!collides(r, s.id)) {
          placed.push(r);
          const far = dist >= 22;
          out.push({ sym: s.id, lines, x: ax, y: ay, fontSize: fs, port: isPort, ...(far ? { leader: leaderFor(r, own) } : {}) });
          return;
        }
      }
    }
    // nowhere is free — take the farthest spot anyway, with a leader so it still reads as owned
    if (last) {
      const r: LRect = { x: last.x - w / 2, y: last.y - h / 2, w, h };
      placed.push(r);
      out.push({ sym: s.id, lines, x: last.x, y: last.y, fontSize: fs, port: isPort, leader: leaderFor(r, own) });
    }
  };
  const leaderFor = (label: LRect, own: LRect) => {
    const from = edgeToward(label, { x: own.x + own.w / 2, y: own.y + own.h / 2 });
    const to = edgeToward(own, from);
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  };

  const clampVal = (v?: string) => (v && v.length > 24 ? `${v.slice(0, 23)}…` : v);
  for (const s of model.syms) {
    const d = symDims(s);
    if (!d) continue;
    const isPort = s.type === "port";
    const combined = [s.ref, clampVal(s.value)].filter(Boolean).join(" ");
    if (!combined) continue;
    const own = symRects.get(s.id)!;
    const cx = own.x + own.w / 2, cy = own.y + own.h / 2;

    // 1 · big-bodied parts: label ON the body (both standards) — nothing else lives there.
    // Chips already draw their MPN at body centre, so their ref/value stack sits just above it.
    if (ON_BODY.has(s.type) || s.chip) {
      const fs = 9;
      const lines = wrapLabel(combined, fs, Math.max(40, own.w - 10));
      const y = s.chip?.mpn ? cy - 12 : cy;
      placed.push({ x: cx - blockW(lines, fs) / 2, y: y - blockH(lines, fs) / 2, w: blockW(lines, fs), h: blockH(lines, fs) });
      out.push({ sym: s.id, lines, x: cx, y, fontSize: fs, inside: true });
      continue;
    }

    // 2 · IEC box passives drawn horizontal: the VALUE belongs inside the box; ref beside it
    const rot = normRot(s.rot ?? 0);
    const horizontal = rot === 0 || rot === 180;
    if (symStyle === "iec" && IEC_BOX.has(s.type) && horizontal && s.value && labelW(s.value, 8) <= own.w * 0.55) {
      const fs = 8;
      out.push({ sym: s.id, lines: [s.value], x: cx, y: cy, fontSize: fs, inside: true });
      if (s.ref) placeAround(s, s.ref, 9, false);
      continue;
    }

    // 3 · everything else: collision-avoided ring placement
    placeAround(s, combined, isPort ? 11 : 10, isPort, isPort ? rot : undefined);
  }
  return out;
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
    for (const e of [w.a, w.b]) { const p = endAbs(model.syms, e, model.wires); if (p) note(p.x, p.y); }
    for (const m of w.mid) note(m.x, m.y);
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
