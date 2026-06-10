"use client";
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type PointerEvent as RPE, type MouseEvent as RME, type DragEvent as RDE,
} from "react";
import { SYMBOLS, SYMBOL_GROUPS, renderChip, useSymbolStyle } from "./symbols";
import SymbolStyleToggle from "./SymbolStyleToggle";
import AssistantBubble from "./AssistantBubble";
import DiscreteModal from "./DiscreteModal";
import { track } from "@/lib/telemetry";
import { saveUserBlock, isUserBlock, getUserBlocks } from "@/lib/userBlocks";
import { confirmDialog } from "@/app/ui/dialog";
import { deriveSchematicNets, schematicInsights, discreteEquivalentFor, type InsightComponent, type SchematicLayout, type Terminal, type Block, type NetType } from "@electrace/core";
import {
  WIRE_COLOR, type WireState, type Pt, type PinRef, type WireTap, type Endpoint, type Sym, type Wire, type Model,
  isPin, isTap, pinAbs, endAbs, toSchEndpoint, segmentsOf, ortho, layoutToModel, modelBounds, symBounds, symPoint, symDims, normRot, anchorOrigin, nearestPin, nearestWirePoint, wireAtPoint, pinAtCoord, orientPorts, placeLabels,
  PROFILES, type ChipSpec,
} from "./schematic-model";

const GRID = 10;
const snap = (n: number) => Math.round(n / GRID) * GRID;

// ── symbols never overlap ──────────────────────────────────────────────────
// There's no legitimate reason for two symbols to sit on top of each other, so every mutation
// (drag, nudge, add, duplicate, rotate) is collision-checked. Bounds are deflated a couple of
// pixels so edge-touching on the grid stays allowed — only real overlap is blocked.
function symClearRect(s: Sym): { x: number; y: number; w: number; h: number } | null {
  const d = symDims(s);
  if (!d) return null;
  const b = symBounds(s, d.w, d.h);
  return { x: b.minX + 2, y: b.minY + 2, w: Math.max(1, b.maxX - b.minX - 4), h: Math.max(1, b.maxY - b.minY - 4) };
}
function symsCollide(syms: Sym[], movedIds: Set<string>): boolean {
  const moved: NonNullable<ReturnType<typeof symClearRect>>[] = [];
  const still: typeof moved = [];
  for (const s of syms) {
    const r = symClearRect(s);
    if (r) (movedIds.has(s.id) ? moved : still).push(r);
  }
  return moved.some((a) => still.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y));
}
/** Offsets at chebyshev ring r (for finding the nearest free drop spot). */
function ring(r: number): [number, number][] {
  if (r === 0) return [[0, 0]];
  const out: [number, number][] = [];
  for (let i = -r; i <= r; i++) { out.push([i, -r], [i, r]); if (Math.abs(i) !== r) out.push([-r, i], [r, i]); }
  return out;
}
// unique id suffix: a per-session counter disambiguates ids created within the same millisecond
let _uidSeq = 0;
const uid = () => `${Math.floor(performance.now())}-${_uidSeq++}`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const NET_COLOR: Record<string, string> = { power: "#f7b13c", rail: "#46dca6", gnd: "#9aa6b6", signal: "#4c8dff" };
// locate-flash colours by severity: [fill, edge]. error = red, warning = amber, info = blue.
const FLASH_COLOR: Record<"error" | "warn" | "info", [string, string]> = {
  error: ["#f87171", "#fca5a5"], warn: ["#fbbf24", "#fde68a"], info: ["#4c8dff", "#9ec5ff"],
};

type Problem = { sev: "error" | "warn" | "info"; msg: string; target?: { kind: "sym" | "wire"; id: string } };

/** Format a declared spec value (number | string | Range) for a chip. */
function fmtSpecVal(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const r = v as { value?: number; min?: number; max?: number; unit?: string };
    const u = r.unit ? ` ${r.unit}` : "";
    if (r.value != null) return `${r.value}${u}`;
    if (r.min != null || r.max != null) return `${r.min ?? "?"}–${r.max ?? "?"}${u}`;
  }
  return "";
}

/** Ensure the schematic carries a port symbol for every declared terminal (inputs on the
 *  left, outputs on the right). The port's `ref` holds the terminal id, mapping net → terminal. */
function seedPorts(model: Model, terminals: Terminal[]): Model {
  const termIds = new Set(terminals.map((t) => t.id));
  // prune orphan ports — a port whose terminal was removed — and any wires touching them, so a
  // removed terminal doesn't leave its port behind in the schematic.
  const orphans = new Set(model.syms.filter((s) => s.type === "port" && (!s.ref || !termIds.has(s.ref))).map((s) => s.id));
  let syms = orphans.size ? model.syms.filter((s) => !orphans.has(s.id)) : model.syms;
  const wires = orphans.size ? model.wires.filter((w) => !((isPin(w.a) && orphans.has(w.a.sym)) || (isPin(w.b) && orphans.has(w.b.sym)))) : model.wires;

  const have = new Set(syms.filter((s) => s.type === "port").map((s) => s.ref));
  const missing = terminals.filter((t) => !have.has(t.id));
  if (!missing.length && !orphans.size) return model;
  const b = modelBounds({ syms, wires });
  let li = 0, ri = 0;
  const ports: Sym[] = missing.map((t) => {
    const left = t.role === "in";
    return {
      id: `port-${t.id}`, type: "port", ref: t.id,
      x: snap(left ? b.x - 80 : b.x + b.w + 50),
      y: snap(b.y + (left ? li++ : ri++) * 48),
    };
  });
  return { ...model, syms: [...syms, ...ports], wires };
}

/** Pan/zoom that fits the model's content (with padding) centred in a `sz` viewport. */
function computeFit(m: Model, sz: { w: number; h: number }) {
  const b = modelBounds(m);
  const pad = 48;
  const z = clamp(Math.min(sz.w / (b.w + pad * 2), sz.h / (b.h + pad * 2)), 0.35, 2);
  return { zoom: z, pan: { x: b.x - (sz.w / z - b.w) / 2, y: b.y - (sz.h / z - b.h) / 2 } };
}

export default function BlockSchematic({ blockId, initial, terminals = [], block }: { blockId: string; initial?: SchematicLayout; terminals?: Terminal[]; block?: Block }) {
  const LS = `electrace:blocksch:${blockId}`;
  const [model, setModel] = useState<Model>({ syms: [], wires: [] });
  // Ports ALWAYS face their wire — normalize the model itself whenever it changes, so a port
  // placed backwards (Sparky's habit, or a paste) snaps to face its connection everywhere: the
  // canvas, previews, and what gets saved. orientPorts is idempotent; iterate to a fixpoint and
  // only write back when a rotation actually changed (no render loop).
  useEffect(() => {
    let m = model;
    for (let i = 0; i < 3; i++) {
      const o = orientPorts(m);
      if (o.syms.every((s, j) => normRot(s.rot ?? 0) === normRot(m.syms[j].rot ?? 0))) break;
      m = o;
    }
    if (m !== model) setModel(m);
  }, [model]);
  // selection is a set of namespaced keys: "sym:<id>" / "wire:<id>"
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [draw, setDraw] = useState<{ a: PinRef; pts: Pt[] } | null>(null);
  const [cursor, setCursor] = useState<Pt>({ x: 0, y: 0 });
  const [hoverNet, setHoverNet] = useState<number | null>(null);
  const [bandRect, setBandRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [flash, setFlash] = useState<{ kind: "sym" | "wire"; id: string; n: number; sev: "error" | "warn" | "info" } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const symStyle = useSymbolStyle();

  const symKey = (id: string) => `sym:${id}`;
  const wireKey = (id: string) => `wire:${id}`;
  const isSelSym = (id: string) => sel.has(symKey(id));
  const isSelWire = (id: string) => sel.has(wireKey(id));
  const idsOfKind = (s: Set<string>, kind: "sym" | "wire") => [...s].filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1));
  const selSymIds = () => idsOfKind(sel, "sym");
  const toggle = (set: Set<string>, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); return n; };

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const loaded = useRef(false);
  const fitted = useRef(false);

  // pan / zoom (viewBox-based: captures trackpad pinch as ctrl+wheel, two-finger as pan)
  const [size, setSize] = useState({ w: 900, h: 640 });
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef(pan); panRef.current = pan;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const cursorRef = useRef(cursor); // updated imperatively in onMove; only mirrored to state while wiring
  const selRef = useRef(sel); selRef.current = sel;
  const modelRef = useRef(model); modelRef.current = model;

  // undo/redo
  const hist = useRef<Model[]>([{ syms: [], wires: [] }]);
  const hidx = useRef(0);
  const restoring = useRef(false);
  const [, bump] = useState(0);

  // load: prefer a non-empty draft, else seed from the block's authored layout
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let m = layoutToModel(initial);
    try {
      const raw = localStorage.getItem(LS);
      if (raw) { const d = JSON.parse(raw); if (Array.isArray(d.syms) && d.syms.length) m = d; }
    } catch { /* ignore */ }
    m = seedPorts(m, terminals); // always expose the block's declared terminals
    restoring.current = true;
    setModel(m);
    hist.current = [m];
    hidx.current = 0;
  }, [LS, initial, terminals]);

  // track container size for the viewBox aspect
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // fit the schematic to the canvas once, after the model loads and the size is known
  useEffect(() => {
    if (fitted.current || !size.w || !model.syms.length) return;
    const f = computeFit(model, size);
    setZoom(f.zoom);
    setPan(f.pan);
    fitted.current = true;
  }, [size, model]);

  // native wheel listener (non-passive so we can preventDefault the browser page-zoom)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const z = zoomRef.current;
      // Decide pan vs zoom by input device:
      //  · pinch / ctrl-wheel  → zoom (trackpad pinch sets ctrlKey)
      //  · a mouse wheel       → zoom (line-mode, or big quantized vertical-only steps)
      //  · two-finger trackpad → pan  (everything else: small/fractional, or horizontal)
      // Normalize deltas: Firefox uses LINE mode (±3) and fractional pixel deltas — unnormalized,
      // zoom crawled and the integer test misrouted the wheel to pan (same fix as the PCB editor).
      const km = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
      const dxn = e.deltaX * km, dyn = e.deltaY * km;
      const mouseWheel = e.deltaMode !== 0 || (dxn === 0 && Math.abs(dyn) >= 80);
      if (e.ctrlKey || mouseWheel) {
        // pinch sends tiny deltas (needs a steeper curve); a wheel notch sends big ones
        const pinch = e.ctrlKey && Math.abs(dyn) < 50;
        const k = pinch ? 0.016 : 0.006; // zoom-per-notch sensitivity (higher = faster zoom)
        const step = Math.max(-120, Math.min(120, dyn));
        const nz = clamp(z * Math.exp(-step * k), 0.35, 3.5);
        const ox = e.clientX - r.left, oy = e.clientY - r.top;
        const cx = panRef.current.x + ox / z, cy = panRef.current.y + oy / z;
        setZoom(nz);
        setPan({ x: cx - ox / nz, y: cy - oy / nz });
      } else {
        setPan((p) => ({ x: p.x + dxn / z, y: p.y + dyn / z }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // autosave + history
  useEffect(() => {
    if (restoring.current) { restoring.current = false; return; }
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LS, JSON.stringify(model));
        window.dispatchEvent(new CustomEvent("electrace:blocksch", { detail: blockId }));
      } catch { /* ignore */ }
      const s: Model = JSON.parse(JSON.stringify(model));
      if (JSON.stringify(s) === JSON.stringify(hist.current[hidx.current])) return;
      hist.current = hist.current.slice(0, hidx.current + 1);
      hist.current.push(s);
      hidx.current = hist.current.length - 1;
      bump((v) => v + 1);
    }, 400);
    return () => clearTimeout(id);
  }, [LS, model]);

  // discard this block's saved draft and reload the authored schematic
  const resetBlock = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!(await confirmDialog({ title: "Discard block edits?", message: "Reverts this block to its authored schematic.", confirmText: "Discard", danger: true }))) return;
    try { localStorage.removeItem(LS); } catch { /* ignore */ }
    const m = seedPorts(layoutToModel(initial), terminals);
    restoring.current = true; setModel(m); hist.current = [m]; hidx.current = 0; fitted.current = false;
    setSel(new Set()); setDraw(null);
    window.dispatchEvent(new CustomEvent("electrace:blocksch", { detail: blockId }));
  }, [LS, initial, terminals, blockId]);

  const restore = useCallback((m: Model) => { restoring.current = true; setModel(m); bump((v) => v + 1); }, []);
  const undo = useCallback(() => { if (hidx.current > 0) { hidx.current--; restore(hist.current[hidx.current]); } }, [restore]);
  const redo = useCallback(() => { if (hidx.current < hist.current.length - 1) { hidx.current++; restore(hist.current[hidx.current]); } }, [restore]);

  const del = useCallback(() => {
    const cur = selRef.current;
    if (!cur.size) return;
    const wireIds = new Set(idsOfKind(cur, "wire"));
    const symIds = idsOfKind(cur, "sym");
    const onSym = (e: Endpoint, id: string) => isPin(e) && e.sym === id;
    setModel((m) => {
      const remove = new Set(symIds.filter((id) => m.syms.find((s) => s.id === id)?.type !== "port")); // keep ports
      const kept = m.wires.filter((w) => !wireIds.has(w.id) && ![...remove].some((id) => onSym(w.a, id) || onSym(w.b, id)));
      const keptIds = new Set(kept.map((w) => w.id));
      // a tap whose host wire just went away degrades to a fixed point where it last sat —
      // the child wire survives (visibly floating) instead of silently breaking
      const detach = (e: Endpoint): Endpoint => {
        if (!isTap(e) || keptIds.has(e.wire)) return e;
        const p = endAbs(m.syms, e, m.wires);
        return p ? { x: p.x, y: p.y } : e;
      };
      return {
        syms: m.syms.filter((s) => !remove.has(s.id)),
        wires: kept.map((w) => (isTap(w.a) || isTap(w.b) ? { ...w, a: detach(w.a), b: detach(w.b) } : w)),
      };
    });
    setSel(new Set());
  }, []);

  const rotateSel = useCallback((d: number) => {
    const ids = new Set(idsOfKind(selRef.current, "sym"));
    if (!ids.size) return;
    setModel((m) => {
      const next = m.syms.map((s) => (ids.has(s.id) ? { ...s, rot: normRot((s.rot ?? 0) + d) } : s));
      return symsCollide(next, ids) ? m : { ...m, syms: next }; // a rotation that would land on a neighbour is refused
    });
    track({ kind: "sym.rotate", block: blockId });
  }, [blockId]);

  const nudgeSel = useCallback((dx: number, dy: number) => {
    const ids = new Set(idsOfKind(selRef.current, "sym"));
    if (!ids.size) return;
    setModel((m) => {
      const next = m.syms.map((s) => { if (!ids.has(s.id)) return s; const o = anchorOrigin(s, s.x + dx, s.y + dy, GRID); return { ...s, x: o.x, y: o.y }; });
      return symsCollide(next, ids) ? m : { ...m, syms: next };
    });
  }, []);

  const duplicateSel = useCallback(() => {
    const ids = idsOfKind(selRef.current, "sym");
    if (!ids.length) return;
    const m = modelRef.current;
    const counts: Record<string, number> = {};
    const clones: Sym[] = [];
    const keys: string[] = [];
    for (const id of ids) {
      const s = m.syms.find((x) => x.id === id);
      if (!s || s.type === "port") continue; // ports are unique to terminals — don't clone
      const def = SYMBOLS[s.type];
      counts[s.type] = (counts[s.type] ?? 0) + 1;
      const ref = def?.defaultRef === "GND" ? "GND" : `${def?.defaultRef}${m.syms.filter((x) => x.type === s.type).length + counts[s.type]}`;
      const nid = `${s.type}-${uid()}-${clones.length}`;
      const o = anchorOrigin(s, s.x + 20, s.y + 20, GRID);
      clones.push({ ...s, id: nid, ref, x: o.x, y: o.y });
      keys.push(symKey(nid));
    }
    if (!clones.length) return;
    setModel((mm) => {
      // the +20 offset may land on something — march the whole clone group diagonally to clear air
      let group = clones;
      const cloneIds = new Set(clones.map((c) => c.id));
      for (let step = 0; step < 24 && symsCollide([...mm.syms, ...group], cloneIds); step++) {
        group = group.map((c) => { const o = anchorOrigin(c, c.x + GRID * 2, c.y + GRID * 2, GRID); return { ...c, x: o.x, y: o.y }; });
      }
      return { ...mm, syms: [...mm.syms, ...group] };
    });
    setSel(new Set(keys));
  }, []);

  // select a problem's target (symbol or wire) and pan it to the centre of the view
  const locate = useCallback((target?: { kind: "sym" | "wire"; id: string }, sev: "error" | "warn" | "info" = "error") => {
    if (!target) return;
    const m = modelRef.current; let cx: number, cy: number;
    if (target.kind === "sym") {
      const s = m.syms.find((x) => x.id === target.id); const d = s && symDims(s); if (!s || !d) return;
      const bb = symBounds(s, d.w, d.h); cx = (bb.minX + bb.maxX) / 2; cy = (bb.minY + bb.maxY) / 2;
      setSel(new Set([symKey(target.id)]));
    } else {
      const w = m.wires.find((x) => x.id === target.id); const a = w && endAbs(m.syms, w.a, m.wires), b = w && endAbs(m.syms, w.b, m.wires);
      if (!a || !b) return; cx = (a.x + b.x) / 2; cy = (a.y + b.y) / 2;
      setSel(new Set([wireKey(target.id)]));
    }
    const z = zoomRef.current;
    setPan({ x: cx - size.w / z / 2, y: cy - size.h / z / 2 });
    setFlash({ kind: target.kind, id: target.id, n: Date.now(), sev }); // pulse the located thing, coloured by severity
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1500);
  }, [size]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); }
      else if (k === "escape") setDraw(null);
      else if (k === "enter") {
        // finish the wire at the cursor — on a pin if one's near, else a floating grid point
        setDraw((d) => {
          if (!d) return d;
          const ws = wireSnap(cursorRef.current);
          const end = ws.pin && !(d.a.sym === ws.pin.sym && d.a.pin === ws.pin.pin) ? ws.pin : { x: ws.x, y: ws.y };
          setModel((m) => ({ ...m, wires: [...m.wires, { id: `w-${uid()}`, a: d.a, b: end, mid: d.pts }] }));
          return null;
        });
      }
      else if (k === "delete" || k === "backspace") { e.preventDefault(); del(); }
      else if (k === "r" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); rotateSel(e.shiftKey ? -90 : 90); }
      else if ((e.ctrlKey || e.metaKey) && k === "d") { e.preventDefault(); duplicateSel(); }
      else if (k === "arrowleft") { e.preventDefault(); nudgeSel(-GRID, 0); }
      else if (k === "arrowright") { e.preventDefault(); nudgeSel(GRID, 0); }
      else if (k === "arrowup") { e.preventDefault(); nudgeSel(0, -GRID); }
      else if (k === "arrowdown") { e.preventDefault(); nudgeSel(0, GRID); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, del, rotateSel, duplicateSel, nudgeSel]);

  // client → content coordinates (accounts for pan + zoom)
  const localPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const z = zoomRef.current;
    return { x: panRef.current.x + (e.clientX - r.left) / z, y: panRef.current.y + (e.clientY - r.top) / z };
  };

  // Snap a wire point: magnetically to the nearest pin, else to a point ON an existing wire (a junction
  // tap — so you can wire to a wire, not just pin-to-pin), else to the grid. Tolerance is in content units
  // so it stays a constant screen distance at any zoom.
  const wireSnap = (p: Pt): { x: number; y: number; pin?: PinRef; tap?: WireTap } => {
    const tol = 10 / zoomRef.current;
    const hit = nearestPin(modelRef.current.syms, p.x, p.y, tol);
    if (hit) return { x: hit.x, y: hit.y, pin: { sym: hit.sym, pin: hit.pin } };
    const onW = nearestWirePoint(modelRef.current.syms, modelRef.current.wires, p, tol);
    if (onW) return { x: onW.x, y: onW.y, tap: { wire: onW.wireId, t: onW.t } };
    return { x: snap(p.x), y: snap(p.y) };
  };

  // place a symbol centred at content point (cx, cy)
  const addSymAt = (type: string, cx: number, cy: number) => {
    const def = SYMBOLS[type];
    if (!def) return;
    track({ kind: "sym.add", block: blockId, symbol: type });
    setModel((m) => {
      const n = m.syms.filter((s) => s.type === type).length + 1;
      const ref = def.defaultRef === "GND" ? "GND" : `${def.defaultRef}${n}`;
      const chip = type === "chip" ? { chip: { profile: "soic", pins: 8, names: {}, mpn: "" } as ChipSpec } : {};
      const base: Sym = { id: `${type}-${uid()}`, type, ref, x: cx - def.w / 2, y: cy - def.h / 2, ...chip };
      // land its first pin on the grid, then walk outward in rings to the nearest spot that
      // doesn't sit on an existing symbol (symbols never overlap)
      const o = anchorOrigin(base, base.x, base.y, GRID);
      let placedSym = { ...base, x: o.x, y: o.y };
      outer: for (let r = 0; r <= 10; r++) {
        for (const [ox, oy] of ring(r)) {
          const cand = { ...base, x: o.x + ox * GRID * 3, y: o.y + oy * GRID * 3 };
          if (!symsCollide([...m.syms, cand], new Set([cand.id]))) { placedSym = cand; break outer; }
        }
      }
      return { ...m, syms: [...m.syms, placedSym] };
    });
  };
  // click-to-add drops near the centre of the current view (with a slight cascade)
  const addSym = (type: string) => {
    const off = (model.syms.length % 6) * 24;
    addSymAt(type, panRef.current.x + size.w / zoomRef.current / 2 + off, panRef.current.y + size.h / zoomRef.current / 2 + off);
  };

  const onCanvasDragOver = (e: RDE) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const onCanvasDrop = (e: RDE) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/symbol");
    if (type && SYMBOLS[type]) { const p = localPt(e); addSymAt(type, p.x, p.y); }
  };

  // --- dragging: symbols (groups) + wires, plus the marquee ---
  const drag = useRef<{ ids: string[]; startMouse: Pt; starts: Map<string, Pt> } | null>(null);
  type Pend = { id: string; mode: "whole" | "insert" | "point"; idx: number; start: Pt; startMid: Pt[]; active: boolean };
  const pend = useRef<Pend | null>(null);
  const band = useRef<{ start: Pt; active: boolean; shift: boolean } | null>(null);
  const panDrag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null); // middle-button pan

  const onSymDown = (e: RPE<SVGGElement>, s: Sym) => {
    if (draw || e.button !== 0) return; // let non-primary buttons (middle = pan) bubble to the canvas
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (e.shiftKey) { setSel((prev) => toggle(prev, symKey(s.id))); return; } // shift-click toggles, no drag
    let ids = selSymIds();
    if (!isSelSym(s.id)) { ids = [s.id]; setSel(new Set([symKey(s.id)])); } // grabbing an unselected part selects just it
    const p = localPt(e);
    const m = modelRef.current;
    const starts = new Map(ids.map((id) => { const sym = m.syms.find((x) => x.id === id)!; return [id, { x: sym.x, y: sym.y }] as const; }));
    drag.current = { ids, startMouse: p, starts };
  };

  const onWireDown = (e: RPE<SVGPathElement>, w: Wire) => {
    if (e.button !== 0) return;
    if (draw) {
      // tapping an existing wire while drawing → finish the wire as a junction BOUND to it (wire-to-wire)
      e.stopPropagation();
      const onW = nearestWirePoint(model.syms, model.wires, localPt(e), Infinity);
      const end: Endpoint = onW ? { wire: onW.wireId, t: onW.t } : { x: snap(localPt(e).x), y: snap(localPt(e).y) };
      setModel((m) => ({ ...m, wires: [...m.wires, { id: `w-${uid()}`, a: draw.a, b: end, mid: draw.pts }] }));
      track({ kind: "wire.add", block: blockId, from: `${draw.a.sym}.${draw.a.pin}`, to: onW ? `tap:${onW.wireId}` : "free" });
      setDraw(null);
      return;
    }
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pend.current = { id: w.id, mode: w.mid.length ? "whole" : "insert", idx: 0, start: localPt(e), startMid: w.mid.map((p) => ({ ...p })), active: false };
  };
  const onWaypointDown = (e: RPE<SVGRectElement>, w: Wire, idx: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSel(new Set([wireKey(w.id)]));
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pend.current = { id: w.id, mode: "point", idx, start: localPt(e), startMid: w.mid.map((p) => ({ ...p })), active: false };
  };

  // middle-button (or space-less) drag pans the canvas
  const onSvgDown = (e: RPE<SVGSVGElement>) => {
    if (e.button !== 1) return;
    e.preventDefault();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    panDrag.current = { sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y };
  };

  const onMove = (e: RPE<SVGSVGElement>) => {
    const pd0 = panDrag.current;
    if (pd0) {
      const z = zoomRef.current;
      setPan({ x: pd0.px - (e.clientX - pd0.sx) / z, y: pd0.py - (e.clientY - pd0.sy) / z });
      return;
    }
    const p = localPt(e);
    cursorRef.current = p;
    if (draw) { const ws = wireSnap(p); setCursor({ x: ws.x, y: ws.y }); } // preview snaps to pins/grid
    const bd = band.current;
    if (bd) {
      if (!bd.active && Math.hypot(p.x - bd.start.x, p.y - bd.start.y) > 4 / zoomRef.current) bd.active = true;
      if (bd.active) setBandRect({ x: Math.min(bd.start.x, p.x), y: Math.min(bd.start.y, p.y), w: Math.abs(p.x - bd.start.x), h: Math.abs(p.y - bd.start.y) });
      return;
    }
    const d = drag.current;
    if (d) {
      const dx = snap(p.x - d.startMouse.x), dy = snap(p.y - d.startMouse.y); // grid-step delta keeps anchored pins on grid
      setModel((m) => {
        const ids = new Set(d.ids);
        const apply = (ax: number, ay: number) => m.syms.map((s) => { const st = d.starts.get(s.id); return st ? { ...s, x: st.x + ax, y: st.y + ay } : s; });
        // never overlap: try the full delta, then each axis alone — the drag slides along an
        // obstacle instead of passing through it (or sticks when boxed in)
        for (const [ax, ay] of [[dx, dy], [dx, 0], [0, dy]] as [number, number][]) {
          const next = apply(ax, ay);
          if (!symsCollide(next, ids)) return { ...m, syms: next };
        }
        return m;
      });
      return;
    }
    const pd = pend.current;
    if (!pd) return;
    if (!pd.active) {
      if (Math.hypot(p.x - pd.start.x, p.y - pd.start.y) < 7 / zoomRef.current) return;
      pd.active = true;
      if (pd.mode === "insert") {
        const np = { x: snap(pd.start.x), y: snap(pd.start.y) };
        pd.startMid = [np]; pd.idx = 0;
        setModel((m) => ({ ...m, wires: m.wires.map((w) => (w.id === pd.id ? { ...w, mid: [np] } : w)) }));
      }
    }
    const dx = p.x - pd.start.x, dy = p.y - pd.start.y;
    setModel((m) => ({
      ...m,
      wires: m.wires.map((w) => {
        if (w.id !== pd.id) return w;
        if (pd.mode === "whole") return { ...w, mid: pd.startMid.map((q) => ({ x: snap(q.x + dx), y: snap(q.y + dy) })) };
        const mid = w.mid.map((q) => ({ ...q }));
        const base = pd.startMid[pd.idx] ?? pd.startMid[0] ?? pd.start;
        mid[pd.idx] = { x: snap(base.x + dx), y: snap(base.y + dy) };
        return { ...w, mid };
      }),
    }));
  };
  const onUp = () => {
    if (panDrag.current) { panDrag.current = null; return; }
    const bd = band.current; band.current = null;
    if (bd) {
      if (bd.active) {
        const c = cursorRef.current;
        const r = { x: Math.min(bd.start.x, c.x), y: Math.min(bd.start.y, c.y), w: Math.abs(c.x - bd.start.x), h: Math.abs(c.y - bd.start.y) };
        selectInBox(r, bd.shift);
      } else if (!draw) {
        setSel(new Set()); // a plain empty click clears the selection
      }
      setBandRect(null);
    }
    drag.current = null; pend.current = null;
  };

  // marquee select: symbols whose box overlaps, wires with any vertex inside
  const selectInBox = (r: { x: number; y: number; w: number; h: number }, additive: boolean) => {
    const inRect = (p: Pt) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    const hits = new Set<string>();
    for (const s of model.syms) {
      const d = symDims(s);
      if (!d) continue;
      const b = symBounds(s, d.w, d.h);
      if (r.x < b.maxX && r.x + r.w > b.minX && r.y < b.maxY && r.y + r.h > b.minY) hits.add(symKey(s.id));
    }
    for (const w of model.wires) {
      const a = endAbs(model.syms, w.a, model.wires), b2 = endAbs(model.syms, w.b, model.wires);
      const pts = [a, ...w.mid, b2].filter(Boolean) as Pt[];
      if (pts.some(inRect)) hits.add(wireKey(w.id));
    }
    setSel((prev) => (additive ? new Set([...prev, ...hits]) : hits));
  };

  const onPin = (e: RME, sym: string, pin: string) => {
    e.stopPropagation();
    const ref = { sym, pin };
    if (!draw) setDraw({ a: ref, pts: [] });
    else {
      if (!(draw.a.sym === sym && draw.a.pin === pin)) {
        setModel((m) => ({ ...m, wires: [...m.wires, { id: `w-${uid()}`, a: draw.a, b: ref, mid: draw.pts }] }));
        track({ kind: "wire.add", block: blockId, from: `${draw.a.sym}.${draw.a.pin}`, to: `${sym}.${pin}` });
      }
      setDraw(null);
    }
  };
  const onBgDown = (e: RPE<SVGRectElement>) => {
    if (draw || e.button !== 0) return; // primary button only; middle-button bubbles up to pan
    band.current = { start: localPt(e), active: false, shift: e.shiftKey };
  };
  const onBg = (e: RME) => {
    if (!draw) return;
    const ws = wireSnap(localPt(e));
    if (ws.pin && !(draw.a.sym === ws.pin.sym && draw.a.pin === ws.pin.pin)) {
      // clicked near a pin → finish the wire on it (no need to hit the dot exactly)
      const pin = ws.pin;
      setModel((m) => ({ ...m, wires: [...m.wires, { id: `w-${uid()}`, a: draw.a, b: pin, mid: draw.pts }] }));
      track({ kind: "wire.add", block: blockId, from: `${draw.a.sym}.${draw.a.pin}`, to: `${pin.sym}.${pin.pin}` });
      setDraw(null);
    } else if (ws.tap) {
      // tap onto an existing wire → finish with a junction BOUND to it (joins their nets, follows it when it moves)
      const tap = ws.tap;
      setModel((m) => ({ ...m, wires: [...m.wires, { id: `w-${uid()}`, a: draw.a, b: tap, mid: draw.pts }] }));
      track({ kind: "wire.add", block: blockId, from: `${draw.a.sym}.${draw.a.pin}`, to: `tap:${tap.wire}` });
      setDraw(null);
    } else {
      setDraw((d) => (d ? { ...d, pts: [...d.pts, { x: ws.x, y: ws.y }] } : d)); // empty space → add a bend
    }
  };

  const canUndo = hidx.current > 0;
  const canRedo = hidx.current < hist.current.length - 1;
  const selSymIdsArr = selSymIds();
  const selSym = sel.size === 1 && selSymIdsArr.length === 1 ? model.syms.find((s) => s.id === selSymIdsArr[0]) : undefined;
  // Break-into-discrete: if the selected symbol is a SUPPORTED IC (its part has a discrete equivalent in
  // the standard library), offer to view it as discrete components. Map symbol → part id via the block's
  // schematic (ref→part), falling back to a chip's mpn. Only supported parts can be reduced.
  const selPartId = selSym ? (block?.schematic?.parts?.find((p) => p.ref === selSym.ref)?.part ?? selSym.chip?.mpn) : undefined;
  const discreteEq = discreteEquivalentFor(selPartId);
  const [showDiscrete, setShowDiscrete] = useState(false);
  const updateSel = (patch: Partial<Sym>) => setModel((m) => ({ ...m, syms: m.syms.map((s) => (s.id === selSym?.id ? { ...s, ...patch } : s)) }));
  const updateChip = (patch: Partial<ChipSpec>) => {
    if (patch.mpn != null && selSym) track({ kind: "mpn.enter", block: blockId, sym: selSym.id, mpn: patch.mpn });
    setModel((m) => ({ ...m, syms: m.syms.map((s) => (s.id === selSym?.id && s.chip ? { ...s, chip: { ...s.chip, ...patch } } : s)) }));
  };
  const setPinName = (pinId: string, name: string) => {
    if (selSym) track({ kind: "pin.name", block: blockId, sym: selSym.id, pin: pinId, name });
    setModel((m) => ({ ...m, syms: m.syms.map((s) => (s.id === selSym?.id && s.chip ? { ...s, chip: { ...s.chip, names: { ...s.chip.names, [pinId]: name } } } : s)) }));
  };

  // Expose a chip pin as a block terminal (hierarchical port): add the terminal to the block + drop a
  // port wired straight to that pin, so it's actually connected internally. Expose only as needed.
  const POWER_RE = /^(vdd|vcc|vbat|vin|vsys|avdd|avcc|vref|vddio|[+]?\d*v\d*|3v3|5v|1v8)$/i;
  const GND_RE = /^(gnd|vss|avss|agnd|dgnd|v-|0v|gnd\d+)$/i;
  const roleType = (name: string): { role: "in" | "out"; type: NetType } => {
    const isGnd = GND_RE.test(name), isPwr = POWER_RE.test(name);
    return { role: isGnd || isPwr ? "in" : "out", type: isGnd ? "gnd" : isPwr ? "power" : "signal" };
  };
  // the live persisted block — the drilled-in `block` prop can go stale after a save (it's React-Flow
  // node data), so terminal mutations base off this to avoid clobbering earlier exposes.
  const liveBlock = (): Block | undefined => (block ? getUserBlocks()[`${block.id}@${block.version}`] ?? block : undefined);
  const exposedTermIds = useMemo(() => new Set((liveBlock()?.terminals ?? []).map((t) => t.id)), [block, model]); // eslint-disable-line react-hooks/exhaustive-deps
  const isExposed = (name: string) => exposedTermIds.has(name);
  const exposePins = (sym: Sym, pinIds: string[]) => {
    const b = liveBlock();
    if (!b || !isUserBlock(b.id)) return;
    const have = new Set(b.terminals.map((t) => t.id));
    const adds: { pinId: string; name: string }[] = [];
    for (const pinId of pinIds) {
      const name = (sym.chip?.names?.[pinId] || "").trim();
      if (name && !have.has(name) && !adds.some((a) => a.name === name)) adds.push({ pinId, name });
    }
    if (!adds.length) return;
    saveUserBlock({ ...b, terminals: [...b.terminals, ...adds.map((a) => ({ id: a.name, ...roleType(a.name) }))] });
    window.dispatchEvent(new CustomEvent("electrace:userblocks"));
    setModel((m) => {
      const d = symDims(sym);
      const newSyms: Sym[] = [], newWires: Wire[] = [];
      adds.forEach(({ pinId, name }, k) => {
        if (m.syms.some((s) => s.type === "port" && s.ref === name)) return;
        const pin = d?.pins.find((p) => p.id === pinId);
        const ap = pin && d ? symPoint(sym, pin.x, pin.y, d.w, d.h) : { x: sym.x, y: sym.y + k * 20 };
        const portId = `port-${name}-${uid()}-${k}`;
        newSyms.push({ id: portId, type: "port", ref: name, x: snap(ap.x - 70), y: snap(ap.y - 10) });
        newWires.push({ id: `w-${uid()}-${k}`, a: { sym: portId, pin: "1" }, b: { sym: sym.id, pin: pinId }, mid: [] });
      });
      return { ...m, syms: [...m.syms, ...newSyms], wires: [...m.wires, ...newWires] };
    });
  };
  const unexposePin = (name: string) => {
    const b = liveBlock();
    if (!b || !isUserBlock(b.id)) return;
    saveUserBlock({ ...b, terminals: b.terminals.filter((t) => t.id !== name) });
    window.dispatchEvent(new CustomEvent("electrace:userblocks"));
    setModel((m) => {
      const port = m.syms.find((s) => s.type === "port" && s.ref === name);
      if (!port) return m;
      return { ...m, syms: m.syms.filter((s) => s.id !== port.id), wires: m.wires.filter((w) => !((isPin(w.a) && w.a.sym === port.id) || (isPin(w.b) && w.b.sym === port.id))) };
    });
  };

  const vw = size.w / zoom, vh = size.h / zoom;
  const hs = 5 / zoom; // half-size of waypoint handles (constant screen size)

  // All net/geometry derivation is memoized on [model, terminals] — it runs deriveSchematicNets and
  // O(n²) crossing detection, so keeping it out of cursor/hover/pan re-renders is the big win here.
  const derived = useMemo(() => {
    // junction taps: a free wire-end that lands on another wire's mid-span joins their nets (wire-to-wire)
    const tapped = new Set<string>();
    const tapDots: Pt[] = [];
    const tapConns: { id: string; a: ReturnType<typeof toSchEndpoint>; b: ReturnType<typeof toSchEndpoint> }[] = [];
    for (const w of model.wires) {
      for (const which of ["a", "b"] as const) {
        const end = w[which];
        if (isPin(end)) continue;
        if (isTap(end)) {
          // a BOUND tap: connectivity comes from toSchEndpoint resolving to the host's endpoint —
          // here we only mark the junction dot at its current (host-tracked) position
          const P = endAbs(model.syms, end, model.wires);
          if (P) { tapped.add(`${w.id}:${which}`); tapDots.push(P); }
          continue;
        }
        const P = endAbs(model.syms, end);
        if (!P || pinAtCoord(model.syms, P.x, P.y)) continue;
        const hitId = wireAtPoint(model.syms, model.wires, P, w.id);
        if (!hitId) continue;
        const v = model.wires.find((x) => x.id === hitId)!;
        const key = `${w.id}:${which}`;
        tapped.add(key);
        tapConns.push({ id: `tap:${key}`, a: toSchEndpoint(model.syms, end, key), b: toSchEndpoint(model.syms, v.a, `${v.id}:a`) });
        tapDots.push(P);
      }
    }

    // junction dots: coordinates where 2+ wire ends meet (a shared pin) → electrically joined
    const endCount = new Map<string, Pt & { n: number }>();
    for (const w of model.wires) {
      for (const e of [w.a, w.b]) {
        const p = endAbs(model.syms, e, model.wires);
        if (!p) continue;
        const k = `${p.x},${p.y}`;
        const c = endCount.get(k) ?? { x: p.x, y: p.y, n: 0 };
        c.n++; endCount.set(k, c);
      }
    }
    const junctions = [...endCount.values()].filter((c) => c.n >= 2).concat(tapDots.map((p) => ({ x: p.x, y: p.y, n: 3 })));

    // crossings: where two different wires' segments cross at an interior point (not a junction)
    const segs = model.wires.flatMap((w) => {
      const a = endAbs(model.syms, w.a, model.wires), b = endAbs(model.syms, w.b, model.wires);
      return a && b ? segmentsOf([a, ...w.mid, b]).map((s) => ({ ...s, wid: w.id })) : [];
    });
    const cross = new Map<string, Pt & { over: string }>();
    for (const s1 of segs) for (const s2 of segs) {
      if (s1.wid === s2.wid || s1.h === s2.h) continue;
      const Hs = s1.h ? s1 : s2, Vs = s1.h ? s2 : s1; // horizontal wire jumps over the vertical
      const x = Vs.x1, y = Hs.y1;
      if (x > Math.min(Hs.x1, Hs.x2) && x < Math.max(Hs.x1, Hs.x2) && y > Math.min(Vs.y1, Vs.y2) && y < Math.max(Vs.y1, Vs.y2))
        cross.set(`${x},${y}`, { x, y, over: Hs.wid });
    }
    const crossings = [...cross.values()].filter((c) => !endCount.has(`${c.x},${c.y}`));

    // electrical nets derived from the wires (see core/schematic-nets.ts)
    const conns = model.wires.map((w) => ({
      id: w.id,
      a: toSchEndpoint(model.syms, w.a, `${w.id}:a`, model.wires),
      b: toSchEndpoint(model.syms, w.b, `${w.id}:b`, model.wires),
    }));
    const twoPin = model.syms.filter((s) => symDims(s)?.pins.length === 2).map((s) => s.id);
    // name taps: net labels / power flags / ports / grounds that share a name are one net even with no
    // wire between them (KiCad power-flag semantics) — link their pins so colouring reflects the merge.
    // Mirrors deriveBlockSchematic's marker naming so the live picture matches the analysed netlist.
    const nameOf = (s: Sym): string | null =>
      s.type === "port" ? (s.ref ?? null)
        : s.type === "ground" ? "GND"
        : s.type === "vcc" ? (s.ref || "VCC")
        : s.type === "netlabel" ? (s.ref || "NET")
        : s.type === "offboard" ? (s.ref || "EXT")
        : null;
    const byName = new Map<string, string[]>();
    for (const s of model.syms) { const nm = nameOf(s); if (nm) (byName.get(nm) ?? byName.set(nm, []).get(nm)!).push(s.id); }
    const nameConns = [...byName.values()].flatMap((ids) =>
      ids.slice(1).map((id, i) => ({ id: `name:${ids[0]}:${id}:${i}`, a: { kind: "pin" as const, sym: ids[0], pin: "1" }, b: { kind: "pin" as const, sym: id, pin: "1" } })));
    const nets = deriveSchematicNets([...conns, ...tapConns, ...nameConns], twoPin);
    const wireState = (w: Wire): WireState => {
      const ea = toSchEndpoint(model.syms, w.a, `${w.id}:a`), eb = toSchEndpoint(model.syms, w.b, `${w.id}:b`);
      if (ea.kind === "broken" || eb.kind === "broken") return "error";
      // a free end that taps another wire is connected, not floating
      if ((ea.kind === "free" && !tapped.has(`${w.id}:a`)) || (eb.kind === "free" && !tapped.has(`${w.id}:b`))) return "floating";
      const nid = nets.netOfConn.get(w.id);
      if (nid != null && nets.nets[nid].shorts.length) return "error";
      return "ok";
    };
    const wireColor = (id: string) => WIRE_COLOR[wireState(model.wires.find((w) => w.id === id)!)];

    // live design checks
    const openPinList = model.syms.filter((s) => s.type !== "port" && s.type !== "offboard")
      .flatMap((s) => (symDims(s)?.pins ?? []).map((p) => ({ sym: s.id, pin: p.id, ref: s.ref })))
      .filter((k) => !nets.connectedPins.has(`${k.sym}.${k.pin}`));
    const shortCount = nets.nets.reduce((n, net) => n + net.shorts.length, 0);
    const realNets = nets.nets.filter((n) => n.pins.length >= 2).length;

    // terminal mapping: a port symbol's ref names a declared terminal; its net exposes it.
    const ports = model.syms.filter((s) => s.type === "port");
    const portPinKeys = new Set(ports.map((p) => `${p.id}.1`));
    const pinNet = new Map<string, number>();
    nets.nets.forEach((n) => n.pins.forEach((p) => pinNet.set(p, n.id)));
    const termStatus = terminals.map((t) => {
      const port = ports.find((p) => p.ref === t.id);
      const nid = port ? pinNet.get(`${port.id}.1`) : undefined;
      const connected = nid != null && nets.nets[nid].pins.some((p) => !portPinKeys.has(p));
      return { t, portId: port?.id, connected };
    });
    const unwiredTerms = termStatus.filter((s) => !s.connected).length;
    const termOf = (symId: string) => terminals.find((t) => t.id === ports.find((p) => p.id === symId)?.ref);
    const portConnected = (symId: string) => termStatus.find((s) => s.portId === symId)?.connected ?? false;

    // a net's display name: the terminal it reaches (a port's ref), else an off-board marker's ref
    const offboards = model.syms.filter((s) => s.type === "offboard");
    const offPinName = new Map(offboards.map((o) => [`${o.id}.1`, o.ref ?? "EXT"]));
    const netLabel = new Map<number, string>();
    nets.nets.forEach((n) => {
      const pp = n.pins.find((p) => portPinKeys.has(p));
      if (pp) { const ref = ports.find((q) => q.id === pp.slice(0, pp.lastIndexOf(".")))?.ref; if (ref) { netLabel.set(n.id, ref); return; } }
      const op = n.pins.find((p) => offPinName.has(p)); // off-board nets named by their connector
      if (op) netLabel.set(n.id, offPinName.get(op)!);
    });

    // which declared terminals reach an off-board marker → externally supplied. Persisted onto the
    // block definition so the design-level analyzer treats them as driven, not floating.
    const externalTerms = new Set<string>();
    terminals.forEach((t) => {
      const port = ports.find((p) => p.ref === t.id);
      const nid = port ? pinNet.get(`${port.id}.1`) : undefined;
      if (nid != null && nets.nets[nid].pins.some((p) => offPinName.has(p))) externalTerms.add(t.id);
    });

    // problems — each carries a locate target (click to select + pan)
    const problems: Problem[] = [];
    nets.nets.forEach((n) => n.shorts.forEach((symId) => {
      const ref = model.syms.find((s) => s.id === symId)?.ref ?? symId;
      problems.push({ sev: "error", msg: `${ref}: both pins are on the same net (short across the part)`, target: { kind: "sym", id: symId } });
    }));
    conns.forEach((c) => {
      // a free end that taps another wire is connected, not floating (matches wireState)
      const aFree = c.a.kind === "free" && !tapped.has(`${c.id}:a`), bFree = c.b.kind === "free" && !tapped.has(`${c.id}:b`);
      if (c.a.kind === "broken" || c.b.kind === "broken") problems.push({ sev: "error", msg: "Wire references a deleted pin", target: { kind: "wire", id: c.id } });
      else if (aFree || bFree) problems.push({ sev: "warn", msg: "Wire has a floating end", target: { kind: "wire", id: c.id } });
    });
    termStatus.forEach(({ t, connected, portId }) => { if (!connected) problems.push({ sev: "warn", msg: `Terminal "${t.id}" isn't wired into the circuit`, target: portId ? { kind: "sym", id: portId } : undefined }); });
    openPinList.forEach((k) => problems.push({ sev: "info", msg: `${k.ref ?? k.sym}.${k.pin} is unconnected`, target: { kind: "sym", id: k.sym } }));

    // circuit insights (parallel/series R & C, voltage dividers) — shared, tested core analysis
    const insightComps: InsightComponent[] = model.syms
      .filter((s) => symDims(s)?.pins.length === 2 && s.ref)
      .map((s) => ({
        ref: s.ref!, type: s.type, value: s.value,
        pins: Object.fromEntries((symDims(s)?.pins ?? [])
          .map((p) => [p.id, pinNet.get(`${s.id}.${p.id}`)])
          .filter(([, n]) => n != null)) as Record<string, number>,
      }))
      .filter((c) => Object.keys(c.pins).length === 2);
    const symByRef = new Map(model.syms.filter((s) => s.ref).map((s) => [s.ref!, s.id]));
    schematicInsights(insightComps).forEach((ins) => {
      problems.push({ sev: "info", msg: ins.text, target: { kind: "sym", id: symByRef.get(ins.refs[0]) ?? ins.refs[0] } });
    });

    const probCount = {
      error: problems.filter((p) => p.sev === "error").length,
      warn: problems.filter((p) => p.sev === "warn").length,
      info: problems.filter((p) => p.sev === "info").length,
    };

    return { junctions, crossings, nets, pinNet, wireState, wireColor, openPinList, shortCount, realNets, termStatus, unwiredTerms, termOf, portConnected, netLabel, externalTerms, problems, probCount };
  }, [model, terminals]);
  const { junctions, crossings, nets, pinNet, wireState, wireColor, shortCount, realNets, termStatus, unwiredTerms, termOf, portConnected, netLabel, externalTerms, problems, probCount } = derived;

  // collision-avoided ref/value placement (memoized with the rest of the geometry — it scans
  // every symbol box and wire segment, so keep it off the cursor/pan path)
  const labels = useMemo(() => placeLabels(model, symStyle), [model, symStyle]);

  // Propagate off-board terminals onto the block definition (user blocks only), so the design-level
  // analyzer knows can_power & friends are externally driven. Guarded to avoid a save→reload loop.
  const extKey = [...externalTerms].sort().join("|");
  useEffect(() => {
    if (!block || !isUserBlock(block.id)) return;
    const cur = block.terminals.filter((t) => t.external).map((t) => t.id).sort().join("|");
    if (cur === extKey) return;
    const next = externalTerms;
    saveUserBlock({ ...block, terminals: block.terminals.map((t) => ({ ...t, external: next.has(t.id) || undefined })) });
    window.dispatchEvent(new CustomEvent("electrace:userblocks"));
  }, [extKey, block]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Symbols</h3>
          <SymbolStyleToggle />
        </div>
        {SYMBOL_GROUPS.map((grp) => (
          <div key={grp.name} className="mb-3">
            <h4 className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-border-strong)]">{grp.name}</h4>
            <div className="grid grid-cols-4 gap-1.5">
              {grp.types.map((type) => {
                const s = SYMBOLS[type];
                if (!s) return null;
                return (
                  <button key={type} title={`${s.label} — drag onto the canvas or click to add`} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/symbol", type); e.dataTransfer.effectAllowed = "copy"; }}
                    onClick={() => addSym(type)}
                    className="group flex cursor-grab flex-col items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 hover:border-[#4c8dff] active:cursor-grabbing">
                    <svg viewBox={`-6 -6 ${s.w + 12} ${s.h + 12}`} preserveAspectRatio="xMidYMid meet" width="100%" height="30" style={{ display: "block", pointerEvents: "none", color: "var(--color-text)" }}>{s.draw(symStyle)}</svg>
                    <span className="w-full truncate text-center text-[8px] leading-tight text-[var(--color-faint)] group-hover:text-[var(--color-text)]">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-[var(--color-faint)]">Drag a symbol onto the canvas (or click to drop it center) · click a pin then another to wire (Enter ends in free space, Esc cancels) · drag a wire to bend it, corner handles reshape · drag empty space to box-select, Shift-click to add/remove · R rotates, Ctrl+D duplicates, arrows nudge · pinch to zoom, two-finger to pan · Delete removes.</p>
      </aside>

      <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-[var(--color-bg)]" onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          <button onClick={() => rotateSel(90)} disabled={selSymIdsArr.length === 0} title="Rotate (R · Shift+R reverses)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[14px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">⟳</button>
          <button onClick={() => { if (size.w) { const f = computeFit(model, size); setZoom(f.zoom); setPan(f.pan); } }} title="Fit to view"
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] text-[var(--color-text)] hover:border-[#4c8dff]">⤢</button>
          <button onClick={() => setModel((m) => ({ ...m, syms: m.syms.map((s) => { const o = anchorOrigin(s, s.x, s.y, GRID); return { ...s, x: o.x, y: o.y }; }) }))}
            title="Align — snap every part so its pins land on the grid (fixes wires not meeting pins)"
            className="grid h-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text)] hover:border-[#4c8dff]">Align</button>
          <button onClick={resetBlock} title="Revert to the authored schematic (discard your edits)"
            className="grid h-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text)] hover:border-[#4c8dff]">Reset</button>
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">↶</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">↷</button>
        </div>
        {draw && <div className="absolute left-3 top-3 z-10 rounded-md border border-[#4c8dff80] bg-[#4c8dff26] px-3 py-1.5 text-[11px] text-[var(--color-link)]">Wiring — click a pin to finish · click empty to bend · Esc to cancel</div>}
        {!draw && hoverNet != null && nets.nets[hoverNet] && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[#454e62ee] px-3 py-1.5 text-[11px] backdrop-blur">
            <span className="font-mono font-semibold text-[var(--color-link)]">{netLabel.get(hoverNet) ?? `net ${hoverNet + 1}`}</span>
            <span className="text-[var(--color-faint)]">{nets.nets[hoverNet].pins.length} pins</span>
            {nets.nets[hoverNet].shorts.length > 0 && <span className="text-[#ef5d6b]">short</span>}
          </div>
        )}

        <svg ref={svgRef} width="100%" height="100%" viewBox={`${pan.x} ${pan.y} ${vw} ${vh}`}
          onPointerDown={onSvgDown} onPointerMove={onMove} onPointerUp={onUp}
          onAuxClick={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
          style={{ display: "block", touchAction: "none", cursor: draw ? "crosshair" : "default", color: "var(--color-text)" }}>
          <defs>
            <pattern id="bsgrid" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" fill="#56617d" />
            </pattern>
          </defs>
          <rect x={pan.x} y={pan.y} width={vw} height={vh} fill="url(#bsgrid)" onPointerDown={onBgDown} onClick={onBg} />

          {model.wires.map((w) => {
            const a = endAbs(model.syms, w.a, model.wires), b = endAbs(model.syms, w.b, model.wires);
            if (!a || !b) return null;
            const selected = isSelWire(w.id);
            const color = WIRE_COLOR[wireState(w)];
            const onNet = hoverNet != null && nets.netOfConn.get(w.id) === hoverNet;
            const d = ortho([a, ...w.mid, b]);
            return (
              <g key={w.id}>
                {onNet && <path d={d} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={9 / zoom} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
                <path d={d} fill="none" stroke={color} strokeWidth={selected ? 3.5 : 2} pointerEvents="none" />
                <path d={d} fill="none" stroke="transparent" strokeWidth={18 / zoom} strokeLinecap="round" strokeLinejoin="round"
                  onPointerDown={(e) => onWireDown(e, w)}
                  onClick={(e) => { e.stopPropagation(); if (e.shiftKey) setSel((prev) => toggle(prev, wireKey(w.id))); else setSel(new Set([wireKey(w.id)])); }}
                  onPointerEnter={() => { const n = nets.netOfConn.get(w.id); if (n != null) setHoverNet(n); }}
                  onPointerLeave={() => setHoverNet(null)}
                  style={{ cursor: draw ? "crosshair" : "move" }} />
                {selected && w.mid.map((pt, i) => (
                  <rect key={i} x={pt.x - hs} y={pt.y - hs} width={hs * 2} height={hs * 2} stroke="#4c8dff" strokeWidth={1.5 / zoom}
                    onPointerDown={(e) => onWaypointDown(e, w, i)}
                    onDoubleClick={(e) => { e.stopPropagation(); setModel((m) => ({ ...m, wires: m.wires.map((x) => (x.id === w.id ? { ...x, mid: x.mid.filter((_, j) => j !== i) } : x)) })); }}
                    style={{ cursor: "move", fill: "var(--color-surface)" }} />
                ))}
              </g>
            );
          })}

          {/* crossing hops: erase both wires locally, then redraw the over-wire so it reads as passing over */}
          {crossings.map((c, i) => (
            <g key={`x${i}`} pointerEvents="none">
              <circle cx={c.x} cy={c.y} r={6} fill="#3c4658" />
              <line x1={c.x - 6} y1={c.y} x2={c.x + 6} y2={c.y} stroke={wireColor(c.over)} strokeWidth={2} />
            </g>
          ))}

          {draw && (() => {
            const a = pinAbs(model.syms, draw.a);
            if (!a) return null;
            return (
              <g pointerEvents="none">
                <path d={ortho([a, ...draw.pts, cursor])} fill="none" stroke="#f7b13c" strokeWidth={2} strokeDasharray="5 4" />
                <circle cx={cursor.x} cy={cursor.y} r={3.5} fill="#f7b13c" /> {/* where the wire will land */}
              </g>
            );
          })()}

          {model.syms.map((s) => {
            const d = symDims(s);
            if (!d) return null;
            const selected = isSelSym(s.id);
            const isPort = s.type === "port";
            const labelFill = isPort ? (NET_COLOR[termOf(s.id)?.type ?? ""] ?? "#4c8dff") : "currentColor";
            const rot = normRot(s.rot ?? 0);
            const bb = symBounds(s, d.w, d.h); // for upright label placement
            const glyph = s.chip ? renderChip(d, s.chip) : SYMBOLS[s.type]?.draw(symStyle);
            return (
              <g key={s.id}>
                {/* glyph, selection box and pins rotate together about the symbol centre */}
                <g transform={`translate(${s.x},${s.y}) rotate(${rot} ${d.w / 2} ${d.h / 2})`}>
                  <g onPointerDown={(e) => onSymDown(e, s)} style={{ cursor: "move" }}>
                    <rect x={-4} y={-4} width={d.w + 8} height={d.h + 8} fill="transparent" />
                    {/* opaque body: a wire passing beneath is MASKED, not visible through the glyph
                        — a line through a part otherwise reads as a connection that doesn't exist.
                        Chips mask their true body; others a box inset enough to keep pin stubs clear. */}
                    {d.body
                      ? <rect x={d.body.x} y={d.body.y} width={d.body.w} height={d.body.h} fill="var(--color-bg)" />
                      : d.w > 14 && d.h > 14 && <rect x={5} y={5} width={d.w - 10} height={d.h - 10} fill="var(--color-bg)" />}
                    {glyph}
                  </g>
                  {selected && <rect x={-5} y={-5} width={d.w + 10} height={d.h + 10} fill="none" stroke="#4c8dff" strokeDasharray="4 3" rx="4" />}
                  {d.pins.map((p) => {
                    const open = !nets.connectedPins.has(`${s.id}.${p.id}`);
                    return (
                      <g key={p.id}>
                        {/* KiCad-style square pin endpoint: hollow square = unconnected (needs wiring),
                            small filled square = connected. */}
                        {open
                          ? <rect x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} fill="none" stroke="#f7b13c" strokeWidth="1.4" pointerEvents="none" />
                          : <rect x={p.x - 2.5} y={p.y - 2.5} width={5} height={5} fill="#4c8dff" pointerEvents="none" />}
                        {/* generous invisible hit target so grabbing a pin isn't pixel-precise */}
                        <circle cx={p.x} cy={p.y} r={9} fill="transparent"
                          onClick={(e) => onPin(e, s.id, p.id)}
                          onPointerEnter={() => { const n = pinNet.get(`${s.id}.${p.id}`); if (n != null) setHoverNet(n); }}
                          onPointerLeave={() => setHoverNet(null)}
                          style={{ cursor: "crosshair" }} />
                      </g>
                    );
                  })}
                </g>
                {/* ref/value labels render in a dedicated layer below — collision-avoided, wrapped,
                    with leader lines when pushed away (see placeLabels in schematic-model) */}
                {/* every pin gets an upright indicator (its function name, else its number),
                    nudged INWARD off the pin's edge so rows of chip pins stay aligned */}
                {!isPort && d.pins.map((p) => {
                  const inset = 11;
                  let lx = p.x, ly = p.y;
                  if (p.x <= 1) lx += inset;                 // left edge  → push right
                  else if (p.x >= d.w - 1) lx -= inset;      // right edge → push left
                  else if (p.y <= 1) ly += inset;            // top edge   → push down
                  else if (p.y >= d.h - 1) ly -= inset;      // bottom edge→ push up
                  else { const len = Math.hypot(d.w / 2 - p.x, d.h / 2 - p.y) || 1; lx += ((d.w / 2 - p.x) / len) * inset; ly += ((d.h / 2 - p.y) / len) * inset; }
                  const a = symPoint(s, lx, ly, d.w, d.h);
                  return <text key={p.id} x={a.x} y={a.y + 3} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fontWeight={600} fill="#dbe4f4" stroke="#2b3344" strokeWidth={0.6} paintOrder="stroke" style={{ paintOrder: "stroke" }} pointerEvents="none">{p.label ?? p.id}</text>;
                })}
              </g>
            );
          })}

          {/* junction dots: solid node wherever 2+ wires share a point (electrically joined) */}
          {junctions.map((j, i) => (
            <circle key={`j${i}`} cx={j.x} cy={j.y} r={4.5} fill="#4c8dff" pointerEvents="none" />
          ))}

          {/* ref/value labels — collision-avoided against symbols, wires, and each other; wrapped
              past the width budget; leader-lined back to their part when pushed away */}
          {labels.map((L, i) => {
            const lineH = L.fontSize + 2.5;
            const fill = L.port
              ? (NET_COLOR[termOf(L.sym)?.type ?? ""] ?? "#4c8dff")
              : L.inside ? "var(--color-text)" : "currentColor";
            return (
              <g key={`lbl${i}`} pointerEvents="none">
                {L.leader && (
                  <line x1={L.leader.x1} y1={L.leader.y1} x2={L.leader.x2} y2={L.leader.y2}
                    stroke="var(--color-faint)" strokeWidth={1} strokeDasharray="2 3" opacity={0.55} />
                )}
                <text x={L.x} y={L.y - ((L.lines.length - 1) * lineH) / 2} textAnchor="middle" dominantBaseline="middle"
                  fontFamily="var(--font-mono)" fontSize={L.fontSize} fontWeight={L.port ? 700 : 400} fill={fill}>
                  {L.lines.map((ln, k) => <tspan key={k} x={L.x} dy={k ? lineH : 0}>{ln}</tspan>)}
                </text>
              </g>
            );
          })}

          {/* top wire-hit overlay: symbols paint after wires, so their generous hitboxes used to
              eat clicks on a wire squeezed between two close parts. This thin invisible stroke
              rides ABOVE the symbols along the exact wire path — a click on the line always
              reaches the line. Clicks landing near a PIN are forwarded to the pin (so wiring
              from a pin keeps working even where a wire passes right through it). */}
          {model.wires.map((w) => {
            const a = endAbs(model.syms, w.a, model.wires), b = endAbs(model.syms, w.b, model.wires);
            if (!a || !b) return null;
            const pinNear = (e: { clientX: number; clientY: number }) => {
              const p = localPt(e);
              return nearestPin(modelRef.current.syms, p.x, p.y, 11 / zoomRef.current);
            };
            return (
              <path key={`whit-${w.id}`} d={ortho([a, ...w.mid, b])} fill="none" stroke="transparent"
                strokeWidth={Math.max(6, 8 / zoom)} strokeLinecap="round" strokeLinejoin="round"
                onPointerDown={(e) => { if (!pinNear(e)) onWireDown(e, w); }}
                onClick={(e) => {
                  const hit = pinNear(e);
                  if (hit) { onPin(e, hit.sym, hit.pin); return; }
                  e.stopPropagation();
                  if (e.shiftKey) setSel((prev) => toggle(prev, wireKey(w.id)));
                  else setSel(new Set([wireKey(w.id)]));
                }}
                onPointerEnter={() => { const n = nets.netOfConn.get(w.id); if (n != null) setHoverNet(n); }}
                onPointerLeave={() => setHoverNet(null)}
                style={{ cursor: draw ? "crosshair" : "move" }} />
            );
          })}

          {bandRect && (
            <rect x={bandRect.x} y={bandRect.y} width={bandRect.w} height={bandRect.h}
              fill="#4c8dff22" stroke="#4c8dff" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`} pointerEvents="none" />
          )}

          {/* locate flash — a pulsing highlight on the thing a Problem points to, coloured by severity
              (error = red, warning = amber, info = blue) so the located part reads as the issue */}
          {flash?.kind === "sym" && (() => {
            const s = model.syms.find((x) => x.id === flash.id), d = s && symDims(s); if (!s || !d) return null;
            const bb = symBounds(s, d.w, d.h);
            const [fill, edge] = FLASH_COLOR[flash.sev];
            return (
              <rect key={flash.n} x={bb.minX - 8} y={bb.minY - 8} width={bb.maxX - bb.minX + 16} height={bb.maxY - bb.minY + 16} rx="6"
                fill={fill} stroke={edge} strokeWidth={3} pointerEvents="none">
                <animate attributeName="fill-opacity" values="0.45;0.12;0" dur="1.5s" fill="freeze" />
                <animate attributeName="stroke-opacity" values="1;1;0" dur="1.5s" fill="freeze" />
                <animate attributeName="stroke-width" values="3;9;3;9;3" dur="1.5s" fill="freeze" />
              </rect>
            );
          })()}
          {flash?.kind === "wire" && (() => {
            const w = model.wires.find((x) => x.id === flash.id), a = w && endAbs(model.syms, w.a, model.wires), b = w && endAbs(model.syms, w.b, model.wires);
            if (!a || !b) return null;
            return (
              <path key={flash.n} d={ortho([a, ...w!.mid, b])} fill="none" stroke={FLASH_COLOR[flash.sev][1]} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
                <animate attributeName="stroke-opacity" values="0.95;0.95;0" dur="1.5s" fill="freeze" />
                <animate attributeName="stroke-width" values="8;16;8;16;8" dur="1.5s" fill="freeze" />
              </path>
            );
          })()}
        </svg>
        <AssistantBubble />
      </div>

        {/* RIGHT — inspector */}
        <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Inspector</div>
          <div className="flex-1 overflow-y-auto p-3">
            {block && (
              <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#4c8dff55] bg-[#4c8dff26] text-[#4c8dff]">{block.glyph ?? "▦"}</span>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-[var(--color-text)]">{block.name}</div>
                    <div className="font-mono text-[9px] text-[var(--color-faint)]">{block.topology ?? block.category ?? "block"}</div>
                  </div>
                </div>
                {block.spec && Object.keys(block.spec).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(block.spec).map(([k, v]) => (
                      <span key={k} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--color-text)]">{k} {fmtSpecVal(v)}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!(sel.size > 1 || selSym) && <p className="text-[11px] text-[var(--color-border-strong)]">Select a symbol or wire to inspect it.</p>}
            {selSym && discreteEq && (
              <div className="rounded-lg border border-[#8b6cff]/30 bg-[#8b6cff]/[0.06] p-2.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#a98bff]">Supported IC</h3>
                <p className="mt-1 text-[11px] leading-snug text-[var(--color-dim)]">{selSym.ref} can be shown as discrete components — a {discreteEq.name.replace(/^.*— /, "").toLowerCase()}.</p>
                <button onClick={() => setShowDiscrete(true)}
                  className="mt-2 w-full rounded-md border border-[#8b6cff]/50 bg-[#8b6cff]/15 py-1.5 text-[11px] font-semibold text-[#a98bff] transition hover:bg-[#8b6cff]/25">◆ Break into discrete</button>
              </div>
            )}
            {sel.size > 1 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">{sel.size} selected</h3>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button onClick={() => rotateSel(90)} disabled={!selSymIdsArr.length}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1 text-[11px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">Rotate</button>
                  <button onClick={duplicateSel} disabled={!selSymIdsArr.length}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1 text-[11px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">Dup</button>
                  <button onClick={del}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1 text-[11px] text-[#ef5d6b] hover:border-[#ef5d6b]">Delete</button>
                </div>
              </div>
            )}
            {selSym && selSym.type === "port" && (() => {
              const t = termOf(selSym.id);
              return (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Terminal</h3>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
                    <span style={{ color: NET_COLOR[t?.type ?? ""] ?? "#4c8dff" }}>●</span>
                    <span className="font-mono text-[var(--color-text)]">{selSym.ref}</span>
                    <span className="ml-auto text-[9px] uppercase text-[var(--color-faint)]">{t?.role} · {t?.type}</span>
                  </div>
                  <p className={`mt-2 text-[11px] ${portConnected(selSym.id) ? "text-[#46dca6]" : "text-[#f7b13c]"}`}>
                    {portConnected(selSym.id) ? "✓ wired into the circuit" : "⚠ not wired — connect it to a pin"}
                  </p>
                </div>
              );
            })()}
            {selSym && selSym.chip && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Chip</h3>
                <label className="mt-2 block text-[11px] text-[var(--color-text)]">Ref
                  <input value={selSym.ref ?? ""} onChange={(e) => updateSel({ ref: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[12px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]" /></label>
                <label className="mt-2 block text-[11px] text-[var(--color-text)]">Part number
                  <input value={selSym.chip.mpn ?? ""} placeholder="e.g. MAX232" onChange={(e) => updateChip({ mpn: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-border-strong)] focus:border-[#4c8dff]" /></label>
                <div className="mt-2 flex gap-2">
                  <label className="block flex-1 text-[11px] text-[var(--color-text)]">Package
                    <select value={selSym.chip.profile} onChange={(e) => updateChip({ profile: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[12px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]">
                      {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select></label>
                  <label className="block w-16 text-[11px] text-[var(--color-text)]">Pins
                    <input type="number" min={1} max={256} value={selSym.chip.pins}
                      onChange={(e) => updateChip({ pins: Math.max(1, Math.min(256, Math.floor(Number(e.target.value) || 1))) })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[12px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]" /></label>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-border-strong)]">Pin names</span>
                  <span className="text-[9px] text-[var(--color-border-strong)]">● = terminal</span>
                </div>
                <div className="mt-1 max-h-44 space-y-1 overflow-y-auto pr-0.5">
                  {(symDims(selSym)?.pins ?? []).map((p) => {
                    const nm = (selSym!.chip!.names?.[p.id] ?? "").trim();
                    const exp = !!nm && isExposed(nm);
                    return (
                      <div key={p.id} className="flex items-center gap-1.5">
                        <span className="w-7 shrink-0 text-right font-mono text-[10px] text-[var(--color-faint)]">{p.id}</span>
                        <input value={selSym!.chip!.names?.[p.id] ?? ""} placeholder="—" onChange={(e) => setPinName(p.id, e.target.value)}
                          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-surface-3)] focus:border-[#4c8dff]" />
                        {block && isUserBlock(block.id) && (
                          <button onClick={() => (exp ? unexposePin(nm) : exposePins(selSym!, [p.id]))} disabled={!nm}
                            title={exp ? `Exposed as terminal "${nm}" — click to remove` : "Expose this pin as a block terminal"}
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] ${exp ? "bg-[#4c8dff] text-white" : "text-[var(--color-border-strong)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"} disabled:opacity-30`}>{exp ? "●" : "○"}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {block && isUserBlock(block.id) && (() => {
                  const todo = (symDims(selSym)?.pins ?? []).filter((p) => { const n = (selSym!.chip!.names?.[p.id] ?? "").trim(); return n && !isExposed(n); });
                  return (
                    <button onClick={() => exposePins(selSym!, todo.map((p) => p.id))} disabled={!todo.length}
                      className="mt-2 w-full rounded border border-[#4c8dff66] bg-[#4c8dff26] py-1 text-[11px] text-[var(--color-link)] hover:border-[#4c8dff] disabled:opacity-40">
                      {todo.length ? `Expose all ${todo.length} named pin${todo.length === 1 ? "" : "s"} →` : "All named pins exposed"}
                    </button>
                  );
                })()}
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-border-strong)]">Name pins by function (AI pinout mapping fills these), then click ○ to expose just the ones you need as block terminals — each gets a wired port and the block renders as a QFP chip.</p>
              </div>
            )}
            {selSym && selSym.type !== "port" && !selSym.chip && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">{SYMBOLS[selSym.type]?.label}</h3>
                {(() => { const isNetMarker = selSym.type === "netlabel" || selSym.type === "vcc" || selSym.type === "offboard"; return (
                <label className="mt-2 block text-[11px] text-[var(--color-text)]">{isNetMarker ? "Net name" : "Ref"}
                  <input value={selSym.ref ?? ""} onChange={(e) => updateSel({ ref: e.target.value })}
                    placeholder={isNetMarker ? "+5V, +3V3, GND…" : undefined}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-border-strong)] focus:border-[#4c8dff]" />
                  {selSym.type === "netlabel" && <span className="mt-1 block text-[10px] leading-snug text-[var(--color-border-strong)]">Every net label, port, or power symbol with this same name is one net — no wire needed.</span>}
                </label>
                ); })()}
                <label className="mt-2 block text-[11px] text-[var(--color-text)]">Value
                  <input value={selSym.value ?? ""} onChange={(e) => updateSel({ value: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[12px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]" /></label>
              </div>
            )}
            {terminals.length > 0 && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                <h3 className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
                  Terminals{unwiredTerms > 0 && <span className="ml-1 text-[#f7b13c]">· {unwiredTerms} unwired</span>}
                </h3>
                <div className="space-y-1 px-1">
                  {termStatus.map(({ t, portId, connected }) => (
                    <button key={t.id} onClick={() => portId && setSel(new Set([symKey(portId)]))}
                      className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-[var(--color-surface-2)]">
                      <span style={{ color: NET_COLOR[t.type] ?? "#4c8dff" }}>●</span>
                      <span className="font-mono text-[var(--color-text)]">{t.id}</span>
                      <span className="ml-auto text-[9px] uppercase text-[var(--color-faint)]">{t.role}</span>
                      <span className={connected ? "text-[#46dca6]" : "text-[#f7b13c]"}>{connected ? "✓" : "⚠"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* BOTTOM — problems panel */}
      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-1 px-2">
          <button onClick={() => setBottomOpen((o) => !o)}
            className="flex items-center gap-1.5 border-b-2 border-[#4c8dff] px-3 py-1.5 text-[11px] text-[var(--color-text)]">
            Problems
            {(probCount.error + probCount.warn) > 0 && <span className="rounded-full bg-[var(--color-border)] px-1.5 text-[9px] text-[var(--color-text)]">{probCount.error + probCount.warn}</span>}
          </button>
          <div className="ml-auto flex items-center gap-3 px-2 text-[10px] text-[var(--color-faint)]">
            <span>{realNets} nets</span>
            {shortCount > 0 && <span className="text-[#ef5d6b]">{shortCount} short{shortCount > 1 ? "s" : ""}</span>}
            <button onClick={() => setBottomOpen((o) => !o)} className="text-[var(--color-faint)] hover:text-[var(--color-text)]" title={bottomOpen ? "Collapse" : "Expand"}>{bottomOpen ? "▾" : "▴"}</button>
          </div>
        </div>
        {bottomOpen && (
          <div className="h-44 overflow-y-auto border-t border-[var(--color-border)] bg-[var(--color-bg2)] px-3 py-2 text-[12px]">
            {problems.length === 0 ? (
              <div className="flex items-center gap-2 text-[#46dca6]">✓ No problems — everything checks out.</div>
            ) : (
              <ul className="space-y-0.5">
                {problems.map((p, i) => (
                  <li key={i}>
                    <button onClick={() => locate(p.target, p.sev)} disabled={!p.target}
                      className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left enabled:hover:bg-[var(--color-surface)] disabled:cursor-default">
                      <span style={{ color: p.sev === "error" ? "#ef5d6b" : p.sev === "warn" ? "#f7b13c" : "#9aa3b5" }}>{p.sev === "error" ? "✕" : p.sev === "warn" ? "▲" : "ℹ"}</span>
                      <span className="text-[var(--color-text)]">{p.msg}</span>
                      {p.target && <span className="ml-auto shrink-0 text-[10px] text-[var(--color-border-strong)]">locate ↗</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* break-into-discrete: read-only view of a supported IC as discrete components */}
      {showDiscrete && discreteEq && <DiscreteModal eq={discreteEq} partRef={selSym?.ref} onClose={() => setShowDiscrete(false)} />}
    </div>
  );
}
