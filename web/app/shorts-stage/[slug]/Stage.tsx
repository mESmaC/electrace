"use client";
// The Shorts render stage: a 1080x1920 deterministic animation surface driven frame-by-frame by
// the renderer (shorts/render.mjs) via window.__frame(state). NOTHING here is time-based — every
// visual is a pure function of the injected state, so captured frames are exact and repeatable.
import { useEffect, useMemo, useRef } from "react";
import type { SchematicLayout } from "@electrace/core";
import { SYMBOLS, renderChip, useSymbolStyle } from "@/app/editor/symbols";
import { endAbs, ortho, layoutToModel, modelBounds, symDims, orientPorts, placeLabels, type Model } from "@/app/editor/schematic-model";

export interface FrameState {
  title?: string;
  caption?: string;
  wireProgress?: number;   // 0..nWires — wire i draws during [i, i+1]
  symbolsShown?: number;   // 0..nSyms — symbols pop in order
  labelsShown?: boolean;   // refs/values fade in (default: follow symbolsShown completion)
  highlight?: string;      // symbol ref to glow accent
  fault?: string;          // symbol ref to glow red (spot-the-bug payoff)
  cta?: boolean;           // show the end card
}
declare global { interface Window { __frame?: (s: FrameState) => void; __stageReady?: boolean; __stageMeta?: { wires: number; symbols: number } } }

const polyLen = (pts: { x: number; y: number }[]) => pts.slice(1).reduce((a, p, i) => a + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y), 0);

export default function Stage({ layout }: { layout: SchematicLayout }) {
  const symStyle = useSymbolStyle();
  const root = useRef<HTMLDivElement>(null);

  const m: Model = useMemo(() => orientPorts(layoutToModel(layout)), [layout]);
  const b = useMemo(() => modelBounds(m), [m]);
  const labels = useMemo(() => placeLabels(m, symStyle), [m, symStyle]);
  const wires = useMemo(() => m.wires.map((w) => {
    const a = endAbs(m.syms, w.a, m.wires), z = endAbs(m.syms, w.b, m.wires);
    const pts = a && z ? [a, ...(w.mid ?? []), z] : [];
    return { d: pts.length ? ortho(pts) : "", len: pts.length ? polyLen(pts) : 0 };
  }), [m]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    window.__frame = (s: FrameState) => {
      el.querySelector<HTMLElement>("[data-title]")!.textContent = s.title ?? "";
      el.querySelector<HTMLElement>("[data-caption]")!.textContent = s.caption ?? "";
      const wp = s.wireProgress ?? 0;
      el.querySelectorAll<SVGPathElement>("[data-wire]").forEach((p, i) => {
        const len = Number(p.dataset.len) || 1;
        const frac = Math.max(0, Math.min(1, wp - i));
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len * (1 - frac)}`;
      });
      const ss = s.symbolsShown ?? 1e9;
      el.querySelectorAll<SVGGElement>("[data-sym]").forEach((g, i) => {
        g.style.opacity = i < ss ? "1" : "0";
        const ref = g.dataset.sym;
        g.style.filter = s.fault && ref === s.fault ? "drop-shadow(0 0 14px #f87171)" :
                         s.highlight && ref === s.highlight ? "drop-shadow(0 0 14px #4c8dff)" : "";
      });
      const lbl = el.querySelector<HTMLElement>("[data-labels]");
      if (lbl) lbl.style.opacity = (s.labelsShown ?? (s.symbolsShown ?? 0) >= (window.__stageMeta?.symbols ?? 1)) ? "1" : "0";
      el.querySelector<HTMLElement>("[data-cta]")!.style.opacity = s.cta ? "1" : "0";
    };
    window.__stageMeta = { wires: wires.length, symbols: m.syms.length };
    window.__stageReady = true;
  }, [m, wires]);

  const pad = 60; // room for port labels at the drawing edge
  const vb = `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
  return (
    <div ref={root} style={{ width: 1080, height: 1920, background: "linear-gradient(180deg,#11151b,#161b22 55%,#11151b)", position: "fixed", top: 0, left: 0, zIndex: 2147483000, overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(243,246,251,.05) 2.2px, transparent 2.2px)", backgroundSize: "44px 44px" }} />
      <div data-title style={{ position: "absolute", top: 120, left: 60, right: 60, textAlign: "center", fontSize: 84, fontWeight: 800, lineHeight: 1.08, color: "#f3f6fb", letterSpacing: "-1px" }} />
      <div style={{ position: "absolute", top: 480, left: 40, right: 40, height: 900, display: "grid", placeItems: "center" }}>
        <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", maxHeight: 900, color: "#f3f6fb" }}>
          {wires.map((w, i) => w.d ? (
            <path key={i} data-wire data-len={w.len} d={w.d} fill="none" stroke="#4c8dff" strokeWidth={2.5} strokeLinejoin="round"
              style={{ strokeDasharray: `${w.len}`, strokeDashoffset: `${w.len}` }} />
          ) : null)}
          <g data-labels style={{ opacity: 0 }}>
            {labels.map((L, i) => {
              const lineH = L.fontSize + 2.5;
              return (
                <g key={`lbl${i}`}>
                  {L.leader && <line x1={L.leader.x1} y1={L.leader.y1} x2={L.leader.x2} y2={L.leader.y2} stroke="#828c9c" strokeWidth={1} strokeDasharray="2 3" opacity={0.55} />}
                  <text x={L.x} y={L.y - ((L.lines.length - 1) * lineH) / 2} textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'JetBrains Mono', monospace" fontSize={L.fontSize} fontWeight={L.port ? 700 : 400}
                    fill={L.port ? "#4c8dff" : L.inside ? "#f3f6fb" : "#c2cad6"}>
                    {L.lines.map((ln, k) => <tspan key={k} x={L.x} dy={k ? lineH : 0}>{ln}</tspan>)}
                  </text>
                </g>
              );
            })}
          </g>
          {m.syms.map((s) => {
            const dims = symDims(s);
            if (!dims) return null;
            const def = SYMBOLS[s.type];
            return (
              <g key={s.id} data-sym={s.ref || s.id} transform={`translate(${s.x},${s.y}) rotate(${s.rot ?? 0} ${dims.w / 2} ${dims.h / 2})`} style={{ opacity: 0 }}>
                {s.chip ? renderChip(dims, s.chip) : def?.draw(symStyle)}
              </g>
            );
          })}
        </svg>
      </div>
      <div data-caption style={{ position: "absolute", bottom: 300, left: 70, right: 70, textAlign: "center", fontSize: 58, fontWeight: 700, lineHeight: 1.2, color: "#f3f6fb", textShadow: "0 2px 18px rgba(0,0,0,.6)" }} />
      <div data-cta style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(17,21,27,.94)", opacity: 0 }}>
        <div style={{ textAlign: "center" }}>
          <svg viewBox="0 0 240 180" width="220" style={{ display: "block", margin: "0 auto 30px" }} fill="none">
            <path d="M169.7 39.9 A78 78 0 1 0 169.7 140.1" stroke="#f3f6fb" strokeWidth={16} strokeLinecap="round" />
            <path d="M65 90 H100 L106 76 L118 104 L130 76 L142 104 L154 76 L160 90 H200" stroke="#4c8dff" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={55} cy={90} r={10} fill="#161b22" stroke="#4c8dff" strokeWidth={6} />
            <circle cx={210} cy={90} r={10} fill="#161b22" stroke="#4c8dff" strokeWidth={6} />
          </svg>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 76, fontWeight: 800, color: "#f3f6fb" }}>Electrace</div>
          <div style={{ marginTop: 18, fontSize: 44, fontWeight: 600, color: "#c2cad6" }}>Free, in your browser.</div>
          <div style={{ marginTop: 8, fontSize: 44, fontWeight: 600, color: "#4c8dff" }}>Link in comments.</div>
        </div>
      </div>
    </div>
  );
}
