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

/** Import + browse the footprint library. When `assignTo` is set, each footprint can be applied to that
 *  selected PCB component. */
export default function FootprintLibrary({ onClose, assignTo, currentId, onAssign, onClear, onAutoMatch }: {
  onClose: () => void;
  assignTo?: string;
  currentId?: string;
  onAssign?: (id: string) => void;
  onClear?: () => void;
  onAutoMatch?: () => number;
}) {
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
          <h2 className="text-[15px] font-bold text-text">{assignTo ? `Footprint for ${assignTo}` : "Footprint library"}</h2>
          <span id="fp-status" className="text-[12px] text-faint">{fps.length} imported</span>
          <div className="ml-auto flex items-center gap-2">
            {onAutoMatch && fps.length > 0 && (
              <button onClick={() => { const n = onAutoMatch(); const el = document.getElementById("fp-status"); if (el) el.textContent = n ? `Auto-matched ${n} part${n > 1 ? "s" : ""}.` : "No parts matched the library."; }}
                className="rounded-lg border border-border-strong px-3 py-1.5 text-[13px] font-medium text-dim transition hover:border-accent hover:text-text" title="Assign library footprints to every part that matches by package">Auto-match parts</button>
            )}
            {assignTo && onClear && <button onClick={onClear} className="rounded-lg border border-border-strong px-3 py-1.5 text-[13px] text-dim transition hover:border-accent hover:text-text">Use default</button>}
            <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-accent-hi">Import .kicad_mod…</button>
            <button onClick={onClose} className="text-faint hover:text-text">✕</button>
          </div>
          <input ref={fileRef} type="file" accept=".kicad_mod" multiple onChange={onFiles} className="hidden" />
        </div>

        <div className="overflow-auto p-5">
          {/* tell the user how to assign, since 'Use' only appears once a part is selected */}
          {assignTo ? (
            <div className="mb-3 rounded-lg border px-3 py-2 text-[12.5px]" style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)" }}>
              Click a footprint to assign it to <b className="font-semibold">{assignTo}</b>.
            </div>
          ) : fps.length > 0 ? (
            <div className="mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] text-dim">
              💡 To <b className="font-semibold text-text">assign</b> a footprint to a part: close this, click the part on the board, then reopen <b className="font-semibold text-text">Footprints</b>.
            </div>
          ) : null}

          {fps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <div className="text-[14px] font-semibold text-text">No footprints yet</div>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-dim">Import real footprints from KiCad <code className="font-mono text-[12px]">.kicad_mod</code> files — pick one, or select a whole library folder&apos;s files at once.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fps.map((f: StoredFootprint) => {
                const assignable = !!(assignTo && onAssign);
                return (
                  <div key={f.id} onClick={assignable ? () => onAssign!(f.id) : undefined}
                    className={`group flex items-center gap-3 rounded-xl border bg-surface-2 p-3 ${currentId === f.id ? "border-accent" : "border-border"} ${assignable ? "cursor-pointer hover:border-accent" : ""}`}>
                    <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-lg border border-border bg-bg">
                      <FootprintPreview footprint={f.footprint} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-text">{f.name}{currentId === f.id && <span className="ml-1.5 text-[10px] text-accent">● assigned</span>}</div>
                      <div className="mt-0.5 text-[11.5px] text-faint">{f.footprint.pads.length} pads · {f.footprint.kind.toUpperCase()} · {f.footprint.w}×{f.footprint.h} mm</div>
                    </div>
                    {assignable && <span className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Use</span>}
                    <button onClick={(e) => { e.stopPropagation(); removeFootprint(f.id); }} title="Remove from library" className="text-faint opacity-0 transition hover:text-[#e2837e] group-hover:opacity-100">🗑</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
