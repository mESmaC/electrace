// Design-rule check for the PCB world. Deterministic geometry, no simulation — the same spirit as
// lint() on the schematic side: given a fully-placed/routed layout (absolute mm coordinates), report
// the rule violations a fabricator or sanity-check would catch. The PCB editor resolves its visual
// state into this input and renders the violations back as on-canvas markers.

export interface DrcPoint { x: number; y: number }

/** A routed trace, as an absolute polyline (endpoints included) on one copper layer. */
export interface DrcTrace { id: string; net: string; layer: string; width: number; path: DrcPoint[] } // layer = copper layer id
/** A pad, absolute centre. Pads live on both layers for our purposes (THT) — treated as any-layer copper. */
export interface DrcPad { key: string; net: string; x: number; y: number; w: number; h: number }
export interface DrcVia { id: string; net: string; x: number; y: number; r: number }
/** A placed component, absolute centre + (unrotated) extent + rotation, for overlap checks. */
export interface DrcComp { ref: string; x: number; y: number; w: number; h: number; rot: number }
/** A still-unrouted ratsnest link (net not yet electrically connected pad→pad). */
export interface DrcUnrouted { net: string; from: DrcPoint; to: DrcPoint }

/** The board outline as a closed polygon (any shape). Copper outside it can't be fabricated; parts past the edge won't fit. */
export interface DrcBoard { outline: DrcPoint[] }

export interface DrcInput {
  traces: DrcTrace[];
  pads: DrcPad[];
  vias: DrcVia[];
  comps: DrcComp[];
  unrouted: DrcUnrouted[];
  clearance: number; // minimum copper-to-copper gap, mm
  board?: DrcBoard;  // optional board outline; enables off-board / past-edge rules
}

export type DrcKind = "unrouted" | "short" | "clearance" | "overlap" | "offboard";
export interface DrcViolation {
  kind: DrcKind;
  severity: "error" | "warn";
  net?: string;
  where: DrcPoint;     // a representative location, for the editor to mark / pan to
  msg: string;
}

// --- geometry helpers ---------------------------------------------------------
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mid = (a: DrcPoint, b: DrcPoint): DrcPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Distance from point p to segment a→b. */
function ptSeg(p: DrcPoint, a: DrcPoint, b: DrcPoint): number {
  const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}
const ccw = (a: DrcPoint, b: DrcPoint, c: DrcPoint) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
function segsCross(a: DrcPoint, b: DrcPoint, c: DrcPoint, d: DrcPoint): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}
/** Minimum distance between segment a→b and segment c→d (0 if they cross). */
function segSeg(a: DrcPoint, b: DrcPoint, c: DrcPoint, d: DrcPoint): number {
  if (segsCross(a, b, c, d)) return 0;
  return Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
}
/** Distance from segment a→b to a circle centre (0 if it enters the disc). */
const segPt = (a: DrcPoint, b: DrcPoint, p: DrcPoint) => ptSeg(p, a, b);

/** Each trace's path as an array of segment pairs. */
function segmentsOf(t: DrcTrace): [DrcPoint, DrcPoint][] {
  const out: [DrcPoint, DrcPoint][] = [];
  for (let i = 1; i < t.path.length; i++) out.push([t.path[i - 1], t.path[i]]);
  return out;
}

/** Ray-cast point-in-polygon test (polygon implicitly closed). */
function inPoly(p: DrcPoint, poly: DrcPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Axis-aligned half-extent of a rotated rectangle (sufficient for an overlap heuristic). */
function aabb(c: DrcComp): { x0: number; y0: number; x1: number; y1: number } {
  const r = (c.rot * Math.PI) / 180, cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  const hw = (c.w * cos + c.h * sin) / 2, hh = (c.w * sin + c.h * cos) / 2;
  return { x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh };
}

/** Run all rules. Pure and order-stable: same input → same violations in the same order. */
export function drcCheck(input: DrcInput): DrcViolation[] {
  const { traces, pads, vias, comps, unrouted, clearance, board } = input;
  const out: DrcViolation[] = [];
  const outline = board && board.outline.length >= 3 ? board.outline : null;
  const outside = (p: DrcPoint) => !inPoly(p, outline!);

  // 1. unrouted nets — every remaining ratsnest link is an error (the net isn't connected)
  for (const u of unrouted)
    out.push({ kind: "unrouted", severity: "error", net: u.net, where: mid(u.from, u.to), msg: `${u.net}: unrouted connection` });

  // 2. shorts — a trace passing through a pad/via of a *different* net
  for (const t of traces) {
    const segs = segmentsOf(t);
    for (const pad of pads) {
      if (pad.net === t.net) continue;
      const reach = Math.max(pad.w, pad.h) / 2 + t.width / 2;
      if (segs.some(([a, b]) => segPt(a, b, pad) < reach))
        out.push({ kind: "short", severity: "error", net: t.net, where: { x: pad.x, y: pad.y }, msg: `${t.net} shorts to ${pad.net} at pad ${pad.key}` });
    }
    for (const v of vias) {
      if (v.net === t.net) continue;
      const reach = v.r + t.width / 2;
      if (segs.some(([a, b]) => segPt(a, b, v) < reach))
        out.push({ kind: "short", severity: "error", net: t.net, where: { x: v.x, y: v.y }, msg: `${t.net} shorts to ${v.net} via` });
    }
  }

  // 3. clearance — two traces on the same layer, different nets, closer than the rule
  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      const t1 = traces[i], t2 = traces[j];
      if (t1.net === t2.net || t1.layer !== t2.layer) continue;
      const need = clearance + t1.width / 2 + t2.width / 2;
      let worst: { d: number; at: DrcPoint } | null = null;
      for (const [a, b] of segmentsOf(t1)) for (const [c, d] of segmentsOf(t2)) {
        const dist = segSeg(a, b, c, d);
        if (dist < need && (!worst || dist < worst.d)) worst = { d: dist, at: mid(a, c) };
      }
      if (worst)
        out.push({ kind: "clearance", severity: "error", net: t1.net, where: worst.at, msg: `${t1.net}/${t2.net} clearance ${worst.d.toFixed(2)}mm < ${clearance}mm` });
    }
  }

  // 4. component overlap — placed footprints whose bounding boxes intersect (warn: maybe intentional)
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      const A = aabb(comps[i]), B = aabb(comps[j]);
      if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1)
        out.push({ kind: "overlap", severity: "warn", where: { x: (comps[i].x + comps[j].x) / 2, y: (comps[i].y + comps[j].y) / 2 }, msg: `${comps[i].ref} overlaps ${comps[j].ref}` });
    }
  }

  // 5. board outline — copper outside the board can't be made; parts past the edge won't fit
  if (outline) {
    for (const pad of pads) if (outside({ x: pad.x, y: pad.y })) out.push({ kind: "offboard", severity: "error", net: pad.net, where: { x: pad.x, y: pad.y }, msg: `pad ${pad.key} is off the board` });
    for (const v of vias) if (outside({ x: v.x, y: v.y })) out.push({ kind: "offboard", severity: "error", net: v.net, where: { x: v.x, y: v.y }, msg: `${v.net} via is off the board` });
    for (const t of traces) for (const p of t.path) if (outside(p)) { out.push({ kind: "offboard", severity: "error", net: t.net, where: p, msg: `${t.net} trace runs off the board` }); break; }
    for (const c of comps) {
      const a = aabb(c), corners = [{ x: a.x0, y: a.y0 }, { x: a.x1, y: a.y0 }, { x: a.x1, y: a.y1 }, { x: a.x0, y: a.y1 }];
      if (corners.some((pt) => outside(pt)))
        out.push({ kind: "offboard", severity: "warn", where: { x: c.x, y: c.y }, msg: `${c.ref} extends past the board edge` });
    }
  }

  return out;
}
