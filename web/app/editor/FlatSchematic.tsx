"use client";
// The flat "Schematic view": the WHOLE design as one traditional schematic sheet — every placed
// block's drawn internals, side by side, with NET-NAME FLAGS at each port carrying cross-block
// connectivity by name (how real multi-sheet schematics read; no global routing needed). Read-only:
// it's the review/handoff surface — double-click a block's drawing to edit it in its own editor.
import { useMemo, useRef } from "react";
import type { Block, ResolvedDesign } from "@electrace/core";
import { SYMBOLS, renderChip, useSymbolStyle, type SymStyle } from "./symbols";
import {
  type Model, type Sym, ortho, wireAbsPath, pickModel, modelBounds, orientPorts, symDims, normRot, placeLabels,
} from "./schematic-model";

const NET_COLOR: Record<string, string> = { power: "#f7b13c", rail: "#46dca6", gnd: "#9aa6b6", signal: "#4c8dff" };
const PAD = 70;          // gap between block drawings
const ROW_W = 1500;      // wrap width of the sheet

interface Item {
  ref: string;
  name: string;
  model: Model;
  why: Map<string, string>;             // symbol ref → authored part "why" (hover tooltip)
  netOfTerm: Map<string, string>;       // terminal id → design net id
  netTypeOfTerm: Map<string, string>;
  x: number; y: number; w: number; h: number;
  bx: number; by: number;               // model-space origin (bounds min)
}

export default function FlatSchematic({ resolved, blockOf, onOpenBlock }: {
  resolved: ResolvedDesign;
  blockOf: (instanceRef: string) => Block | undefined;
  onOpenBlock?: (instanceRef: string) => void;
}) {
  const symStyle = useSymbolStyle();
  const svgRef = useRef<SVGSVGElement>(null);

  const { items, sheetW, sheetH } = useMemo(() => {
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
      const b = modelBounds(model);
      return [{ ref: inst.ref, name: def.name, model, why, netOfTerm, netTypeOfTerm, bx: b.x, by: b.y, w: b.w, h: b.h, x: 0, y: 0 }];
    });
    // simple flow layout: left→right, wrap; titles need headroom
    let x = PAD, y = PAD + 30, rowH = 0;
    for (const it of raw) {
      if (x + it.w + PAD > ROW_W && x > PAD) { x = PAD; y += rowH + PAD + 30; rowH = 0; }
      it.x = x; it.y = y;
      x += it.w + PAD; rowH = Math.max(rowH, it.h);
    }
    return { items: raw as Item[], sheetW: Math.max(ROW_W, 400), sheetH: y + rowH + PAD };
  }, [resolved, blockOf]);

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
    <div className="relative h-full overflow-auto bg-[var(--color-bg)]">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <span className="text-[11px] text-[var(--color-faint)]">read-only · same-named flags are the same net · double-click a block to edit it</span>
        <button onClick={downloadSvg} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Download SVG</button>
      </div>
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={sheetW} height={sheetH} viewBox={`0 0 ${sheetW} ${sheetH}`}
        style={{ color: "var(--color-text)", display: "block", minWidth: "100%" }} fontFamily="var(--font-mono)">
        {items.map((it) => <InstanceSheet key={it.ref} it={it} symStyle={symStyle} onOpen={onOpenBlock} />)}
        {items.length === 0 && <text x={40} y={60} fontSize={13} fill="var(--color-faint)">Nothing placed yet — add blocks on the canvas first.</text>}
      </svg>
    </div>
  );
}

function InstanceSheet({ it, symStyle, onOpen }: { it: Item; symStyle: SymStyle; onOpen?: (ref: string) => void }) {
  const m = it.model;
  const labels = useMemo(() => placeLabels(m, symStyle), [m, symStyle]);
  const tx = it.x - it.bx, ty = it.y - it.by;
  return (
    <g transform={`translate(${tx},${ty})`} onDoubleClick={() => onOpen?.(it.ref)} style={onOpen ? { cursor: "pointer" } : undefined}>
      {/* frame + title, like a sheet region on a traditional drawing */}
      <rect x={it.bx - 18} y={it.by - 26} width={it.w + 36} height={it.h + 44} rx={6} fill="none" stroke="var(--color-border)" strokeDasharray="5 4" />
      <text x={it.bx - 10} y={it.by - 32} fontSize={11.5} fontWeight={700} fill="var(--color-dim)">{it.ref} — {it.name}</text>
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
        const mask = d.body
          ? <rect x={d.body.x} y={d.body.y} width={d.body.w} height={d.body.h} fill="var(--color-bg)" />
          : d.w > 14 && d.h > 14 ? <rect x={5} y={5} width={d.w - 10} height={d.h - 10} fill="var(--color-bg)" /> : null;
        return (
          <g key={s.id} transform={`translate(${s.x},${s.y}) rotate(${normRot(s.rot ?? 0)} ${d.w / 2} ${d.h / 2})`} opacity={isPort ? 0.9 : 1}>
            {s.ref && it.why.has(s.ref) && <title>{s.ref}: {it.why.get(s.ref)}</title>}
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
