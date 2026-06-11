"use client";
// The Shorts render stage: a 1080x1920 deterministic animation surface driven frame-by-frame via
// window.__frame(state). Supports multiple SCENES (e.g. a block, then its IC's discrete internals,
// then THAT part's internals — the teardown format cuts between them). Nothing is time-based:
// every visual is a pure function of injected state, so captured frames are exact and repeatable.
import { useEffect, useMemo, useRef } from "react";
import type { SchematicLayout } from "@electrace/core";
import { SYMBOLS, renderChip, useSymbolStyle } from "@/app/editor/symbols";
import { endAbs, ortho, layoutToModel, modelBounds, symDims, orientPorts, placeLabels } from "@/app/editor/schematic-model";

export interface FrameState {
  scene?: number;          // which scene is visible (default 0)
  title?: string;
  caption?: string;
  wireProgress?: number;   // 0..nWires of the ACTIVE scene — wire i draws during [i, i+1]
  symbolsShown?: number;   // 0..nSyms — symbols pop in order
  labelsShown?: boolean;   // refs/values visible (default: all symbols in)
  highlight?: string;      // comma-separated refs to SPOTLIGHT (glow; everything else dims)
  fault?: string;          // refs to glow red (spot-the-bug payoff)
  gone?: string;           // comma-separated refs: faded out with a red ✕ over them
  focus?: string;          // camera target ref (with camK/camU)
  camK?: number;           // zoom factor (1 = none)
  camU?: number;           // 0..1 recenter blend: 0 = zoom about the part, 1 = part centred
  cta?: boolean;           // show the end card
}
declare global { interface Window { __frame?: (s: FrameState) => void; __stageReady?: boolean; __stageMeta?: { wires: number; symbols: number }[] } }

const polyLen = (pts: { x: number; y: number }[]) => pts.slice(1).reduce((a, p, i) => a + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y), 0);
const csv = (v?: string) => new Set((v ?? "").split(",").map((x) => x.trim()).filter(Boolean));

export default function Stage({ scenes }: { scenes: { layout: SchematicLayout }[] }) {
  const symStyle = useSymbolStyle();
  const root = useRef<HTMLDivElement>(null);

  const built = useMemo(() => scenes.map(({ layout }) => {
    const m = orientPorts(layoutToModel(layout));
    const b = modelBounds(m);
    const wires = m.wires.map((w) => {
      const a = endAbs(m.syms, w.a, m.wires), z = endAbs(m.syms, w.b, m.wires);
      const pts = a && z ? [a, ...(w.mid ?? []), z] : [];
      return { d: pts.length ? ortho(pts) : "", len: pts.length ? polyLen(pts) : 0 };
    });
    return { m, b, wires, labels: placeLabels(m, symStyle) };
  }), [scenes, symStyle]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    window.__frame = (s: FrameState) => {
      const sceneIdx = s.scene ?? 0;
      el.querySelectorAll<HTMLElement>("[data-scene]").forEach((sc) => {
        sc.style.display = Number(sc.dataset.scene) === sceneIdx ? "" : "none";
      });
      const active = el.querySelector<HTMLElement>(`[data-scene="${sceneIdx}"]`);
      el.querySelector<HTMLElement>("[data-title]")!.textContent = s.title ?? "";
      el.querySelector<HTMLElement>("[data-caption]")!.textContent = s.caption ?? "";
      el.querySelector<HTMLElement>("[data-cta]")!.style.opacity = s.cta ? "1" : "0";
      if (!active) return;
      const wp = s.wireProgress ?? 0;
      active.querySelectorAll<SVGPathElement>("[data-wire]").forEach((p, i) => {
        const len = Number(p.dataset.len) || 1;
        const frac = Math.max(0, Math.min(1, wp - i));
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len * (1 - frac)}`;
      });
      const gone = csv(s.gone), hi = csv(s.highlight), fault = csv(s.fault);
      const spot = hi.size + fault.size > 0;
      const ss = s.symbolsShown ?? 1e9;
      active.querySelectorAll<SVGGElement>("[data-sym]").forEach((g, i) => {
        const ref = g.dataset.sym ?? "";
        const isTarget = hi.has(ref) || fault.has(ref);
        let op = i < ss ? 1 : 0;
        if (op > 0 && gone.has(ref)) op = 0.16;
        else if (op > 0 && spot && !isTarget) op = 0.3;
        g.style.opacity = String(op);
        g.style.filter = fault.has(ref) ? "drop-shadow(0 0 10px #f87171) drop-shadow(0 0 28px #f87171)" :
                         hi.has(ref) ? "drop-shadow(0 0 10px #4c8dff) drop-shadow(0 0 28px #4c8dff)" : "";
      });
      active.querySelectorAll<SVGPathElement>("[data-wire]").forEach((p) => { p.style.opacity = spot ? "0.35" : "1"; });
      active.querySelectorAll<SVGGElement>("[data-x]").forEach((g) => { g.style.opacity = gone.has(g.dataset.x ?? "") ? "1" : "0"; });
      const nsyms = Number(active.dataset.nsyms) || 1;
      const lbl = active.querySelector<HTMLElement>("[data-labels]");
      if (lbl) lbl.style.opacity = (s.labelsShown ?? ss >= nsyms) ? "1" : "0";
      const cam = active.querySelector<SVGGElement>("[data-cam]");
      if (cam) {
        const k = s.camK ?? 1, u = s.camU ?? 0;
        const tgt = s.focus ? active.querySelector<SVGGElement>(`[data-sym="${s.focus}"]`) : null;
        if (k > 1.001 && tgt) {
          const fx = Number(tgt.dataset.cx), fy = Number(tgt.dataset.cy);
          const c = JSON.parse(cam.dataset.center ?? "{}");
          cam.setAttribute("transform",
            `translate(${(c.x - fx) * u} ${(c.y - fy) * u}) translate(${fx} ${fy}) scale(${k}) translate(${-fx} ${-fy})`);
        } else cam.removeAttribute("transform");
      }
    };
    window.__stageMeta = built.map((sc) => ({ wires: sc.wires.length, symbols: sc.m.syms.length }));
    window.__stageReady = true;
  }, [built]);

  return (
    <div ref={root} style={{ width: 1080, height: 1920, background: "linear-gradient(180deg,#11151b,#161b22 55%,#11151b)", position: "fixed", top: 0, left: 0, zIndex: 2147483000, overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(243,246,251,.05) 2.2px, transparent 2.2px)", backgroundSize: "44px 44px" }} />
      <div data-title style={{ position: "absolute", top: 120, left: 60, right: 60, textAlign: "center", fontSize: 84, fontWeight: 800, lineHeight: 1.08, color: "#f3f6fb", letterSpacing: "-1px" }} />
      {built.map((sc, si) => {
        const pad = 60;
        const vb = `${sc.b.x - pad} ${sc.b.y - pad} ${sc.b.w + pad * 2} ${sc.b.h + pad * 2}`;
        return (
          <div key={si} data-scene={si} data-nsyms={sc.m.syms.length} style={{ position: "absolute", top: 480, left: 40, right: 40, height: 900, display: si === 0 ? "grid" : "none", placeItems: "center" }}>
            <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", maxHeight: 900, color: "#f3f6fb" }}>
              <g data-cam data-center={JSON.stringify({ x: sc.b.x + sc.b.w / 2, y: sc.b.y + sc.b.h / 2 })}>
                {sc.wires.map((w, i) => w.d ? (
                  <path key={i} data-wire data-len={w.len} d={w.d} fill="none" stroke="#4c8dff" strokeWidth={2.5} strokeLinejoin="round"
                    style={{ strokeDasharray: `${w.len}`, strokeDashoffset: `${w.len}` }} />
                ) : null)}
                {sc.m.syms.map((s) => {
                  const dims = symDims(s);
                  if (!dims) return null;
                  const def = SYMBOLS[s.type];
                  return (
                    <g key={s.id} data-sym={s.ref || s.id} data-cx={s.x + dims.w / 2} data-cy={s.y + dims.h / 2}
                      transform={`translate(${s.x},${s.y}) rotate(${s.rot ?? 0} ${dims.w / 2} ${dims.h / 2})`} style={{ opacity: 0 }}>
                      {s.chip ? renderChip(dims, s.chip) : def?.draw(symStyle)}
                    </g>
                  );
                })}
                <g data-labels style={{ opacity: 0 }}>
                  {sc.labels.map((L, i) => {
                    const lineH = L.fontSize * 1.4 + 2.5;
                    return (
                      <g key={`lbl${i}`}>
                        {L.leader && <line x1={L.leader.x1} y1={L.leader.y1} x2={L.leader.x2} y2={L.leader.y2} stroke="#828c9c" strokeWidth={1} strokeDasharray="2 3" opacity={0.55} />}
                        <text x={L.x} y={L.y - ((L.lines.length - 1) * lineH) / 2} textAnchor="middle" dominantBaseline="middle"
                          fontFamily="'JetBrains Mono', monospace" fontSize={L.fontSize * 1.4} fontWeight={L.port ? 700 : 400}
                          fill={L.port ? "#4c8dff" : L.inside ? "#f3f6fb" : "#c2cad6"}>
                          {L.lines.map((ln, k) => <tspan key={k} x={L.x} dy={k ? lineH : 0}>{ln}</tspan>)}
                        </text>
                      </g>
                    );
                  })}
                </g>
                {sc.m.syms.map((s) => {
                  const dims = symDims(s);
                  if (!dims) return null;
                  const cx = s.x + dims.w / 2, cy = s.y + dims.h / 2;
                  return (
                    <g key={`x${s.id}`} data-x={s.ref || s.id} style={{ opacity: 0 }}>
                      <line x1={cx - 14} y1={cy - 14} x2={cx + 14} y2={cy + 14} stroke="#f87171" strokeWidth={5.5} strokeLinecap="round" />
                      <line x1={cx + 14} y1={cy - 14} x2={cx - 14} y2={cy + 14} stroke="#f87171" strokeWidth={5.5} strokeLinecap="round" />
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        );
      })}
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
