"use client";
import { useEffect, useState } from "react";
import { deriveSchematicNets, type SchematicLayout } from "@electrace/core";
import { SYMBOLS, renderChip, useSymbolStyle } from "./symbols";
import {
  WIRE_COLOR, type WireState, type Model, type Wire,
  endAbs, ortho, layoutToModel, pickModel, modelBounds, toSchEndpoint, symDims, normRot,
} from "./schematic-model";

/** A static, non-interactive thumbnail of a block's internal schematic. Reflects the
 *  edited draft when present (else the authored layout) and colours wires by net health. */
export default function SchematicPreview({ blockId, layout, height = 84 }: { blockId: string; layout?: SchematicLayout; height?: number }) {
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

  if (!model.syms.length) {
    return (
      <div className="grid place-items-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-[10px] text-[var(--color-faint)]" style={{ height }}>
        no schematic yet
      </div>
    );
  }

  const b = modelBounds(model);
  const pad = 12;
  const vb = `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;

  const conns = model.wires.map((w) => ({ id: w.id, a: toSchEndpoint(model.syms, w.a, `${w.id}:a`), b: toSchEndpoint(model.syms, w.b, `${w.id}:b`) }));
  const twoPin = model.syms.filter((s) => SYMBOLS[s.type]?.pins.length === 2).map((s) => s.id);
  const nets = deriveSchematicNets(conns, twoPin);
  const wireState = (w: Wire): WireState => {
    const ea = toSchEndpoint(model.syms, w.a, `${w.id}:a`), eb = toSchEndpoint(model.syms, w.b, `${w.id}:b`);
    if (ea.kind === "broken" || eb.kind === "broken") return "error";
    if (ea.kind === "free" || eb.kind === "free") return "floating";
    const nid = nets.netOfConn.get(w.id);
    return nid != null && nets.nets[nid].shorts.length ? "error" : "ok";
  };

  return (
    <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" width="100%" height={height}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]" style={{ display: "block", color: "var(--color-text)" }}>
      {model.wires.map((w) => {
        const a = endAbs(model.syms, w.a), b2 = endAbs(model.syms, w.b);
        if (!a || !b2) return null;
        return <path key={w.id} d={ortho([a, ...w.mid, b2])} fill="none" stroke={WIRE_COLOR[wireState(w)]} strokeWidth={2} strokeLinejoin="round" />;
      })}
      {model.syms.map((s) => {
        const d = symDims(s);
        if (!d) return null;
        const glyph = s.chip ? renderChip(d, s.chip) : SYMBOLS[s.type]?.draw(symStyle);
        return <g key={s.id} transform={`translate(${s.x},${s.y}) rotate(${normRot(s.rot ?? 0)} ${d.w / 2} ${d.h / 2})`}>{glyph}</g>;
      })}
    </svg>
  );
}
