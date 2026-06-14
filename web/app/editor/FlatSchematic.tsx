"use client";
// The flat "Schematic view": the WHOLE design as one traditional schematic sheet — every placed
// block's drawn internals, side by side, with NET-NAME FLAGS at each port carrying cross-block
// connectivity by name (how real multi-sheet schematics read; no global routing needed). Read-only:
// it's the review/handoff surface — double-click a block's drawing to edit it in its own editor.
import { useMemo, useRef } from "react";
import { CONNECTOR_CATALOG, solveDc, type Block, type ResolvedDesign } from "@electrace/core";
import { SYMBOLS, renderChip, useSymbolStyle, type SymStyle } from "./symbols";
import {
  type Model, type Sym, type PlacedLabel, ortho, wireAbsPath, pickModel, boundsWithLabels, orientPorts, symDims, normRot, placeLabels,
} from "./schematic-model";

const NET_COLOR: Record<string, string> = { power: "#f7b13c", rail: "#46dca6", gnd: "#9aa6b6", signal: "#4c8dff" };
const PAD = 70;          // gap between block CELLS (between dashed frames, not bounds)
const ROW_W = 1500;      // wrap width of the sheet
const FRAME_PAD = 16;    // dashed-region frame inset around each block's visual bounds
const TITLE_H = 30;      // headroom above each frame for its "REF — name" title
const MARGIN = 48;       // sheet border inset from the SVG edge
const TB_W = 360, TB_H = 96; // EDA title block (bottom-right) dimensions
const BORDER = "var(--color-border)";

interface Glow { amps: number; color: string }
interface Item {
  ref: string;
  name: string;
  model: Model;
  why: Map<string, string>;             // symbol ref → authored part "why" (hover tooltip)
  glow: Map<string, Glow>;              // symbol ref → SOLVED LED luminance (real mA, real color)
  netOfTerm: Map<string, string>;       // terminal id → design net id
  netTypeOfTerm: Map<string, string>;
  labels: PlacedLabel[];                // computed ONCE here; the bounds + frame key off these
  x: number; y: number; w: number; h: number;
  bx: number; by: number;               // model-space origin (bounds min, labels included)
}

// LED luminance from the DC solve: output is ~proportional to forward current in the normal
// range, so the glow is the MATH, not decoration — a dim LED is a finding you can see.
const LED_COLOR: Record<string, string> = {
  red: "#ff5252", green: "#52ff8f", blue: "#52a8ff", yellow: "#ffe352",
  amber: "#ffb852", orange: "#ffa040", white: "#f4f7ff", uv: "#b07bff", ir: "#a04848",
};
const TYPICAL_LED_A = 0.015; // full brightness reference for indicators
function ledColor(value?: string): string {
  const v = (value ?? "").toLowerCase();
  for (const k of Object.keys(LED_COLOR)) if (v.includes(k)) return LED_COLOR[k];
  return "#ffd28a"; // warm default when only a Vf number is declared
}

export interface SheetMeta { title: string; rev?: string; author?: string; date?: string; }

export default function FlatSchematic({ resolved, blockOf, onOpenBlock, meta }: {
  resolved: ResolvedDesign;
  blockOf: (instanceRef: string) => Block | undefined;
  onOpenBlock?: (instanceRef: string) => void;
  meta?: SheetMeta;
}) {
  const symStyle = useSymbolStyle();
  const svgRef = useRef<SVGSVGElement>(null);

  const { items, connItems, sheetW, sheetH } = useMemo(() => {
    // the DC solve: which LEDs conduct, and at how many real milliamps
    const ledAmps = new Map<string, number>(); // "REF/D1" → amps
    try {
      const sol = solveDc(resolved);
      for (const d of sol.diodes) if (d.on && d.amps > 1e-5) ledAmps.set(d.ref, d.amps);
    } catch { /* unsolvable designs simply don't glow */ }
    // node → net id for the whole design (connector pins included)
    const netOf = new Map<string, { id: string; type: string }>();
    for (const n of resolved.nets) {
      for (const m of n.members) netOf.set(m.node, { id: n.id, type: n.type });
      for (const p of n.connectorPins ?? []) netOf.set(p, { id: n.id, type: n.type });
    }
    const raw = resolved.instances.flatMap((inst) => {
      const def = blockOf(inst.ref);
      if (!def) return [];
      const base = orientPorts(pickModel(def.id, def.layout));
      if (!base.syms.length) return [];
      // ports display the DESIGN net name (the flag), not the local terminal id
      const netOfTerm = new Map<string, string>();
      const netTypeOfTerm = new Map<string, string>();
      for (const t of def.terminals) {
        const net = netOf.get(`${inst.ref}.${t.id}`);
        netOfTerm.set(t.id, net?.id ?? t.id);
        netTypeOfTerm.set(t.id, net?.type ?? t.type);
      }
      const model: Model = { ...base, syms: base.syms.map((s) => (s.type === "port" && s.ref ? { ...s, ref: netOfTerm.get(s.ref) ?? s.ref, value: undefined } : s)) };
      const why = new Map<string, string>();
      for (const p of def.schematic?.parts ?? []) if (p.why) why.set(p.ref, p.why);
      // LEDs: pair the authored part type with the solved current (flat ref = "REF/part")
      const glow = new Map<string, Glow>();
      for (const p of def.schematic?.parts ?? []) {
        if (p.type !== "led") continue;
        const amps = ledAmps.get(`${inst.ref}/${p.ref}`);
        if (amps == null) continue;
        const symVal = base.syms.find((sy) => sy.ref === p.ref)?.value;
        glow.set(p.ref, { amps, color: ledColor(symVal ?? (typeof p.value === "string" ? p.value : undefined)) });
      }
      // labels computed ONCE (title-bar region is an obstacle so labels don't park on it), then
      // the visual bounds INCLUDE those labels — frame and packing share one honest extent.
      const labels = placeLabels(model, symStyle, [{ x: -9999, y: -9999, w: 1, h: 1 }]);
      const b = boundsWithLabels(model, labels);
      return [{ ref: inst.ref, name: def.name, model, why, glow, netOfTerm, netTypeOfTerm, labels, bx: b.x, by: b.y, w: b.w, h: b.h, x: 0, y: 0 }];
    });
    // board I/O: every design-level connector is a region too — a schematic without its
    // headers/jacks is missing exactly the pins a reviewer checks first
    const conns = (resolved.design.connectors ?? []).map((c) => {
      const part = CONNECTOR_CATALOG[c.connector];
      const pins = (part?.pins ?? []).map((pin) => {
        const net = netOf.get(`${c.ref}.${pin}`);
        return { pin, net: net?.id, type: net?.type ?? "signal" };
      });
      const w = 90 + Math.max(60, ...pins.map((p) => (p.net ?? "open").length * 7));
      return { ref: c.ref, name: part?.name ?? c.connector, pins, w, h: pins.length * 22 + 24, x: 0, y: 0 };
    });
    // simple flow layout: left→right, wrap; the dashed region frame + its title need headroom,
    // so each cell reserves FRAME_PAD around the (label-inclusive) bounds and TITLE_H on top.
    const all = [...raw, ...conns];
    let x = MARGIN, y = MARGIN + TITLE_H, rowH = 0, contentR = 0, contentB = 0;
    for (const it of all) {
      const cellW = it.w + FRAME_PAD * 2;
      if (x + cellW + PAD > ROW_W && x > MARGIN) { x = MARGIN; y += rowH + PAD + TITLE_H; rowH = 0; }
      it.x = x; it.y = y;
      x += cellW + PAD; rowH = Math.max(rowH, it.h + FRAME_PAD * 2);
      contentR = Math.max(contentR, it.x + cellW);
      contentB = Math.max(contentB, it.y + it.h + FRAME_PAD);
    }
    // sheet fits content (no forced ROW_W band that read as a right-edge "shadow"), plus a margin
    // and room at the bottom-right for the EDA title block.
    const sheetW = Math.max(560, contentR + MARGIN);
    const sheetH = contentB + MARGIN + TB_H + 10;
    return { items: raw as Item[], connItems: conns, sheetW, sheetH };
  }, [resolved, blockOf, symStyle]);

  const downloadSvg = () => {
    const el = svgRef.current;
    if (!el) return;
    const blob = new Blob([`<?xml version="1.0"?>\n${el.outerHTML}`], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(resolved.design.name || "design").replace(/\s+/g, "-").toLowerCase()}-schematic.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    // the "desk": a darker surround so the sheet reads as a page sitting on it (kills the old
    // right-edge seam — the sheet now has an intentional, shadowed boundary).
    <div className="relative h-full overflow-auto bg-[var(--color-surface-2)] p-6">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <span className="text-[11px] text-[var(--color-faint)]">read-only · same-named flags are the same net · double-click a block to edit it</span>
        <button onClick={downloadSvg} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Download SVG</button>
      </div>
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={sheetW} height={sheetH} viewBox={`0 0 ${sheetW} ${sheetH}`}
        style={{ color: "var(--color-text)", display: "block", boxShadow: "0 2px 16px rgba(0,0,0,0.35)", borderRadius: 2 }} fontFamily="var(--font-mono)">
        {/* the sheet itself — an opaque page under everything (so the desk doesn't show through) */}
        <rect x={0} y={0} width={sheetW} height={sheetH} fill="var(--color-bg)" />
        {items.map((it) => <InstanceSheet key={it.ref} it={it} symStyle={symStyle} onOpen={onOpenBlock} />)}
        {connItems.map((c) => (
          <g key={c.ref} transform={`translate(${c.x + FRAME_PAD},${c.y})`}>
            <rect x={-FRAME_PAD} y={-FRAME_PAD} width={c.w + FRAME_PAD * 2} height={c.h + FRAME_PAD * 2} rx={6} fill="none" stroke={BORDER} strokeDasharray="5 4" />
            <text x={-FRAME_PAD + 8} y={-FRAME_PAD - 7} fontSize={11.5} fontWeight={700} fill="var(--color-dim)">{c.ref} — {c.name}</text>
            {/* the connector body + one row per pin, each flying its net flag */}
            <rect x={0} y={0} width={26} height={c.h - 10} rx={3} fill="var(--color-bg)" stroke="currentColor" strokeWidth={1.5} />
            {c.pins.map((p, i) => {
              const py = 14 + i * 22;
              return (
                <g key={p.pin}>
                  <line x1={26} y1={py} x2={48} y2={py} stroke={p.net ? "#46dca6" : "var(--color-faint)"} strokeWidth={1.6} strokeDasharray={p.net ? undefined : "3 3"} />
                  <text x={13} y={py} fontSize={9} textAnchor="middle" dominantBaseline="middle" fill="currentColor">{p.pin}</text>
                  <text x={54} y={py} fontSize={10.5} fontWeight={700} dominantBaseline="middle"
                    fill={p.net ? (NET_COLOR[p.type] ?? "#4c8dff") : "var(--color-faint)"}>{p.net ?? "open"}</text>
                </g>
              );
            })}
          </g>
        ))}
        {items.length === 0 && connItems.length === 0 && <text x={40} y={60} fontSize={13} fill="var(--color-faint)">Nothing placed yet — add blocks on the canvas first.</text>}
        <TitleBlock sheetW={sheetW} sheetH={sheetH} meta={meta ?? { title: resolved.design.name || "Untitled" }} count={items.length + connItems.length} />
      </svg>
    </div>
  );
}

/** Sheet border + a bottom-right title block, the way any EDA tool prints a schematic for handoff. */
function TitleBlock({ sheetW, sheetH, meta, count }: { sheetW: number; sheetH: number; meta: SheetMeta; count: number }) {
  const bx = sheetW - MARGIN - TB_W, by = sheetH - MARGIN - TB_H; // top-left of the block
  const row = TB_H / 3;
  const cell = (x: number, y: number, w: number, h: number, label: string, value: string, big = false) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={BORDER} strokeWidth={1} />
      <text x={x + 6} y={y + 11} fontSize={7} fill="var(--color-faint)" letterSpacing="0.5">{label}</text>
      <text x={x + 6} y={y + h - 7} fontSize={big ? 12 : 10} fontWeight={big ? 700 : 500} fill="var(--color-text)">{value}</text>
    </g>
  );
  return (
    <g pointerEvents="none">
      {/* drawing border — the printable frame around the whole sheet */}
      <rect x={MARGIN / 2} y={MARGIN / 2} width={sheetW - MARGIN} height={sheetH - MARGIN} fill="none" stroke={BORDER} strokeWidth={1.5} />
      {/* title block */}
      <rect x={bx} y={by} width={TB_W} height={TB_H} fill="var(--color-bg)" stroke={BORDER} strokeWidth={1.5} />
      {cell(bx, by, TB_W, row, "TITLE", meta.title, true)}
      {cell(bx, by + row, TB_W * 0.55, row, "AUTHOR", meta.author || "—")}
      {cell(bx + TB_W * 0.55, by + row, TB_W * 0.45, row, "DATE", meta.date || "—")}
      {cell(bx, by + row * 2, TB_W * 0.3, row, "REV", meta.rev || "A")}
      {cell(bx + TB_W * 0.3, by + row * 2, TB_W * 0.4, row, "BLOCKS", String(count))}
      {cell(bx + TB_W * 0.7, by + row * 2, TB_W * 0.3, row, "SHEET", "1 / 1")}
    </g>
  );
}

function InstanceSheet({ it, symStyle, onOpen }: { it: Item; symStyle: SymStyle; onOpen?: (ref: string) => void }) {
  const m = it.model;
  const labels = it.labels; // computed once in the layout pass; bounds already enclose them
  // frame = the label-inclusive bounds, inset by FRAME_PAD (matches the cell the packer reserved)
  const frame = { x: it.bx - FRAME_PAD, y: it.by - FRAME_PAD, w: it.w + FRAME_PAD * 2, h: it.h + FRAME_PAD * 2 };
  const tx = it.x - it.bx, ty = it.y - it.by;
  return (
    <g transform={`translate(${tx},${ty})`} onDoubleClick={() => onOpen?.(it.ref)} style={onOpen ? { cursor: "pointer" } : undefined}>
      {/* frame + title, like a sheet region on a traditional drawing (encloses labels too) */}
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={6} fill="none" stroke={BORDER} strokeDasharray="5 4" />
      <text x={frame.x + 8} y={frame.y - 7} fontSize={11.5} fontWeight={700} fill="var(--color-dim)">{it.ref} — {it.name}</text>
      {m.wires.map((w) => {
        const pts = wireAbsPath(m.syms, w, m.wires);
        if (pts.length < 2) return null;
        return <path key={w.id} d={ortho(pts)} fill="none" stroke="#46dca6" strokeWidth={1.6} strokeLinejoin="round" />;
      })}
      {m.syms.map((s) => {
        const d = symDims(s);
        if (!d) return null;
        const isPort = s.type === "port";
        const glyph = s.chip ? renderChip(d, s.chip) : SYMBOLS[s.type]?.draw(symStyle);
        // mask + soft inner edge so wires read as ducking UNDER the part, not stopping at a flat
        // cut (matches the block editor's depth treatment; see BlockSchematic body mask).
        const mask = d.body
          ? <><rect x={d.body.x} y={d.body.y} width={d.body.w} height={d.body.h} fill="var(--color-bg)" />
              <rect x={d.body.x + 0.75} y={d.body.y + 0.75} width={d.body.w - 1.5} height={d.body.h - 1.5} fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={1.5} rx={2} /></>
          : d.w > 14 && d.h > 14 ? <><rect x={5} y={5} width={d.w - 10} height={d.h - 10} fill="var(--color-bg)" />
              <rect x={5.75} y={5.75} width={d.w - 11.5} height={d.h - 11.5} fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={1.5} rx={2} /></>
          : null;
        const g = s.ref ? it.glow.get(s.ref) : undefined;
        const rel = g ? Math.min(1.4, g.amps / TYPICAL_LED_A) : 0;
        return (
          <g key={s.id} transform={`translate(${s.x},${s.y}) rotate(${normRot(s.rot ?? 0)} ${d.w / 2} ${d.h / 2})`} opacity={isPort ? 0.9 : 1}>
            {s.ref && (g
              ? <title>{s.ref}: lit — ≈{(g.amps * 1000).toFixed(1)} mA forward current ({Math.round(rel * 100)}% of a typical 15 mA indicator){it.why.has(s.ref) ? `
${it.why.get(s.ref)}` : ""}</title>
              : it.why.has(s.ref) ? <title>{s.ref}: {it.why.get(s.ref)}</title> : null)}
            {g && (
              <>
                <circle cx={d.w / 2} cy={d.h / 2} r={Math.max(d.w, d.h) * (0.55 + rel * 0.5)} fill={g.color} opacity={0.10 + 0.18 * Math.min(rel, 1)} />
                <circle cx={d.w / 2} cy={d.h / 2} r={Math.max(d.w, d.h) * 0.42} fill={g.color} opacity={0.18 + 0.3 * Math.min(rel, 1)} />
              </>
            )}
            {mask}{glyph}
          </g>
        );
      })}
      {/* labels (collision-avoided); port labels are the design NET names = the flags */}
      {labels.map((L, i) => {
        const lineH = L.fontSize + 2.5;
        const portSym = L.port ? m.syms.find((x) => x.id === L.sym) : undefined;
        const fill = L.port ? (NET_COLOR[netTypeOf(it, portSym)] ?? "#4c8dff") : "currentColor";
        return (
          <g key={i} pointerEvents="none">
            {L.leader && <line x1={L.leader.x1} y1={L.leader.y1} x2={L.leader.x2} y2={L.leader.y2} stroke="var(--color-faint)" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />}
            <text x={L.x} y={L.y - ((L.lines.length - 1) * lineH) / 2} textAnchor="middle" dominantBaseline="middle"
              fontSize={L.fontSize} fontWeight={L.port ? 700 : 400} fill={fill}>
              {L.lines.map((ln, k) => <tspan key={k} x={L.x} dy={k ? lineH : 0}>{ln}</tspan>)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** The net TYPE for a port symbol whose ref was rewritten to the net name — look it up by net name. */
function netTypeOf(it: Item, portSym?: Sym): string {
  if (!portSym?.ref) return "signal";
  for (const [term, net] of it.netOfTerm) if (net === portSym.ref) return it.netTypeOfTerm.get(term) ?? "signal";
  return "signal";
}
