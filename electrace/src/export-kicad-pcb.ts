// Export a placed/routed PCB layout as a KiCad board file (`.kicad_pcb`, S-expression, KiCad 7+
// format 20221018). Footprints are emitted inline with their pads (no external library needed), so
// the file opens standalone. Deterministic: same layout → byte-identical output (the only time-like
// field, the timestamp, is passed in). The schematic side has toKicadNetlist; this is its PCB twin.

export interface KicadPad { num: string; net: string; x: number; y: number; w: number; h: number; drill?: number; round?: number }
export interface KicadComp { ref: string; value?: string; footprint: string; x: number; y: number; rot: number; pads: KicadPad[] }
export interface KicadTrace { net: string; layer: string; width: number; path: { x: number; y: number }[] } // layer = KiCad copper layer id, e.g. "F.Cu"
export interface KicadVia { net: string; x: number; y: number; r: number; drill?: number }
export interface KicadBoard { outline: { x: number; y: number }[] } // closed polygon
export interface KicadPcbInput { comps: KicadComp[]; traces: KicadTrace[]; vias: KicadVia[]; board?: KicadBoard; fillet?: number }

interface Pt { x: number; y: number }
type TrackPrim = { kind: "seg"; a: Pt; b: Pt } | { kind: "arc"; a: Pt; mid: Pt; b: Pt };

/** Break a trace polyline into straight segments + circular-arc fillets of radius `r` at each corner.
 *  Mirrors the editor's render geometry; corners turning < `minTurn`° stay sharp. */
function filletTrace(path: Pt[], r: number, minTurn: number): TrackPrim[] {
  const out: TrackPrim[] = [];
  if (path.length < 2) return out;
  if (r <= 0 || path.length === 2) { for (let i = 1; i < path.length; i++) out.push({ kind: "seg", a: path[i - 1], b: path[i] }); return out; }
  let prev = path[0];
  for (let i = 1; i < path.length - 1; i++) {
    const p0 = path[i - 1], p1 = path[i], p2 = path[i + 1];
    const d1x = p0.x - p1.x, d1y = p0.y - p1.y, d2x = p2.x - p1.x, d2y = p2.y - p1.y;
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    if (l1 < 1e-6 || l2 < 1e-6) { out.push({ kind: "seg", a: prev, b: p1 }); prev = p1; continue; }
    const u1x = d1x / l1, u1y = d1y / l1, u2x = d2x / l2, u2y = d2y / l2;
    const alpha = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y)));
    if (180 - (alpha * 180) / Math.PI < minTurn || alpha < 1e-3) { out.push({ kind: "seg", a: prev, b: p1 }); prev = p1; continue; }
    const half = Math.tan(alpha / 2), t = Math.min(r / half, l1 / 2, l2 / 2), reff = t * half;
    const ta = { x: p1.x + u1x * t, y: p1.y + u1y * t }, tb = { x: p1.x + u2x * t, y: p1.y + u2y * t };
    let bx = u1x + u2x, by = u1y + u2y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl; // angle bisector
    const cdist = reff / Math.sin(alpha / 2), cx = p1.x + bx * cdist, cy = p1.y + by * cdist;
    const mcx = (ta.x + tb.x) / 2 - cx, mcy = (ta.y + tb.y) / 2 - cy, ml = Math.hypot(mcx, mcy) || 1;
    const mid = { x: cx + (mcx / ml) * reff, y: cy + (mcy / ml) * reff };
    out.push({ kind: "seg", a: prev, b: ta }, { kind: "arc", a: ta, mid, b: tb });
    prev = tb;
  }
  out.push({ kind: "seg", a: prev, b: path[path.length - 1] });
  return out;
}

const q = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const n = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Math.round(v * 1e6) / 1e6); // tidy float, kill -0

/** Build the net table: net 0 is the unconnected net; every named net gets a stable code ≥ 1. */
function netTable(input: KicadPcbInput): Map<string, number> {
  const names = new Set<string>();
  for (const c of input.comps) for (const p of c.pads) if (p.net) names.add(p.net);
  for (const t of input.traces) if (t.net) names.add(t.net);
  for (const v of input.vias) if (v.net) names.add(v.net);
  const m = new Map<string, number>([["", 0]]);
  [...names].sort().forEach((name, i) => m.set(name, i + 1));
  return m;
}

export function toKicadPcb(input: KicadPcbInput, opts: { date?: string } = {}): string {
  const nets = netTable(input);
  const code = (net: string) => nets.get(net) ?? 0;
  const out: string[] = [];

  out.push(`(kicad_pcb (version 20221018) (generator "electrace")`);
  out.push(`  (general (thickness 1.6))`);
  out.push(`  (paper "A4")`);
  out.push(`  (layers`);
  const layers: [number, string, string][] = [
    [0, "F.Cu", "signal"], [1, "In1.Cu", "signal"], [2, "In2.Cu", "signal"], [31, "B.Cu", "signal"],
    [32, "B.Adhes", "user"], [33, "F.Adhes", "user"],
    [34, "B.Paste", "user"], [35, "F.Paste", "user"],
    [36, "B.SilkS", "user"], [37, "F.SilkS", "user"],
    [38, "B.Mask", "user"], [39, "F.Mask", "user"],
    [44, "Edge.Cuts", "user"],
    [48, "B.Fab", "user"], [49, "F.Fab", "user"],
  ];
  for (const [i, name, type] of layers) out.push(`    (${i} ${q(name)} ${type})`);
  out.push(`  )`);
  if (opts.date) out.push(`  (title_block (date ${q(opts.date)}))`);

  // net declarations
  for (const [name, c] of [...nets.entries()].sort((a, b) => a[1] - b[1])) out.push(`  (net ${c} ${q(name)})`);

  // footprints (inline pads)
  for (const c of input.comps) {
    out.push(`  (footprint ${q(c.footprint)} (layer "F.Cu")`);
    out.push(`    (at ${n(c.x)} ${n(c.y)}${c.rot ? ` ${n(c.rot)}` : ""})`);
    out.push(`    (property "Reference" ${q(c.ref)} (at 0 0) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))`);
    out.push(`    (property "Value" ${q(c.value ?? c.footprint)} (at 0 1.2) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))`);
    for (const p of c.pads) {
      const cd = code(p.net);
      const net = cd ? ` (net ${cd} ${q(p.net)})` : "";
      if (p.drill && p.drill > 0)
        out.push(`    (pad ${q(p.num)} thru_hole circle (at ${n(p.x)} ${n(p.y)}) (size ${n(p.w)} ${n(p.h)}) (drill ${n(p.drill)}) (layers "*.Cu" "*.Mask")${net})`);
      else {
        const shape = p.round && p.round > 0 ? "roundrect" : "rect";
        const rr = shape === "roundrect" ? ` (roundrect_rratio ${n(Math.min(0.5, p.round!))})` : "";
        out.push(`    (pad ${q(p.num)} smd ${shape} (at ${n(p.x)} ${n(p.y)}) (size ${n(p.w)} ${n(p.h)}) (layers "F.Cu" "F.Paste" "F.Mask")${rr}${net})`);
      }
    }
    out.push(`  )`);
  }

  // copper tracks — straight segments, plus circular-arc fillets at corners when a radius is set
  for (const t of input.traces) {
    const cd = code(t.net), ly = q(t.layer);
    for (const pr of filletTrace(t.path, input.fillet ?? 0, 8)) {
      if (pr.kind === "seg") out.push(`  (segment (start ${n(pr.a.x)} ${n(pr.a.y)}) (end ${n(pr.b.x)} ${n(pr.b.y)}) (width ${n(t.width)}) (layer ${ly}) (net ${cd}))`);
      else out.push(`  (arc (start ${n(pr.a.x)} ${n(pr.a.y)}) (mid ${n(pr.mid.x)} ${n(pr.mid.y)}) (end ${n(pr.b.x)} ${n(pr.b.y)}) (width ${n(t.width)}) (layer ${ly}) (net ${cd}))`);
    }
  }

  // vias (through-hole, both copper layers)
  for (const v of input.vias)
    out.push(`  (via (at ${n(v.x)} ${n(v.y)}) (size ${n(v.r * 2)}) (drill ${n(v.drill ?? v.r * 0.8)}) (layers "F.Cu" "B.Cu") (net ${code(v.net)}))`);

  // board outline on Edge.Cuts — one line per polygon edge (closed), so any shape cuts cleanly
  if (input.board && input.board.outline.length >= 2) {
    const o = input.board.outline;
    for (let i = 0; i < o.length; i++) {
      const a = o[i], b = o[(i + 1) % o.length];
      out.push(`  (gr_line (start ${n(a.x)} ${n(a.y)}) (end ${n(b.x)} ${n(b.y)}) (stroke (width 0.1) (type solid)) (layer "Edge.Cuts"))`);
    }
  }

  out.push(`)`);
  return out.join("\n") + "\n";
}
