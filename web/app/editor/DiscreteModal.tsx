"use client";
import { useEffect } from "react";
import type { Block } from "@electrace/core";
import SchematicPreview from "./SchematicPreview";

/** Read-only "break into discrete" view: shows what a supported IC block looks like built from discrete
 *  components — the drawn schematic, a note on how it works, and the parts list. Does NOT change the
 *  design (a future step adds an in-place swap). */
export default function DiscreteModal({ block, onClose }: { block: Block; onClose: () => void }) {
  const d = block.discrete;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!d) return null;
  const parts = d.schematic?.parts ?? [];

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-6 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface text-text shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-border text-sm" style={block.glyphColor ? { color: block.glyphColor } : undefined}>{block.glyph ?? "▦"}</span>
          <div className="flex-1">
            <div className="text-[14px] font-bold leading-tight">{block.name} — as discrete components</div>
            <div className="text-[11px] text-faint">What this IC is, underneath — built from discrete parts</div>
          </div>
          <span className="rounded bg-[#8b6cff]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#a98bff]">discrete view</span>
          <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-text">✕</button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* drawn schematic */}
          <SchematicPreview blockId={`${block.id}::discrete`} layout={d.layout} height={300} />

          {/* how it works */}
          {d.note && (
            <p className="rounded-lg border border-[#8b6cff]/30 bg-[#8b6cff]/[0.06] p-3 text-[12.5px] leading-relaxed text-dim">{d.note}</p>
          )}

          {/* parts list */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-faint">Parts ({parts.length})</div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-bg2 text-left text-[10px] uppercase tracking-wide text-faint">
                    <th className="px-3 py-1.5 font-semibold">Ref</th>
                    <th className="px-3 py-1.5 font-semibold">Part</th>
                    <th className="px-3 py-1.5 font-semibold">Why it's there</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.ref} className="border-t border-border align-top">
                      <td className="px-3 py-1.5 font-mono text-[11px]">{p.ref}</td>
                      <td className="px-3 py-1.5">{p.type}{p.value ? ` ${p.value}` : ""}{p.part ? <span className="text-faint"> · {p.part}</span> : null}</td>
                      <td className="px-3 py-1.5 text-dim">{p.why ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-faint">
            A teaching equivalent — it shows the working principle (a voltage reference + a pass element), not a production-optimal design.
            Dropping it into your schematic in place is coming next; for now this is a read-only look under the hood.
          </p>
        </div>
      </div>
    </div>
  );
}
