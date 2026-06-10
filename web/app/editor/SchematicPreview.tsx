"use client";
import { useEffect, useMemo, useState } from "react";
import { deriveSchematicNets, type SchematicLayout } from "@electrace/core";
import { SYMBOLS, renderChip, useSymbolStyle } from "./symbols";
import {
  WIRE_COLOR, type WireState, type Model, type Wire,
  endAbs, ortho, layoutToModel, pickModel, modelBounds, toSchEndpoint, symDims, normRot, orientPorts,
} from "./schematic-model";

/** A static, non-interactive thumbnail of a block's internal schematic. Reflects the
 *  edited draft when present (else the authored layout) and colours wires by net health. */
export default function SchematicPreview({ blockId, layout, height = 84 }: { blockId: string; layout?: SchematicLayout; height?: number | "fit" }) {
  const symStyle = useSymbolStyle();
  // SSR-safe: render the authored layout first, swap to the saved draft after mount.
  const [model, setModel] = useState<Model>(() => layoutToModel(layout));
  useEffect(() => {
    const refresh = () => setModel(pickModel(blockId, layout));
    refresh();
    const onSave = (e: Event) => { if ((e as CustomEvent).detail === blockId) refresh(); };
    window.addEventListener("electrace:blocksch", onSave);
    return () => window.removeEventListener("electrace:blocksch", onSave);
  }, [blockId, layout]);

  // memoized on the model: previews live inside canvas nodes that re-render constantly
  // (selection, lint status, drag), and re-deriving nets each time is the expensive part
  const derived = useMemo(() => {
    if (!model.syms.length) return null;
    const m = orientPorts(model); // ports auto-face their wire — no hand-set rotation needed
    const conns = m.wires.map((w) => ({ id: w.id, a: toSchEndpoint(m.syms, w.a, `${w.id}:a`, m.wires), b: toSchEndpoint(m.syms, w.b, `${w.id}:b`, m.wires) }));
    const twoPin = m.syms.filter((s) => SYMBOLS[s.type]?.pins.length === 2).map((s) => s.id);
    return { m, b: modelBounds(m), nets: deriveSchematicNets(conns, twoPin) };
  }, [model]);

  if (!derived) {
    return (
      <div className="grid place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-faint)]" style={{ height: height === "fit" ? 120 : height }}>
        no schematic yet
      </div>
    );
  }

  const { m, b, nets } = derived;
  const pad = 12;
  const vb = `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
  const wireState = (w: Wire): WireState => {
    const ea = toSchEndpoint(m.syms, w.a, `${w.id}:a`, m.wires), eb = toSchEndpoint(m.syms, w.b, `${w.id}:b`, m.wires);
    if (ea.kind === "broken" || eb.kind === "broken") return "error";
    if (ea.kind === "free" || eb.kind === "free") return "floating";
    const nid = nets.netOfConn.get(w.id);
    return nid != null && nets.nets[nid].shorts.length ? "error" : "ok";
  };

  // "fit": render at (capped) natural size so a full schematic is actually readable — width follows
  // the drawing's own extent (max ~1.35 px/unit so tiny blocks don't blow up comically), height
  // follows the aspect ratio. Numeric height keeps the old thumbnail behaviour for canvas/share cards.
  const vbW = b.w + pad * 2, vbH = b.h + pad * 2;
  const sizing = height === "fit"
    ? { width: `min(100%, ${Math.round(vbW * 1.35)}px)`, aspectRatio: `${vbW} / ${vbH}`, maxHeight: 560, margin: "0 auto" }
    : undefined;
  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" width={height === "fit" ? undefined : "100%"} height={height === "fit" ? undefined : height}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]" style={{ display: "block", color: "var(--color-text)", ...sizing }}>
      {m.wires.map((w) => {
        const a = endAbs(m.syms, w.a, m.wires), b2 = endAbs(m.syms, w.b, m.wires);
        if (!a || !b2) return null;
        return <path key={w.id} d={ortho([a, ...w.mid, b2])} fill="none" stroke={WIRE_COLOR[wireState(w)]} strokeWidth={2} strokeLinejoin="round" />;
      })}
      {m.syms.map((s) => {
        const d = symDims(s);
        if (!d) return null;
        const glyph = s.chip ? renderChip(d, s.chip) : SYMBOLS[s.type]?.draw(symStyle);
        // same opaque-body rule as the editor: wires must not show through a part
        const mask = d.body
          ? <rect x={d.body.x} y={d.body.y} width={d.body.w} height={d.body.h} fill="var(--color-bg)" />
          : d.w > 14 && d.h > 14 ? <rect x={5} y={5} width={d.w - 10} height={d.h - 10} fill="var(--color-bg)" /> : null;
        return <g key={s.id} transform={`translate(${s.x},${s.y}) rotate(${normRot(s.rot ?? 0)} ${d.w / 2} ${d.h / 2})`}>{mask}{glyph}</g>;
      })}
    </svg>
  );
}
