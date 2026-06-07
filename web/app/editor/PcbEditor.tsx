"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { pcbProject, drcCheck, toKicadPcb, type Block, type Design, type PcbProject, type DrcViolation, type DrcTrace, type DrcPad, type DrcVia, type DrcComp, type DrcUnrouted, type KicadComp, type KicadTrace, type KicadVia } from "@electrace/core";
import AssistantBubble from "./AssistantBubble";
import { setContextItem } from "@/lib/assistant";

const TRACE_W = 0.25;
const CLEAR = 0.2;  // mm minimum copper clearance for DRC
const GRIDS = [1, 0.5, 0.25, 0.1, 0]; // mm snap options; 0 = free (no snap, KiCad-style)
const snap = (n: number, g: number) => (g ? Math.round(n / g) * g : Math.round(n * 1e4) / 1e4);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const AUTO_SP = 16;

type Pos = { x: number; y: number };
type Place = { x: number; y: number; rot: number };
type Trace = { id: string; net: string; layer: string; width: number; a: string; b: string; points: Pos[] };
type Via = { id: string; net: string; x: number; y: number };
type Board = Pos[];  // edge-cut polygon (any shape); implicitly closed
type Snap = { places: Record<string, Place>; traces: Trace[]; vias: Via[]; board: Board | null };
const BMARGIN = 3;  // mm default board margin around parts
const WIDTHS = [0.2, 0.25, 0.4, 0.6];
const bbox = (poly: Pos[]) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of poly) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); } return { x: a, y: b, w: c - a, h: d - b }; };

const rotate = (p: Pos, deg: number): Pos => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};
/** Constrain a segment from→to to the nearest 0 / 45 / 90° direction (octolinear routing). */
const octo = (from: Pos, to: Pos): Pos => {
  let dx = to.x - from.x, dy = to.y - from.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax > ay * 2) dy = 0;
  else if (ay > ax * 2) dx = 0;
  else { const m = Math.min(ax, ay); dx = Math.sign(dx) * m; dy = Math.sign(dy) * m; }
  return { x: from.x + dx, y: from.y + dy };
};
/** Distance from point p to segment a→b (for picking the nearest board edge). */
const ptSeg = (p: Pos, a: Pos, b: Pos): number => {
  const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
  const t = l2 ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
};
/** SVG path for a polyline with true circular-arc fillets of radius `r` at each corner. Corners that
 *  turn less than `minTurn`° stay sharp; the tangent cutback is capped at half of each adjacent
 *  segment (reducing the effective radius rather than overshooting). */
function roundedPath(pts: Pos[], r: number, minTurn: number): string {
  if (pts.length < 2) return "";
  const straight = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  if (pts.length === 2 || r <= 0) return straight;
  const out = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const d1x = p0.x - p1.x, d1y = p0.y - p1.y, d2x = p2.x - p1.x, d2y = p2.y - p1.y;
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6 || l2 < 1e-6) { out.push(`L ${p1.x} ${p1.y}`); continue; }
    const u1x = d1x / l1, u1y = d1y / l1, u2x = d2x / l2, u2y = d2y / l2;
    const alpha = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y))); // interior angle (rad)
    if (180 - (alpha * 180) / Math.PI < minTurn || alpha < 1e-3) { out.push(`L ${p1.x} ${p1.y}`); continue; }
    const half = Math.tan(alpha / 2);
    const t = Math.min(r / half, l1 / 2, l2 / 2), reff = t * half; // cap cutback → shrink radius if needed
    const sweep = -(u1x * u2y - u1y * u2x) > 0 ? 1 : 0; // turn handedness (SVG y-down)
    out.push(`L ${p1.x + u1x * t} ${p1.y + u1y * t}`, `A ${reff} ${reff} 0 0 ${sweep} ${p1.x + u2x * t} ${p1.y + u2y * t}`);
  }
  const last = pts[pts.length - 1];
  return out.join(" ") + ` L ${last.x} ${last.y}`;
}
const autoPlace = (i: number, total: number): Place => {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  return { x: (i % cols) * AUTO_SP, y: Math.floor(i / cols) * AUTO_SP, rot: 0 };
};
// KiCad-flavoured palette: dark board, copper layers, gold pads, yellow edge cuts.
// Copper stackup — front red, back blue, inner layers distinct. Extend this list for more layers;
// ids are the KiCad copper-layer names so they export directly.
const COPPER: { id: string; label: string; color: string }[] = [
  { id: "F.Cu", label: "F.Cu", color: "#c83434" },
  { id: "In1.Cu", label: "In1.Cu", color: "#d98b3c" },
  { id: "In2.Cu", label: "In2.Cu", color: "#9b7fe0" },
  { id: "B.Cu", label: "B.Cu", color: "#4d8fcf" },
];
const layerColor = (id: string) => COPPER.find((l) => l.id === id)?.color ?? "#8895aa";
const COL = {
  bg: "#0a0f1a", gridDot: "#1c2740", grid10: "#2a3850",
  board: "#c9b458", boardFill: "#0d1521", pad: "#c9a23a", padHole: "#0a0f1a", padText: "#1a1205",
  silk: "#c9d2dd", rats: "#8b97aa", sel: "#f3f6fa", via: "#c9a23a",
};
const LAYER_ROWS: { id: string; label: string; color: string; copper?: boolean }[] = [
  ...COPPER.map((l) => ({ id: l.id, label: l.label, color: l.color, copper: true })),
  { id: "Edge.Cuts", label: "Edge.Cuts", color: COL.board },
  { id: "silk", label: "Silkscreen", color: COL.silk },
  { id: "netnames", label: "Net names", color: "#6fd6c0" },
  { id: "ratsnest", label: "Ratsnest", color: COL.rats },
];
const NETCOL = "#6fd6c0"; // net-name label colour

/** Load (and migrate) a saved PCB layout synchronously, so the first render already has the real
 *  positions — which lets the initial fit-to-view actually centre the board. */
function loadPcb(LS: string): Snap {
  const empty: Snap = { places: {}, traces: [], vias: [], board: null };
  if (typeof window === "undefined") return empty;
  try {
    const d = JSON.parse(localStorage.getItem(LS) ?? "{}");
    const places = d.places ?? (d.positions ? Object.fromEntries(Object.entries(d.positions).map(([k, v]) => [k, { ...(v as Pos), rot: 0 }])) : {});
    let board: Board | null = null;
    if (Array.isArray(d.board)) board = d.board;
    else if (Array.isArray(d.board?.outline)) board = d.board.outline;
    else if (d.board && typeof d.board.w === "number") { const r = d.board; board = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]; }
    const traces: Trace[] = (Array.isArray(d.traces) ? d.traces : []).map((t: Trace) => ({ ...t, layer: t.layer === "top" ? "F.Cu" : t.layer === "bottom" ? "B.Cu" : t.layer }));
    return { places, traces, vias: Array.isArray(d.vias) ? d.vias : [], board };
  } catch { return empty; }
}

/** Minimum-spanning-tree edges (as index pairs) over a net's pad points. */
function mst(pts: Pos[]): [number, number][] {
  if (pts.length < 2) return [];
  const inT = [0], rem = new Set(pts.map((_, i) => i).filter((i) => i > 0)), edges: [number, number][] = [];
  const d2 = (a: Pos, b: Pos) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  while (rem.size) {
    let best: { i: number; j: number; d: number } | null = null;
    for (const i of inT) for (const j of rem) { const d = d2(pts[i], pts[j]); if (!best || d < best.d) best = { i, j, d }; }
    edges.push([best!.i, best!.j]); inT.push(best!.j); rem.delete(best!.j);
  }
  return edges;
}

export default function PcbEditor({ design, blocks, onClose }: { design: Design; blocks: Map<string, Block>; onClose: () => void }) {
  const project: PcbProject = useMemo(() => pcbProject(design, blocks), [design, blocks]);
  const LS = `electrace:pcb:${design.id}`;

  const [boot] = useState<Snap>(() => loadPcb(LS));
  const [places, setPlaces] = useState<Record<string, Place>>(boot.places);
  const [traces, setTraces] = useState<Trace[]>(boot.traces);
  const [vias, setVias] = useState<Via[]>(boot.vias);
  const [board, setBoard] = useState<Board | null>(boot.board);
  const [sel, setSel] = useState<{ kind: "comp" | "trace" | "boardv" | "pad"; id: string } | null>(null);
  const [tool, setTool] = useState<"select" | "route" | "measure">("select");
  const [measure, setMeasure] = useState<{ a: Pos; b: Pos | null } | null>(null);
  const [layer, setLayer] = useState<string>("F.Cu");
  const [width, setWidth] = useState(TRACE_W);
  const [grid, setGrid] = useState(0.5);
  const [ortho, setOrtho] = useState(true);
  const [rounded, setRounded] = useState(true);
  const [fillet, setFillet] = useState(0.6); // mm corner radius
  const [vis, setVis] = useState<Record<string, boolean>>({ "F.Cu": true, "In1.Cu": true, "In2.Cu": true, "B.Cu": true, "Edge.Cuts": true, silk: true, netnames: true, ratsnest: true });
  const [hoverNet, setHoverNet] = useState<string | null>(null);
  const [, setHistTick] = useState(0);
  const [drc, setDrc] = useState<DrcViolation[] | null>(null);
  const [drawing, setDrawing] = useState<{ a: string; net: string; points: Pos[] } | null>(null);
  const [cursor, setCursor] = useState<Pos>({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 900, h: 640 });
  const [pan, setPan] = useState<Pos>({ x: -10, y: -10 });
  const [zoom, setZoom] = useState(6);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef(pan); panRef.current = pan;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const cursorRef = useRef(cursor); // updated imperatively in onMove (not from render) so it stays live without re-rendering
  const xReadout = useRef<HTMLSpanElement>(null), yReadout = useRef<HTMLSpanElement>(null);
  const selRef = useRef(sel); selRef.current = sel;
  const toolRef = useRef(tool); toolRef.current = tool;
  const fitted = useRef(false);

  const placeOf = (ref: string, i: number): Place => places[ref] ?? autoPlace(i, project.components.length);
  const writeLS = (s: Snap) => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ } };
  // every committing mutation flows through persist(): it snapshots the new state, records the
  // previous one on the undo stack, clears the redo stack, and writes through to localStorage.
  const persist = (pl: Record<string, Place>, tr: Trace[], vs: Via[] = viasRef.current, bd: Board | null = boardRef.current) => {
    const s: Snap = { places: pl, traces: tr, vias: vs, board: bd };
    const h = histRef.current;
    h.past.push(presentRef.current); if (h.past.length > 100) h.past.shift();
    h.future = []; presentRef.current = s;
    setHistTick((t) => t + 1); setDrc(null); writeLS(s);
  };
  // apply a snapshot to the live state without touching history (used by undo/redo)
  const applySnap = (s: Snap) => {
    setPlaces(s.places); placesRef.current = s.places;
    setTraces(s.traces); tracesRef.current = s.traces;
    setVias(s.vias); viasRef.current = s.vias;
    setBoard(s.board); boardRef.current = s.board;
    setDrawing(null); setSel(null); setDrc(null); writeLS(s);
  };
  const undo = () => { const h = histRef.current; if (!h.past.length) return; h.future.push(presentRef.current); const s = h.past.pop()!; presentRef.current = s; applySnap(s); setHistTick((t) => t + 1); };
  const redo = () => { const h = histRef.current; if (!h.future.length) return; h.past.push(presentRef.current); const s = h.future.pop()!; presentRef.current = s; applySnap(s); setHistTick((t) => t + 1); };

  // pad absolute positions (placement + rotation) and pad→net
  const padPos = useMemo(() => {
    const m = new Map<string, Pos>();
    project.components.forEach((c, i) => {
      const pl = placeOf(c.ref, i);
      for (const pad of c.pads) { const o = rotate({ x: pad.x, y: pad.y }, pl.rot); m.set(`${c.ref}.${pad.id}`, { x: pl.x + o.x, y: pl.y + o.y }); }
    });
    return m;
  }, [project, places]); // eslint-disable-line react-hooks/exhaustive-deps
  const padNet = useMemo(() => { const m = new Map<string, string>(); for (const r of project.ratsnest) for (const k of r.pads) m.set(k, r.net); return m; }, [project]);

  // routing nodes = pads + vias; a via key is `via:<id>`
  const nodePos = useMemo(() => { const m = new Map(padPos); for (const v of vias) m.set(`via:${v.id}`, { x: v.x, y: v.y }); return m; }, [padPos, vias]);
  const nodeNet = (key: string) => (key.startsWith("via:") ? vias.find((v) => `via:${v.id}` === key)?.net ?? "" : padNet.get(key) ?? "");

  // board outline: use the saved polygon, else a default rectangle around the parts + margin
  const autoBoard = useMemo<Board>(() => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of padPos.values()) { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); }
    if (a === Infinity) { a = 0; b = 0; c = 20; d = 20; }
    const g = grid || 0.5, x0 = snap(a - BMARGIN, g), y0 = snap(b - BMARGIN, g), x1 = snap(c + BMARGIN, g), y1 = snap(d + BMARGIN, g);
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  }, [padPos, grid]);
  const bd = board ?? autoBoard;

  // union-find of pads joined by traces → a ratsnest edge is "routed" when both ends are connected
  const routed = useMemo(() => {
    const parent = new Map<string, string>();
    const find = (x: string): string => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
    for (const t of traces) parent.set(find(t.a), find(t.b));
    return (a: string, b: string) => parent.has(a) && parent.has(b) && find(a) === find(b);
  }, [traces]);

  // precompute ratsnest geometry (the per-net MST is O(n²) — keep it out of the cursor-move hot path)
  const ratsGeom = useMemo(() => project.ratsnest.map((r) => {
    const keyed = r.pads.map((k) => ({ k, p: padPos.get(k) })).filter((x) => x.p) as { k: string; p: Pos }[];
    return { net: r.net, edges: mst(keyed.map((x) => x.p)).map(([i, j]) => ({ ak: keyed[i].k, a: keyed[i].p, bk: keyed[j].k, b: keyed[j].p })) };
  }), [project, padPos]);
  // pads that carry a net, for the upright net-name labels
  const padLabels = useMemo(() => { const out: { key: string; p: Pos; net: string }[] = []; for (const [key, p] of padPos) { const net = padNet.get(key); if (net) out.push({ key, p, net }); } return out; }, [padPos, padNet]);
  // precompute each trace's SVG path (fillet arcs do trig per corner — don't redo it on every render)
  const tracePaths = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of traces) { const a = nodePos.get(t.a), b = nodePos.get(t.b); if (!a || !b) continue; const pts = [a, ...t.points, b]; m.set(t.id, rounded ? roundedPath(pts, fillet, 8) : `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")); }
    return m;
  }, [traces, nodePos, rounded, fillet]);

  // container size + fit
  useEffect(() => { const el = wrapRef.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  const fitView = () => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    const acc = (x: number, y: number) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
    for (const v of padPos.values()) acc(v.x, v.y);
    for (const p of bd) acc(p.x, p.y); // frame the whole board, not just the parts
    if (a === Infinity || !size.w) return;
    const pad = 6, w = c - a, h = d - b, z = clamp(Math.min(size.w / (w + pad * 2), size.h / (h + pad * 2)), 0.5, 40);
    setZoom(z); setPan({ x: a - (size.w / z - w) / 2, y: b - (size.h / z - h) / 2 });
  };
  useEffect(() => { if (!fitted.current && size.w && project.components.length) { fitView(); fitted.current = true; } }, [size, project]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); const r = el.getBoundingClientRect(), z = zoomRef.current;
      const mouseWheel = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 100 && Number.isInteger(e.deltaY));
      if (e.ctrlKey || mouseWheel) {
        const pinch = e.ctrlKey && Math.abs(e.deltaY) < 50;
        const nz = clamp(z * Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * (pinch ? 0.01 : 0.0035)), 0.5, 40);
        const ox = e.clientX - r.left, oy = e.clientY - r.top, cx = panRef.current.x + ox / z, cy = panRef.current.y + oy / z;
        setZoom(nz); setPan({ x: cx - ox / nz, y: cy - oy / nz });
      } else setPan((p) => ({ x: p.x + e.deltaX / z, y: p.y + e.deltaY / z }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // keyboard: R rotate, Esc cancel/deselect, Delete remove trace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); if (e.shiftKey) redoRef.current(); else undoRef.current(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "y") { e.preventDefault(); redoRef.current(); return; }
      if (k === "r") { const s = selRef.current; if (s?.kind === "comp") { e.preventDefault(); setPlaces((pl) => { const cur = pl[s.id] ?? { x: 0, y: 0, rot: 0 }; const next = { ...pl, [s.id]: { ...cur, rot: ((cur.rot + (e.shiftKey ? -90 : 90)) % 360 + 360) % 360 } }; persistRef.current(next, tracesRef.current, viasRef.current); return next; }); } }
      else if (k === "v") {
        // drop a via at the routing tip and switch copper layer, so the trace can change sides
        const dr = drawingRef.current; if (!dr) return; e.preventDefault();
        const from = dr.points.length ? dr.points[dr.points.length - 1] : nodePosRef.current.get(dr.a);
        if (!from) return;
        const g = gridRef.current, want = { x: snap(cursorRef.current.x, g), y: snap(cursorRef.current.y, g) };
        const tip = orthoRef.current ? octo(from, want) : want;
        const id = `v-${(tip.x * 1000 | 0)}-${(tip.y * 1000 | 0)}-${tracesRef.current.length}`;
        const seg: Trace = { id: `t-${id}`, net: dr.net, layer: layerRef.current, width: widthRef.current, a: dr.a, b: `via:${id}`, points: dr.points };
        const nv = [...viasRef.current, { id, net: dr.net, x: tip.x, y: tip.y }];
        const nt = [...tracesRef.current, seg];
        viasRef.current = nv; tracesRef.current = nt;
        setVias(nv); setTraces(nt);
        setLayer((l) => COPPER[(COPPER.findIndex((c) => c.id === l) + 1) % COPPER.length].id);
        setDrawing({ a: `via:${id}`, net: dr.net, points: [] });
        persistRef.current(placesRef.current, nt, nv);
      }
      else if (k === "escape") { setDrawing(null); setSel(null); setMeasure(null); }
      else if (k === "delete" || k === "backspace") {
        const s = selRef.current;
        if (s?.kind === "trace") { e.preventDefault(); setTraces((ts) => { const next = ts.filter((x) => x.id !== s.id); persistRef.current(placesRef.current, next, viasRef.current); return next; }); setSel(null); }
        else if (s?.kind === "boardv") { e.preventDefault(); const cur = boardRef.current; const idx = Number(s.id); if (cur && cur.length > 3) { const next = cur.filter((_, i) => i !== idx); setBoard(next); persistRef.current(placesRef.current, tracesRef.current, viasRef.current, next); } setSel(null); }
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const placesRef = useRef(places); placesRef.current = places;
  const tracesRef = useRef(traces); tracesRef.current = traces;
  const viasRef = useRef(vias); viasRef.current = vias;
  const boardRef = useRef(board); boardRef.current = board;
  const drawingRef = useRef(drawing); drawingRef.current = drawing;
  const layerRef = useRef(layer); layerRef.current = layer;
  const widthRef = useRef(width); widthRef.current = width;
  const nodePosRef = useRef(nodePos); nodePosRef.current = nodePos;
  const gridRef = useRef(grid); gridRef.current = grid;
  const orthoRef = useRef(ortho); orthoRef.current = ortho;
  const histRef = useRef<{ past: Snap[]; future: Snap[] }>({ past: [], future: [] });
  const presentRef = useRef<Snap>(boot);
  const persistRef = useRef(persist); persistRef.current = persist;
  const undoRef = useRef(undo); undoRef.current = undo;
  const redoRef = useRef(redo); redoRef.current = redo;

  const localPt = (e: { clientX: number; clientY: number }): Pos => { const r = svgRef.current!.getBoundingClientRect(), z = zoomRef.current; return { x: panRef.current.x + (e.clientX - r.left) / z, y: panRef.current.y + (e.clientY - r.top) / z }; };

  const drag = useRef<{ ref: string; dx: number; dy: number; moved: boolean } | null>(null);
  const panDrag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const vdrag = useRef<{ id: string; idx: number } | null>(null); // dragging a trace vertex
  const sdrag = useRef<{ id: string; base: Pos[]; moving: Set<number>; start: Pos; moved: boolean; perp: Pos | null } | null>(null); // sliding a whole segment (perp ≠ null → constrain to a sideways push)
  const bdrag = useRef<{ start: Pos; base: Board } | null>(null);   // moving the whole board
  const bvdrag = useRef<{ idx: number } | null>(null);             // dragging one outline vertex

  const onBoardMoveDown = (e: React.PointerEvent) => {
    e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId);
    if (!board) setBoard(bd); // commit the auto board so edits stick
    bdrag.current = { start: localPt(e), base: board ?? bd };
  };
  const onBoardVertexDown = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId);
    if (!board) setBoard(bd);
    setSel({ kind: "boardv", id: String(idx) }); bvdrag.current = { idx };
  };
  // double-click an edge to insert a vertex there (KiCad-style outline shaping)
  const onBoardDblClick = (e: React.MouseEvent) => {
    e.stopPropagation(); const p = localPt(e); const cur = board ?? bd;
    let bi = 0, best = Infinity;
    for (let i = 0; i < cur.length; i++) { const d = ptSeg(p, cur[i], cur[(i + 1) % cur.length]); if (d < best) { best = d; bi = i; } }
    const next = [...cur.slice(0, bi + 1), { x: snap(p.x, grid), y: snap(p.y, grid) }, ...cur.slice(bi + 1)];
    setBoard(next); persist(placesRef.current, tracesRef.current, viasRef.current, next);
  };

  const onVertexDown = (e: React.PointerEvent, id: string, idx: number) => {
    e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId);
    setSel({ kind: "trace", id }); vdrag.current = { id, idx };
  };
  // double-click a corner handle to remove that bend
  const onVertexRemove = (e: React.MouseEvent, id: string, idx: number) => {
    e.stopPropagation();
    setTraces((ts) => { const next = ts.map((x) => (x.id === id ? { ...x, points: x.points.filter((_, i) => i !== idx) } : x)); persist(placesRef.current, next); return next; });
  };
  // grab segment k and slide it; interior corners move, a pad/via end stays put by spawning a new corner
  const onSegDown = (e: React.PointerEvent, t: Trace, k: number) => {
    if (e.button !== 0) return;
    e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId);
    const A = nodePos.get(t.a), B = nodePos.get(t.b); if (!A || !B) return;
    const path = [A, ...t.points, B], n = t.points.length, leftAnchor = k === 0, rightAnchor = k === n;
    const base = [...t.points]; const moving = new Set<number>();
    if (leftAnchor) base.unshift({ ...A });
    const shift = leftAnchor ? 1 : 0;
    moving.add(leftAnchor ? 0 : k - 1);
    if (rightAnchor) { base.push({ ...B }); moving.add(base.length - 1); } else moving.add(k + shift);
    // in 45° mode, constrain the drag to a sideways push (keep the segment's angle)
    let perp: Pos | null = null;
    if (ortho) { const dx = path[k + 1].x - path[k].x, dy = path[k + 1].y - path[k].y, len = Math.hypot(dx, dy); if (len > 1e-6) perp = { x: -dy / len, y: dx / len }; }
    sdrag.current = { id: t.id, base, moving, start: localPt(e), moved: false, perp };
    setSel({ kind: "trace", id: t.id });
  };
  // double-click a trace to insert a bend at the clicked point (on the nearest segment)
  const onTraceInsert = (e: React.MouseEvent, t: Trace) => {
    e.stopPropagation();
    const a = nodePos.get(t.a), b = nodePos.get(t.b); if (!a || !b) return;
    const p = localPt(e), path = [a, ...t.points, b];
    let k = 0, best = Infinity;
    for (let i = 0; i < path.length - 1; i++) { const d = ptSeg(p, path[i], path[i + 1]); if (d < best) { best = d; k = i; } }
    const g = { x: snap(p.x, grid), y: snap(p.y, grid) }, pts = [...t.points.slice(0, k), g, ...t.points.slice(k)];
    setTraces((ts) => { const next = ts.map((x) => (x.id === t.id ? { ...x, points: pts } : x)); persist(placesRef.current, next); return next; });
    setSel({ kind: "trace", id: t.id });
  };

  const onCompDown = (e: React.PointerEvent, ref: string, pl: Place) => {
    if (e.button !== 0 || tool !== "select") { if (tool === "route") setSel({ kind: "comp", id: ref }); return; }
    e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setSel({ kind: "comp", id: ref });
    const m = localPt(e); drag.current = { ref, dx: m.x - pl.x, dy: m.y - pl.y, moved: false };
  };
  const onSvgDown = (e: React.PointerEvent) => { if (e.button !== 1) return; e.preventDefault(); svgRef.current?.setPointerCapture?.(e.pointerId); panDrag.current = { sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y }; };
  const onMove = (e: React.PointerEvent) => {
    const p = localPt(e); cursorRef.current = p;
    // live X/Y readout via DOM — avoids a React re-render of the whole canvas on every hover move
    if (xReadout.current) xReadout.current.textContent = p.x.toFixed(2);
    if (yReadout.current) yReadout.current.textContent = p.y.toFixed(2);
    // only the routing crosshair / measure ruler / trace preview need cursor in the render tree
    if (tool === "route" || tool === "measure") setCursor(p);
    if (panDrag.current) { const d = panDrag.current, z = zoomRef.current; setPan({ x: d.px - (e.clientX - d.sx) / z, y: d.py - (e.clientY - d.sy) / z }); return; }
    if (bdrag.current) { const m = bdrag.current, dx = p.x - m.start.x, dy = p.y - m.start.y; setBoard(m.base.map((pt) => ({ x: snap(pt.x + dx, grid), y: snap(pt.y + dy, grid) }))); return; }
    if (bvdrag.current) { const idx = bvdrag.current.idx, cur = boardRef.current ?? bd, g = { x: snap(p.x, grid), y: snap(p.y, grid) }; setBoard(cur.map((pt, i) => (i === idx ? g : pt))); return; }
    if (sdrag.current) {
      const s = sdrag.current; let dx = p.x - s.start.x, dy = p.y - s.start.y;
      if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) s.moved = true;
      if (s.perp) { const d = dx * s.perp.x + dy * s.perp.y; dx = d * s.perp.x; dy = d * s.perp.y; } // sideways push only
      const pts = s.base.map((pt, i) => (s.moving.has(i) ? { x: snap(pt.x + dx, grid), y: snap(pt.y + dy, grid) } : pt));
      setTraces((ts) => ts.map((t) => (t.id === s.id ? { ...t, points: pts } : t))); return;
    }
    if (vdrag.current) { const { id, idx } = vdrag.current, g = { x: snap(p.x, grid), y: snap(p.y, grid) }; setTraces((ts) => ts.map((t) => (t.id === id ? { ...t, points: t.points.map((pt, k) => (k === idx ? g : pt)) } : t))); return; }
    const d = drag.current; if (!d) return;
    d.moved = true;
    setPlaces((prev) => ({ ...prev, [d.ref]: { ...(prev[d.ref] ?? { rot: 0 }), x: snap(p.x - d.dx, grid), y: snap(p.y - d.dy, grid), rot: prev[d.ref]?.rot ?? 0 } }));
  };
  const onUp = () => {
    if (bdrag.current || bvdrag.current) { bdrag.current = null; bvdrag.current = null; persist(placesRef.current, tracesRef.current, viasRef.current, boardRef.current); return; }
    if (sdrag.current) { const moved = sdrag.current.moved, id = sdrag.current.id; sdrag.current = null; if (moved) persist(placesRef.current, tracesRef.current); else setSel({ kind: "trace", id }); return; }
    if (vdrag.current) { vdrag.current = null; persist(placesRef.current, tracesRef.current); return; }
    panDrag.current = null;
    if (drag.current) { const moved = drag.current.moved; drag.current = null; if (moved) setPlaces((p) => { persist(p, tracesRef.current); return p; }); }
  };

  // snap a point to the nearest pad/via centre (within a zoom-aware radius), else to the grid
  const snapPoint = (p: Pos): Pos => {
    let best: Pos | null = null, bd2 = (8 / zoom) ** 2;
    for (const v of nodePos.values()) { const d2 = (v.x - p.x) ** 2 + (v.y - p.y) ** 2; if (d2 < bd2) { bd2 = d2; best = v; } }
    return best ?? { x: snap(p.x, grid), y: snap(p.y, grid) };
  };
  const measureClick = (pt: Pos) => setMeasure((m) => (!m || m.b !== null ? { a: pt, b: null } : { a: m.a, b: pt }));

  const onNodeClick = (e: React.MouseEvent, key: string) => {
    if (tool === "measure") { e.stopPropagation(); const p = nodePos.get(key); if (p) measureClick(p); return; }
    if (tool === "select") { if (key.startsWith("via:")) return; e.stopPropagation(); setSel({ kind: "pad", id: key }); return; }
    if (tool !== "route") return;
    e.stopPropagation();
    const net = nodeNet(key);
    if (!drawing) { if (!net) return; setDrawing({ a: key, net, points: [] }); return; } // must start on a pad that's on a net
    if (key === drawing.a || net !== drawing.net) return; // can only finish on a node of the SAME net (no cross-net shorts)
    setTraces((ts) => { const next = [...ts, { id: `t-${tracesRef.current.length}-${key}`, net: drawing.net, layer, width, a: drawing.a, b: key, points: drawing.points }]; persist(places, next); return next; });
    setDrawing(null);
  };
  const onBgClick = () => {
    if (tool === "measure") { measureClick(snapPoint(cursorRef.current)); return; }
    if (tool === "route" && drawing) {
      setDrawing((d) => {
        if (!d) return d;
        const from = d.points.length ? d.points[d.points.length - 1] : nodePos.get(d.a)!;
        const want = { x: snap(cursorRef.current.x, grid), y: snap(cursorRef.current.y, grid) };
        return { ...d, points: [...d.points, ortho ? octo(from, want) : want] };
      });
    } else setSel(null);
  };

  const autoArrange = () => { const next: Record<string, Place> = {}; project.components.forEach((c, i) => { next[c.ref] = autoPlace(i, project.components.length); }); setPlaces(next); persist(next, traces, vias); fitted.current = false; setTimeout(fitView, 0); };

  // resolve the visual layout into absolute geometry and run the deterministic design-rule check
  const runDrc = () => {
    const tr: DrcTrace[] = [];
    for (const t of traces) { const a = nodePos.get(t.a), b = nodePos.get(t.b); if (a && b) tr.push({ id: t.id, net: t.net, layer: t.layer, width: t.width, path: [a, ...t.points, b] }); }
    const padsG: DrcPad[] = [];
    project.components.forEach((c, i) => { placeOf(c.ref, i); for (const pad of c.pads) { const key = `${c.ref}.${pad.id}`, p = padPos.get(key); if (p) padsG.push({ key, net: padNet.get(key) ?? "", x: p.x, y: p.y, w: pad.w, h: pad.h }); } });
    const viasG: DrcVia[] = vias.map((v) => ({ id: v.id, net: v.net, x: v.x, y: v.y, r: 0.5 }));
    const comps: DrcComp[] = project.components.map((c, i) => { const pl = placeOf(c.ref, i); return { ref: c.ref, x: pl.x, y: pl.y, w: c.w, h: c.h, rot: pl.rot }; });
    const unrouted: DrcUnrouted[] = [];
    for (const r of project.ratsnest) {
      const keyed = r.pads.map((k) => ({ k, p: padPos.get(k) })).filter((x) => x.p) as { k: string; p: Pos }[];
      for (const [i, j] of mst(keyed.map((x) => x.p))) if (!routed(keyed[i].k, keyed[j].k)) unrouted.push({ net: r.net, from: keyed[i].p, to: keyed[j].p });
    }
    setDrc(drcCheck({ traces: tr, pads: padsG, vias: viasG, comps, unrouted, clearance: CLEAR, board: { outline: bd } }));
  };
  const fitBoard = () => { setBoard(autoBoard); persist(placesRef.current, tracesRef.current, viasRef.current, autoBoard); };

  const exportKicad = () => {
    const comps: KicadComp[] = project.components.map((c, i) => {
      const pl = placeOf(c.ref, i);
      return {
        ref: c.ref.split("/").pop() ?? c.ref, value: c.value, footprint: c.footprint, x: pl.x, y: pl.y, rot: pl.rot,
        pads: c.pads.map((pad) => ({ num: pad.id, net: padNet.get(`${c.ref}.${pad.id}`) ?? "", x: pad.x, y: pad.y, w: pad.w, h: pad.h, drill: pad.drill, round: pad.round })),
      };
    });
    const tr: KicadTrace[] = [];
    for (const t of traces) { const a = nodePos.get(t.a), b = nodePos.get(t.b); if (a && b) tr.push({ net: t.net, layer: t.layer, width: t.width, path: [a, ...t.points, b] }); }
    const vs: KicadVia[] = vias.map((v) => ({ net: v.net, x: v.x, y: v.y, r: 0.5, drill: 0.4 }));
    const text = toKicadPcb({ comps, traces: tr, vias: vs, board: { outline: bd }, fillet: rounded ? fillet : 0 });
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${(design.name || design.id).replace(/[^\w.-]+/g, "_")}.kicad_pcb`;
    a.click(); URL.revokeObjectURL(url);
  };
  const panTo = (p: Pos) => { const z = zoomRef.current; setPan({ x: p.x - size.w / z / 2, y: p.y - size.h / z / 2 }); };

  const vw = size.w / zoom, vh = size.h / zoom;
  const SEV = { error: "#e2554e", warn: "#e0b341" } as const;
  const selNets = useMemo(() => sel?.kind === "comp" ? new Set(project.ratsnest.filter((r) => r.pads.some((k) => k.startsWith(`${sel.id}.`))).map((r) => r.net)) : new Set<string>(), [sel, project]);
  const hotNet = (net: string | undefined) => !!net && (net === hoverNet || net === drawing?.net || selNets.has(net));
  const pathD = (pts: Pos[]) => (rounded ? roundedPath(pts, fillet, 8) : (pts.length ? `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ") : ""));

  // Handler-free visual layers — memoized so they bail out of reconciliation on pan/zoom and unrelated
  // re-renders (they only depend on the geometry + highlight state, never the cursor).
  const drawNet = drawing?.net ?? null;
  const ratsEl = useMemo(() => vis.ratsnest === false ? null : ratsGeom.map((r) => {
    const hot = !!r.net && (r.net === hoverNet || r.net === drawNet || selNets.has(r.net));
    return r.edges.map((e, idx) => {
      if (routed(e.ak, e.bk)) return null;
      const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
      return (
        <g key={`${r.net}-${idx}`} pointerEvents="none">
          <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={hot ? COL.sel : COL.rats} strokeWidth={hot ? 0.12 : 0.06} opacity={hot ? 0.9 : 0.4} />
          {hot && vis.netnames !== false && r.net && <text x={mx} y={my - 0.2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={0.6} fill={COL.sel} stroke={COL.bg} strokeWidth={0.12} paintOrder="stroke" style={{ paintOrder: "stroke" }}>{r.net}</text>}
        </g>
      );
    });
  }), [ratsGeom, routed, hoverNet, drawNet, selNets, vis]);
  const netLabelsEl = useMemo(() => (vis.netnames === false || zoom <= 4) ? null : padLabels.map(({ key, p, net }) => (
    <text key={key} x={p.x} y={p.y - 0.78} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={0.62} fill={NETCOL} stroke={COL.bg} strokeWidth={0.13} paintOrder="stroke" style={{ paintOrder: "stroke" }} pointerEvents="none">{net}</text>
  )), [padLabels, vis, zoom]);
  const drcEl = useMemo(() => drc?.map((v, i) => (
    <g key={i} pointerEvents="none">
      <circle cx={v.where.x} cy={v.where.y} r={1.4} fill="none" stroke={SEV[v.severity]} strokeWidth={0.18} opacity={0.9} />
      <circle cx={v.where.x} cy={v.where.y} r={0.3} fill={SEV[v.severity]} />
    </g>
  )), [drc]); // eslint-disable-line react-hooks/exhaustive-deps
  const btn = (active: boolean) => `h-7 inline-flex items-center justify-center rounded-md px-2.5 text-[11.5px] font-medium transition-colors ${active ? "bg-[#1b3a66] text-[#9ec5ff] ring-1 ring-inset ring-[#356bb0]" : "bg-[#161f30] text-[#aeb8c8] hover:bg-[#1d2840] hover:text-white"}`;
  const seg = (active: boolean) => `h-6 inline-flex items-center justify-center rounded px-2 text-[11px] font-medium transition-colors ${active ? "bg-[#1b3a66] text-[#9ec5ff]" : "text-[#9aa6bb] hover:bg-[#1d2840] hover:text-white"}`;
  const SEGBOX = "flex items-center gap-0.5 rounded-md bg-[#11192699] p-0.5 ring-1 ring-inset ring-[#212c42]";
  const DD = "h-7 rounded-md bg-[#161f30] pl-2 pr-1 text-[11.5px] text-[#cdd6e0] ring-1 ring-inset ring-[#27324a] outline-none hover:bg-[#1d2840] focus:ring-[#356bb0] cursor-pointer";
  const SEP = <div className="mx-0.5 h-5 w-px bg-[#212c42]" />;
  const lbl = "text-[10px] uppercase tracking-wide text-[#5b6a85]";
  const hint = tool === "route" ? "click a pad → another · empty to bend · V = via+flip · Esc cancels"
    : tool === "measure" ? "click two points to measure — snaps to pads · Esc clears"
    : "drag to place · R rotates · dbl-click a trace to add a bend, a handle to remove";

  // --- inspector edits (all routed through persist → undoable) ---
  const curPlace = (ref: string) => placeOf(ref, project.components.findIndex((c) => c.ref === ref));
  const setComp = (ref: string, patch: Partial<Place>) => setPlaces((pl) => { const np = { ...pl, [ref]: { ...curPlace(ref), ...patch } }; persist(np, tracesRef.current); return np; });
  const rotateComp = (ref: string, d: number) => setComp(ref, { rot: ((curPlace(ref).rot + d) % 360 + 360) % 360 });
  const patchTrace = (id: string, patch: Partial<Trace>) => setTraces((ts) => { const next = ts.map((t) => (t.id === id ? { ...t, ...patch } : t)); persist(places, next); return next; });
  const deleteTrace = (id: string) => { setTraces((ts) => { const next = ts.filter((t) => t.id !== id); persist(places, next); return next; }); setSel(null); };
  const setBoardV = (idx: number, patch: Partial<Pos>) => { const cur = board ?? bd, next = cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)); setBoard(next); persist(placesRef.current, tracesRef.current, viasRef.current, next); };

  const NUMCLS = "w-16 rounded bg-[#11192699] px-1.5 py-0.5 text-right font-mono text-[11px] text-[#cdd6e0] ring-1 ring-inset ring-[#212c42] outline-none focus:ring-[#356bb0]";
  const enterBlur = (e: React.KeyboardEvent) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); };
  const field = (label: string, node: React.ReactNode) => (<div key={label} className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[#7c89a0]">{label}</span>{node}</div>);

  const renderProps = () => {
    if (sel?.kind === "comp") {
      const c = project.components.find((x) => x.ref === sel.id); if (!c) return null;
      const p = curPlace(c.ref);
      return (<>
        <div className="mb-2 font-mono text-[13px] text-[#cdd6e0]">{c.ref.split("/").pop()}</div>
        {field("Footprint", <span className="font-mono text-[11px] text-[#9aa6bb]">{c.footprint}</span>)}
        {c.value ? field("Value", <span className="text-[#cdd6e0]">{c.value}</span>) : null}
        {field("X", <input key={`x${sel.id}`} type="number" step={grid || 0.1} defaultValue={+p.x.toFixed(3)} onBlur={(e) => setComp(c.ref, { x: parseFloat(e.target.value) || 0 })} onKeyDown={enterBlur} className={NUMCLS} />)}
        {field("Y", <input key={`y${sel.id}`} type="number" step={grid || 0.1} defaultValue={+p.y.toFixed(3)} onBlur={(e) => setComp(c.ref, { y: parseFloat(e.target.value) || 0 })} onKeyDown={enterBlur} className={NUMCLS} />)}
        {field("Rotation", <div className="flex items-center gap-1">
          <button onClick={() => rotateComp(c.ref, -90)} className={`${btn(false)} w-6 px-0`}>↺</button>
          <span className="w-9 text-center font-mono text-[11px] text-[#cdd6e0]">{p.rot}°</span>
          <button onClick={() => rotateComp(c.ref, 90)} className={`${btn(false)} w-6 px-0`}>↻</button>
        </div>)}
        {field("Pads", <span className="text-[#9aa6bb]">{c.pads.length}</span>)}
      </>);
    }
    if (sel?.kind === "pad") {
      const dot = sel.id.lastIndexOf("."), ref = sel.id.slice(0, dot), padId = sel.id.slice(dot + 1);
      const c = project.components.find((x) => x.ref === ref), pad = c?.pads.find((pd) => pd.id === padId);
      if (!c || !pad) return null;
      const p = padPos.get(sel.id), net = padNet.get(sel.id);
      return (<>
        <div className="mb-2 font-mono text-[13px] text-[#cdd6e0]">{ref.split("/").pop()} · pad {pad.id}</div>
        {field("Pin", <span className="font-mono text-[11px]" style={{ color: COL.silk }}>{pad.pin ?? "—"}</span>)}
        {field("Net", <span className="max-w-[110px] truncate font-mono text-[11px]" style={{ color: net ? NETCOL : "#6b7790" }}>{net ?? "unconnected"}</span>)}
        {field("Type", <span className="text-[#9aa6bb]">{pad.drill ? "through-hole" : "SMD"}</span>)}
        {field("Size", <span className="font-mono text-[11px] text-[#9aa6bb]">{+pad.w.toFixed(2)}×{+pad.h.toFixed(2)} mm</span>)}
        {p && field("Position", <span className="font-mono text-[11px] text-[#9aa6bb]">{p.x.toFixed(2)}, {p.y.toFixed(2)}</span>)}
        <button onClick={() => setSel({ kind: "comp", id: ref })} className={`${btn(false)} mt-1 w-full`}>Select footprint</button>
      </>);
    }
    if (sel?.kind === "trace") {
      const t = traces.find((x) => x.id === sel.id); if (!t) return null;
      const a = nodePos.get(t.a), b = nodePos.get(t.b); let len = 0;
      if (a && b) { const path = [a, ...t.points, b]; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); }
      return (<>
        <div className="mb-2 font-mono text-[13px]" style={{ color: layerColor(t.layer) }}>trace</div>
        {field("Net", <span className="max-w-[110px] truncate font-mono text-[11px]" style={{ color: COL.sel }}>{t.net || "—"}</span>)}
        {field("Layer", <select value={t.layer} onChange={(e) => patchTrace(t.id, { layer: e.target.value })} className={DD} style={{ colorScheme: "dark", color: layerColor(t.layer) }}>
          {COPPER.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>)}
        {field("Width", <div className={SEGBOX}>{WIDTHS.map((w) => <button key={w} onClick={() => patchTrace(t.id, { width: w })} className={seg(t.width === w)}>{w}</button>)}</div>)}
        {field("Length", <span className="font-mono text-[11px] text-[#9aa6bb]">{len.toFixed(2)} mm</span>)}
        {field("Corners", <span className="text-[#9aa6bb]">{t.points.length}</span>)}
        <button onClick={() => deleteTrace(t.id)} className="mt-1 w-full rounded-md bg-[#3a1c20] py-1 text-[11px] text-[#e2837e] hover:bg-[#4a2228]">Delete trace</button>
      </>);
    }
    if (sel?.kind === "boardv") {
      const idx = Number(sel.id), p = bd[idx]; if (!p) return null;
      return (<>
        <div className="mb-2 text-[13px] text-[#cdd6e0]">Board corner {idx + 1}</div>
        {field("X", <input key={`bx${idx}`} type="number" step={grid || 0.1} defaultValue={+p.x.toFixed(3)} onBlur={(e) => setBoardV(idx, { x: parseFloat(e.target.value) || 0 })} onKeyDown={enterBlur} className={NUMCLS} />)}
        {field("Y", <input key={`by${idx}`} type="number" step={grid || 0.1} defaultValue={+p.y.toFixed(3)} onBlur={(e) => setBoardV(idx, { y: parseFloat(e.target.value) || 0 })} onKeyDown={enterBlur} className={NUMCLS} />)}
        <div className="mt-1 text-[10px] leading-snug text-[#5b6a85]">Double-click a board edge to add a corner; Delete removes this one.</div>
      </>);
    }
    const b = bbox(bd);
    return (<div className="text-[#7c89a0]">
      <div className="mb-2 text-[11px] text-[#5b6a85]">Nothing selected</div>
      {field("Board", <span className="font-mono text-[11px] text-[#9aa6bb]">{+b.w.toFixed(1)}×{+b.h.toFixed(1)} mm</span>)}
      {field("Parts", <span className="text-[#9aa6bb]">{project.components.length}</span>)}
      {field("Nets", <span className="text-[#9aa6bb]">{project.ratsnest.length}</span>)}
      {field("Traces", <span className="text-[#9aa6bb]">{traces.length}</span>)}
    </div>);
  };

  // --- AI assistant: keep one live PCB snapshot in the assistant's context window ---
  const pcbCtx = useMemo(() => {
    const b = bbox(bd), lines: string[] = [];
    lines.push(`PCB layout for design "${design.name}".`);
    lines.push(`Board outline: ${b.w.toFixed(1)} × ${b.h.toFixed(1)} mm (${bd.length}-point polygon).`);
    let routedN = 0; const unrouted: string[] = [];
    for (const r of project.ratsnest) {
      const keyed = r.pads.map((k) => ({ k, p: padPos.get(k) })).filter((x) => x.p) as { k: string; p: Pos }[];
      const open = mst(keyed.map((x) => x.p)).some(([i, j]) => !routed(keyed[i].k, keyed[j].k));
      if (open) unrouted.push(r.net); else routedN++;
    }
    lines.push(`${project.components.length} components, ${project.ratsnest.length} nets, ${traces.length} traces, ${vias.length} vias.`);
    lines.push(`Routing: ${routedN}/${project.ratsnest.length} nets fully routed.${unrouted.length ? ` Unrouted: ${unrouted.join(", ")}.` : ""}`);
    lines.push("Components:");
    project.components.forEach((c, i) => {
      const pl = placeOf(c.ref, i);
      const pins = c.pads.map((pad) => `${pad.id}${pad.pin && pad.pin !== pad.id ? `=${pad.pin}` : ""}→${padNet.get(`${c.ref}.${pad.id}`) ?? "nc"}`).join(" ");
      lines.push(`- ${c.ref.split("/").pop()} (${c.footprint}) @(${pl.x.toFixed(1)},${pl.y.toFixed(1)},${pl.rot}°): ${pins}`);
    });
    if (drc) lines.push(`DRC: ${drc.filter((v) => v.severity === "error").length} errors, ${drc.filter((v) => v.severity === "warn").length} warnings.${drc.length ? " " + drc.slice(0, 12).map((v) => v.msg).join("; ") : ""}`);
    return lines.join("\n");
  }, [project, places, traces, vias, bd, drc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setContextItem("pcb", pcbCtx); }, [pcbCtx]);
  useEffect(() => () => setContextItem("pcb", ""), []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-[#1c2740] bg-[#0e1521] px-3 py-1.5 text-sm">
        <button onClick={onClose} className="mr-0.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-[#8b97aa] hover:bg-[#161f30] hover:text-white" title="Back to design">
          <span className="text-[14px] leading-none">←</span><span className="max-w-[150px] truncate">{design.name}</span>
        </button>
        {SEP}
        {/* mode */}
        <div className={SEGBOX}>
          <button onClick={() => { setTool("select"); setDrawing(null); setMeasure(null); }} className={seg(tool === "select")}>Move</button>
          <button onClick={() => { setTool("route"); setMeasure(null); }} className={seg(tool === "route")}>Route</button>
          <button onClick={() => { setTool("measure"); setDrawing(null); }} className={seg(tool === "measure")}>Measure</button>
        </div>
        {/* history */}
        <div className="flex gap-0.5">
          <button onClick={undo} disabled={!histRef.current.past.length} className={`${btn(false)} w-7 px-0 text-[14px] disabled:opacity-30 disabled:hover:bg-[#161f30]`} title="Undo (⌘Z)">↶</button>
          <button onClick={redo} disabled={!histRef.current.future.length} className={`${btn(false)} w-7 px-0 text-[14px] disabled:opacity-30 disabled:hover:bg-[#161f30]`} title="Redo (⇧⌘Z)">↷</button>
        </div>
        {SEP}
        {/* grid + corner rounding */}
        <label className={`flex items-center gap-1 ${lbl}`}>grid
          <select value={grid} onChange={(e) => setGrid(parseFloat(e.target.value))} className={DD} style={{ colorScheme: "dark" }}>
            {GRIDS.map((g) => <option key={g} value={g}>{g === 0 ? "free" : `${g} mm`}</option>)}
          </select>
        </label>
        <button onClick={() => setRounded((r) => !r)} className={btn(rounded)} title="Round / fillet trace corners">⌒ Round</button>
        {rounded && (
          <select value={fillet} onChange={(e) => setFillet(parseFloat(e.target.value))} className={DD} style={{ colorScheme: "dark" }} title="Corner radius">
            {[0.3, 0.6, 1, 1.5].map((r) => <option key={r} value={r}>{r} mm</option>)}
          </select>
        )}
        {tool === "route" && (
          <>
            {SEP}
            <select value={layer} onChange={(e) => setLayer(e.target.value)} className={DD} style={{ colorScheme: "dark", color: layerColor(layer) }} title="Active copper layer">
              {COPPER.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button onClick={() => setOrtho((o) => !o)} className={btn(false)} title="Toggle 45° / any-angle routing">{ortho ? "45°" : "any ∠"}</button>
            <label className={`flex items-center gap-1 ${lbl}`}>width
              <select value={width} onChange={(e) => setWidth(parseFloat(e.target.value))} className={DD} style={{ colorScheme: "dark" }}>
                {WIDTHS.map((w) => <option key={w} value={w}>{w} mm</option>)}
              </select>
            </label>
          </>
        )}
        {/* right cluster */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-md bg-[#11192699] px-2 py-1 font-mono text-[10.5px] text-[#7c89a0] ring-1 ring-inset ring-[#212c42]" title="Board size">{(() => { const b = bbox(bd); return `${+b.w.toFixed(1)}×${+b.h.toFixed(1)}`; })()} mm</span>
          <button onClick={fitBoard} className={btn(false)} title="Resize board to fit parts">Fit board</button>
          <button onClick={runDrc} className={btn(drc !== null)} title="Run design-rule check">DRC</button>
          <button onClick={exportKicad} className={btn(false)} title="Export KiCad .kicad_pcb">Export ↧</button>
          {SEP}
          <button onClick={autoArrange} className={btn(false)} title="Auto-arrange parts">Arrange</button>
          <button onClick={fitView} className={`${btn(false)} w-7 px-0 text-[14px]`} title="Fit view">⤢</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden" style={{ background: COL.bg }}>
        <svg ref={svgRef} width="100%" height="100%" viewBox={`${pan.x} ${pan.y} ${vw} ${vh}`}
          onPointerDown={onSvgDown} onPointerMove={onMove} onPointerUp={onUp} onContextMenu={(e) => e.preventDefault()}
          style={{ display: "block", touchAction: "none", cursor: tool === "route" || tool === "measure" ? "crosshair" : "default" }}>
          <defs>
            <pattern id="pcbgrid" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="0.035" fill={COL.gridDot} /></pattern>
            <pattern id="pcbgrid10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0 H0 V10" fill="none" stroke={COL.grid10} strokeWidth="0.04" /></pattern>
          </defs>
          <rect x={pan.x} y={pan.y} width={vw} height={vh} fill={COL.bg} onClick={onBgClick} />
          {zoom > 4 && <rect x={pan.x} y={pan.y} width={vw} height={vh} fill="url(#pcbgrid)" pointerEvents="none" />}
          <rect x={pan.x} y={pan.y} width={vw} height={vh} fill="url(#pcbgrid10)" pointerEvents="none" />
          {/* board origin */}
          <g pointerEvents="none" opacity={0.55}><line x1={-1.4} y1={0} x2={1.4} y2={0} stroke="#c05757" strokeWidth={0.05} /><line x1={0} y1={-1.4} x2={0} y2={1.4} stroke="#57c057" strokeWidth={0.05} /></g>

          {/* board outline — Edge.Cuts polygon (any shape) */}
          {vis["Edge.Cuts"] !== false && <polygon points={bd.map((p) => `${p.x},${p.y}`).join(" ")} fill={COL.boardFill} stroke={COL.board} strokeWidth={0.15} onClick={onBgClick} onDoubleClick={onBoardDblClick} />}

          {/* ratsnest airwires (skip routed links) */}
          {ratsEl}

          {/* copper traces — active layer full, inactive dimmed (KiCad-style) */}
          {traces.map((t) => {
            if (vis[t.layer] === false) return null;
            const on = sel?.kind === "trace" && sel.id === t.id;
            const hot = hotNet(t.net);
            const A = nodePos.get(t.a), B = nodePos.get(t.b), sp = A && B ? [A, ...t.points, B] : null;
            const d = tracePaths.get(t.id) ?? "";
            return (
              <g key={t.id} opacity={t.layer === layer ? 1 : hot ? 0.7 : 0.45}>
                {(on || hot) && <path d={d} fill="none" stroke={COL.sel} strokeWidth={t.width + (on ? 0.25 : 0.18)} strokeLinecap="round" strokeLinejoin="round" opacity={on ? 0.5 : 0.35} />}
                <path d={d} fill="none" stroke={layerColor(t.layer)} strokeWidth={t.width} strokeLinecap="round" strokeLinejoin="round" />
                {/* per-segment hit area: drag to slide the segment, double-click to insert a bend */}
                {sp?.slice(0, -1).map((q, k) => (
                  <line key={k} x1={q.x} y1={q.y} x2={sp[k + 1].x} y2={sp[k + 1].y} stroke="transparent" strokeWidth={Math.max(t.width * 4, 0.8)}
                    onPointerDown={(e) => onSegDown(e, t, k)} onDoubleClick={(e) => onTraceInsert(e, t)}
                    onPointerEnter={() => setHoverNet(t.net)} onPointerLeave={() => setHoverNet((h) => (h === t.net ? null : h))} style={{ cursor: "move" }} />
                ))}
                {on && t.points.map((pt, k) => (
                  <rect key={k} x={pt.x - 0.4} y={pt.y - 0.4} width={0.8} height={0.8} fill={COL.sel} stroke="#1a2030" strokeWidth={0.08}
                    onPointerDown={(e) => onVertexDown(e, t.id, k)} onDoubleClick={(e) => onVertexRemove(e, t.id, k)} style={{ cursor: "move" }} />
                ))}
              </g>
            );
          })}
          {drawing && (() => {
            const a = nodePos.get(drawing.a); if (!a) return null;
            const from = drawing.points.length ? drawing.points[drawing.points.length - 1] : a;
            const want = { x: snap(cursor.x, grid), y: snap(cursor.y, grid) };
            const tip = ortho ? octo(from, want) : want;
            return <path d={pathD([a, ...drawing.points, tip])} fill="none" stroke={layerColor(layer)} strokeWidth={width} strokeDasharray="0.5 0.3" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} pointerEvents="none" />;
          })()}

          {/* components */}
          {project.components.map((c, i) => {
            const pl = placeOf(c.ref, i);
            const on = sel?.kind === "comp" && sel.id === c.ref;
            return (
              <g key={`${c.ref}__${i}`}>
                <g transform={`translate(${pl.x},${pl.y}) rotate(${pl.rot})`}>
                  <g onPointerDown={(e) => onCompDown(e, c.ref, pl)} onClick={tool === "measure" ? () => measureClick(snapPoint(cursorRef.current)) : undefined} style={{ cursor: tool === "select" ? "move" : "crosshair" }}>
                    {/* courtyard / silkscreen body */}
                    {vis.silk !== false && <rect x={-c.w / 2} y={-c.h / 2} width={c.w} height={c.h} rx="0.2" fill="none" stroke={on ? COL.sel : COL.silk} strokeWidth={on ? 0.12 : 0.06} opacity={on ? 1 : 0.55} />}
                    {on && <rect x={-c.w / 2 - 0.2} y={-c.h / 2 - 0.2} width={c.w + 0.4} height={c.h + 0.4} rx="0.3" fill="none" stroke={COL.sel} strokeWidth={0.08} opacity={0.4} />}
                    {c.pads.map((pad) => {
                      const rx = (pad.round ?? 0.2) * Math.min(pad.w, pad.h);
                      const lab = pad.pin ?? pad.id; // functional pin name, falling back to the pad number
                      // size to the pad's short side (text height) and long side (text run); orient along the long axis
                      const shortS = Math.min(pad.w, pad.h), longS = Math.max(pad.w, pad.h);
                      const fnt = Math.min(shortS * 0.86, longS / Math.max(1, lab.length * 0.6), 0.9);
                      let world = (((pad.w >= pad.h ? 0 : 90) + pl.rot) % 180 + 180) % 180; if (world > 90) world -= 180;
                      const pkey = `${c.ref}.${pad.id}`, pnet = padNet.get(pkey), ph = hotNet(pnet);
                      const psel = sel?.kind === "pad" && sel.id === pkey;
                      return (
                        <g key={pad.id} onClick={(e) => onNodeClick(e, pkey)} onPointerEnter={() => setHoverNet(pnet ?? null)} onPointerLeave={() => setHoverNet((h) => (h === pnet ? null : h))} style={tool === "route" ? { cursor: "crosshair" } : undefined}>
                          <rect x={pad.x - pad.w / 2} y={pad.y - pad.h / 2} width={pad.w} height={pad.h} rx={rx} ry={rx} fill={COL.pad} />
                          {pad.drill ? <circle cx={pad.x} cy={pad.y} r={pad.drill / 2} fill={COL.padHole} /> : null}
                          {/* pin name (or number) — oriented along the pad's long axis, world-readable, shown when big enough on screen */}
                          {fnt * zoom > 4 && <text x={pad.x} y={pad.y} transform={`rotate(${world - pl.rot} ${pad.x} ${pad.y})`} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-mono)" fontSize={pad.drill ? fnt * 0.85 : fnt} fill={pad.drill ? "#eaf0f7" : COL.padText} pointerEvents="none">{lab}</text>}
                          {(ph || psel) && <rect x={pad.x - pad.w / 2 - 0.13} y={pad.y - pad.h / 2 - 0.13} width={pad.w + 0.26} height={pad.h + 0.26} rx={rx} ry={rx} fill="none" stroke={COL.sel} strokeWidth={psel ? 0.16 : 0.1} pointerEvents="none" />}
                        </g>
                      );
                    })}
                    {/* pin-1 silk marker */}
                    {(() => { const p1 = c.pads.find((pd) => pd.id === "1"); return p1 ? <circle cx={p1.x - p1.w / 2 - 0.45} cy={p1.y} r="0.22" fill={COL.silk} pointerEvents="none" /> : null; })()}
                  </g>
                </g>
                {vis.silk !== false && <text x={pl.x} y={pl.y - Math.max(c.w, c.h) / 2 - 0.7} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="1.4" fill={on ? COL.sel : COL.silk} pointerEvents="none">{c.ref.split("/").pop()}</text>}
              </g>
            );
          })}

          {/* net names on pads (upright) */}
          {netLabelsEl}

          {/* vias — copper annular ring + drill, clickable as a route node */}
          {vias.map((v) => (
            <g key={v.id} onClick={(e) => onNodeClick(e, `via:${v.id}`)} onPointerEnter={() => setHoverNet(v.net)} onPointerLeave={() => setHoverNet((h) => (h === v.net ? null : h))} style={tool === "route" ? { cursor: "crosshair" } : undefined}>
              <circle cx={v.x} cy={v.y} r={0.5} fill={COL.via} />
              <circle cx={v.x} cy={v.y} r={0.22} fill={COL.padHole} />
              {hotNet(v.net) && <circle cx={v.x} cy={v.y} r={0.63} fill="none" stroke={COL.sel} strokeWidth={0.1} pointerEvents="none" />}
            </g>
          ))}

          {/* routing crosshair at the snapped cursor */}
          {tool === "route" && (() => { const cx = snap(cursor.x, grid), cy = snap(cursor.y, grid); return (
            <g pointerEvents="none" opacity={0.4}>
              <line x1={pan.x} y1={cy} x2={pan.x + vw} y2={cy} stroke={COL.sel} strokeWidth={0.04} />
              <line x1={cx} y1={pan.y} x2={cx} y2={pan.y + vh} stroke={COL.sel} strokeWidth={0.04} />
            </g>
          ); })()}

          {/* measurement ruler (screen-constant sizing via k = 1px) */}
          {tool === "measure" && measure && (() => {
            const k = 1 / zoom, A = measure.a, B = measure.b ?? snapPoint(cursor);
            const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
            return (
              <g pointerEvents="none">
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={COL.sel} strokeWidth={1.2 * k} strokeDasharray={`${5 * k} ${3 * k}`} />
                <circle cx={A.x} cy={A.y} r={4 * k} fill="none" stroke={COL.sel} strokeWidth={1.2 * k} />
                <circle cx={B.x} cy={B.y} r={4 * k} fill="none" stroke={COL.sel} strokeWidth={1.2 * k} />
                <text x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 - 6 * k} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={12 * k}
                  fill={COL.sel} stroke={COL.bg} strokeWidth={3 * k} paintOrder="stroke" style={{ paintOrder: "stroke" }}>{dist.toFixed(2)} mm</text>
              </g>
            );
          })()}

          {/* board move handle (centroid) + draggable outline vertices — edit in Move mode */}
          {tool === "select" && (() => {
            const cx = bd.reduce((s, p) => s + p.x, 0) / bd.length, cy = bd.reduce((s, p) => s + p.y, 0) / bd.length;
            return (
              <>
                <g onPointerDown={onBoardMoveDown} style={{ cursor: "move" }}>
                  <circle cx={cx} cy={cy} r={0.85} fill={`${COL.board}33`} stroke={COL.board} strokeWidth={0.1} />
                  <circle cx={cx} cy={cy} r={0.2} fill={COL.board} />
                </g>
                {bd.map((p, i) => (
                  <rect key={i} x={p.x - 0.5} y={p.y - 0.5} width={1} height={1}
                    fill={sel?.kind === "boardv" && sel.id === String(i) ? COL.sel : COL.board} stroke="#1a2030" strokeWidth={0.08}
                    onPointerDown={(e) => onBoardVertexDown(e, i)} style={{ cursor: "move" }} />
                ))}
              </>
            );
          })()}

          {/* DRC violation markers */}
          {drcEl}
        </svg>
        <AssistantBubble />
        </div>
        <aside className="flex w-52 shrink-0 flex-col border-l border-[#1c2740] bg-[#0e1521] text-[12px]">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#5b6a85]">Properties</div>
            {renderProps()}
          </div>
          <div className="border-t border-[#1c2740] p-2">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#5b6a85]">Layers</div>
            {LAYER_ROWS.map((L) => {
              const on = vis[L.id] !== false, active = L.copper && layer === L.id;
              return (
                <div key={L.id} onClick={() => L.copper && setLayer(L.id)}
                  className={`mb-0.5 flex items-center gap-2 rounded px-1.5 py-1 ${L.copper ? "cursor-pointer" : ""} ${active ? "bg-[#1c2740]" : "hover:bg-[#141d2e]"}`}>
                  <button onClick={(e) => { e.stopPropagation(); setVis((v) => ({ ...v, [L.id]: !on })); }} className="w-3 text-center text-[10px] text-[#7c89a0] hover:text-white" title="Toggle visibility">{on ? "◉" : "○"}</button>
                  <span className="h-3 w-3 rounded-sm" style={{ background: L.color, opacity: on ? 1 : 0.3 }} />
                  <span className="flex-1" style={{ color: on ? "#cdd6e0" : "#5b6a85" }}>{L.label}</span>
                  {active && <span className="text-[9px] uppercase text-[#8b97aa]">act</span>}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* DRC results — bottom "Problems" dock */}
      {drc !== null && (
        <div className="flex h-44 min-h-0 flex-col border-t border-[#1c2740] bg-[#0b1320] text-[12px]">
          <div className="flex items-center gap-2 border-b border-[#1c2740] px-3 py-1.5">
            <span className="font-semibold text-[#cdd6e0]">Problems</span>
            {drc.length === 0
              ? <span className="text-[#5fc27e]">✓ no violations</span>
              : <>
                  <span className="rounded bg-[#3a1c20] px-1.5 py-0.5 text-[10.5px] text-[#e2837e]">{drc.filter((v) => v.severity === "error").length} errors</span>
                  <span className="rounded bg-[#39321488] px-1.5 py-0.5 text-[10.5px] text-[#e0c060]">{drc.filter((v) => v.severity === "warn").length} warnings</span>
                </>}
            <button onClick={runDrc} className={`${btn(false)} ml-2 h-6`} title="Re-run DRC">Re-run</button>
            <button onClick={() => setDrc(null)} className="ml-auto rounded px-1.5 text-[14px] text-[#7c89a0] hover:bg-[#161f30] hover:text-white" title="Close panel">✕</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {drc.length === 0 && <div className="px-3 py-3 text-[#6b7790]">Board passes all design-rule checks.</div>}
            {drc.map((v, i) => (
              <button key={i} onClick={() => panTo(v.where)} className="flex w-full items-center gap-2.5 border-b border-[#10192866] px-3 py-1.5 text-left hover:bg-[#141d2e]">
                <span className="text-[13px] leading-none" style={{ color: SEV[v.severity] }}>{v.severity === "error" ? "●" : "▲"}</span>
                <span className="text-[#c5cdda]">{v.msg}</span>
                {v.net && <span className="ml-auto font-mono text-[10.5px] text-[#6b7790]">{v.net}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-[#1c2740] bg-[#0e1521] px-4 py-1 font-mono text-[11px] text-[#8b97aa]">
        <span>X <span ref={xReadout} className="text-[#cdd6e0]">{cursorRef.current.x.toFixed(2)}</span></span>
        <span>Y <span ref={yReadout} className="text-[#cdd6e0]">{cursorRef.current.y.toFixed(2)}</span></span>
        <span className="text-[#5b6a85]">mm</span>
        <span>grid {grid === 0 ? "free" : grid}</span>
        <span>layer <span style={{ color: layerColor(layer) }}>{layer}</span></span>
        {hoverNet && <span>net <span style={{ color: COL.sel }}>{hoverNet}</span></span>}
        {tool === "measure" && measure && (() => { const B = measure.b ?? snapPoint(cursor); const dx = B.x - measure.a.x, dy = B.y - measure.a.y; return (
          <span style={{ color: COL.sel }}>⟺ {Math.hypot(dx, dy).toFixed(2)} mm · dx {dx.toFixed(2)} · dy {dy.toFixed(2)} · {(Math.atan2(-dy, dx) * 180 / Math.PI).toFixed(1)}°</span>
        ); })()}
        <span className="ml-3 hidden truncate font-sans text-[#6b7790] lg:inline">{hint}</span>
        <span className="ml-auto">{traces.length} traces · {vias.length} vias</span>
        {drc && <span style={{ color: drc.some((v) => v.severity === "error") ? SEV.error : "#5fc27e" }}>{drc.filter((v) => v.severity === "error").length ? `${drc.filter((v) => v.severity === "error").length} DRC errors` : "DRC clean"}</span>}
      </div>
    </div>
  );
}
