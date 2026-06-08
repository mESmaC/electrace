"use client";
import { useRef } from "react";
import type { Footprint } from "@electrace/core";
import { useFootprints, importKicadFootprints, removeFootprint, type StoredFootprint } from "@/lib/footprints";

/** A small SVG preview of a footprint's land pattern (pads in mm, centred on the origin). */
export function FootprintPreview({ footprint, size = 72 }: { footprint: Footprint; size?: number }) {
  const w = Math.max(footprint.w, 2), h = Math.max(footprint.h, 2);
  return (
    <svg width={size} height={size} viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} className="shrink-0">
      {footprint.pads.map((p, i) => {
        const round = p.round ?? 0;
        const rx = round >= 0.5 ? Math.min(p.w, p.h) / 2 : round * Math.min(p.w, p.h);
        return (
          <g key={i}>
            <rect x={p.x - p.w / 2} y={p.y - p.h / 2} width={p.w} height={p.h} rx={rx} ry={rx}
              fill={p.drill ? "var(--color-amber)" : "var(--color-accent)"} fillOpacity={0.85} />
            {p.drill ? <circle cx={p.x} cy={p.y} r={p.drill / 2} fill="var(--color-surface)" /> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Import + browse the local library of imported KiCad footprints. */
export default function FootprintLibrary({ onClose }: { onClose: () => void }) {
  const fps = useFootprints();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!files.length) return;
    const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    const { added, failed } = await importKicadFootprints(texts);
    const el = document.getElementById("fp-status");
    if (el) el.textContent = `Imported ${added}${failed ? ` · ${failed} skipped` : ""}.`;
  };

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-text">Footprint library</h2>
          <span id="fp-status" className="text-[12px] text-faint">{fps.length} imported</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-accent-hi">Import .kicad_mod…</button>
            <button onClick={onClose} className="text-faint hover:text-text">✕</button>
          </div>
          <input ref={fileRef} type="file" accept=".kicad_mod" multiple onChange={onFiles} className="hidden" />
        </div>

        <div className="overflow-auto p-5">
          {fps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <div className="text-[14px] font-semibold text-text">No footprints yet</div>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-dim">Import real footprints from KiCad <code className="font-mono text-[12px]">.kicad_mod</code> files — pick one, or select a whole library folder&apos;s files at once.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fps.map((f: StoredFootprint) => (
                <div key={f.id} className="group flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
                  <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-lg border border-border bg-bg">
                    <FootprintPreview footprint={f.footprint} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-text">{f.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-faint">{f.footprint.pads.length} pads · {f.footprint.kind.toUpperCase()} · {f.footprint.w}×{f.footprint.h} mm</div>
                  </div>
                  <button onClick={() => removeFootprint(f.id)} title="Remove" className="text-faint opacity-0 transition hover:text-[#e2837e] group-hover:opacity-100">🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
