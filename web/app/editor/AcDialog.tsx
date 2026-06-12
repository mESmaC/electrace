"use client";
// Frequency response dialog — stage 3's visual surface. Pick two points of YOUR design,
// get the real H(jω): magnitude + phase across a log sweep, the −3 dB corner marked, and
// the solver's honesty notes (what stayed open, what's AC ground) printed, not hidden.
// All client-side: the same exact-math engine, ~milliseconds per sweep.
import { useMemo, useState } from "react";
import { frequencyResponse, logSweep, type ResolvedDesign } from "@electrace/core";

const F_START = 1, F_END = 10e6;

function fmtF(f: number): string {
  if (f >= 1e6) return `${+(f / 1e6).toFixed(1)} MHz`;
  if (f >= 1e3) return `${+(f / 1e3).toFixed(1)} kHz`;
  return `${+f.toFixed(1)} Hz`;
}

export default function AcDialog({ rd, onClose }: { rd: ResolvedDesign; onClose: () => void }) {
  // candidates: every block terminal, grouped per instance (termNet resolves these reliably)
  const groups = useMemo(() =>
    rd.instances.map((i) => ({ ref: i.ref, name: i.def.name, terms: i.def.terminals.map((t) => `${i.ref}.${t.id}`) })),
  [rd]);
  const flatTerms = useMemo(() => groups.flatMap((g) => g.terms), [groups]);
  const [from, setFrom] = useState<string>(flatTerms[0] ?? "");
  const [to, setTo] = useState<string>(flatTerms[1] ?? "");

  const result = useMemo(() => {
    if (!from || !to || from === to) return null;
    try { return frequencyResponse(rd, from, to, logSweep(F_START, F_END, 16)); }
    catch (e) { return { error: String(e).slice(0, 160) }; }
  }, [rd, from, to]);

  const plot = useMemo(() => {
    if (!result || "error" in result) return null;
    const pts = result.points;
    const W = 520, H = 200, PAD = { l: 44, r: 14, t: 10, b: 22 };
    const x = (f: number) => PAD.l + ((Math.log10(f) - Math.log10(F_START)) / (Math.log10(F_END) - Math.log10(F_START))) * (W - PAD.l - PAD.r);
    const dbs = pts.map((p) => p.db);
    const dbMax = Math.min(10, Math.max(5, Math.ceil(Math.max(...dbs) / 10) * 10));
    const dbMin = Math.max(-100, Math.min(-40, Math.floor(Math.min(...dbs.filter((d) => isFinite(d))) / 20) * 20));
    const y = (db: number) => PAD.t + ((dbMax - Math.max(db, dbMin)) / (dbMax - dbMin)) * (H - PAD.t - PAD.b);
    const yPh = (deg: number) => PAD.t + ((180 - deg) / 360) * (H - PAD.t - PAD.b);
    const magPath = pts.map((p, i) => `${i ? "L" : "M"}${x(p.f).toFixed(1)},${y(p.db).toFixed(1)}`).join(" ");
    const phPath = pts.map((p, i) => `${i ? "L" : "M"}${x(p.f).toFixed(1)},${yPh(p.phaseDeg).toFixed(1)}`).join(" ");
    const peak = pts.reduce((m, p) => (p.mag > m.mag ? p : m), pts[0]);
    // the −3 dB corner, log-interpolated between samples (the nearest-sample value read up to
    // 15% high at 16 pts/decade — a number on screen has to be the real one)
    const target = peak.mag * Math.SQRT1_2;
    let corner: { f: number; db: number } | undefined;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].f < peak.f || !(pts[i - 1].mag > target && pts[i].mag <= target)) continue;
      const t = (Math.log10(pts[i - 1].mag) - Math.log10(target)) / (Math.log10(pts[i - 1].mag) - Math.log10(pts[i].mag));
      const f = 10 ** (Math.log10(pts[i - 1].f) + t * (Math.log10(pts[i].f) - Math.log10(pts[i - 1].f)));
      corner = { f, db: 20 * Math.log10(target) };
      break;
    }
    const decades: number[] = [];
    for (let d = Math.log10(F_START); d <= Math.log10(F_END); d++) decades.push(10 ** d);
    return { W, H, PAD, x, y, magPath, phPath, corner, peak, decades, dbMax, dbMin };
  }, [result]);

  const sel = "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-[12px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
          <span className="text-[15px] font-bold text-[var(--color-text)]">Frequency response</span>
          <span className="text-[11px] text-[var(--color-faint)]">H(jω) of your actual schematic — not a textbook curve</span>
          <button onClick={onClose} className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-[var(--color-faint)] hover:text-[var(--color-text)]">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-[12px] text-[var(--color-dim)]">In</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={sel}>
              {groups.map((g) => <optgroup key={g.ref} label={`${g.ref} · ${g.name}`}>{g.terms.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>)}
            </select>
            <span className="text-[var(--color-faint)]">→</span>
            <label className="text-[12px] text-[var(--color-dim)]">Out</label>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={sel}>
              {groups.map((g) => <optgroup key={g.ref} label={`${g.ref} · ${g.name}`}>{g.terms.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>)}
            </select>
          </div>

          {!result ? (
            <p className="mt-6 text-[13px] text-[var(--color-dim)]">Pick two different points — the input is driven with 1 V AC, the output read relative to ground.</p>
          ) : "error" in result ? (
            <p className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-[13px] text-[var(--color-dim)]">{result.error}</p>
          ) : plot && (
            <>
              <svg viewBox={`0 0 ${plot.W} ${plot.H}`} className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
                {plot.decades.map((f) => (
                  <g key={f}>
                    <line x1={plot.x(f)} y1={plot.PAD.t} x2={plot.x(f)} y2={plot.H - plot.PAD.b} stroke="var(--color-border)" strokeWidth=".6" />
                    <text x={plot.x(f)} y={plot.H - 7} textAnchor="middle" fontSize="8.5" fill="var(--color-faint)" fontFamily="var(--font-mono)">{fmtF(f)}</text>
                  </g>
                ))}
                {[0, -20, -40, -60].filter((d) => d >= plot.dbMin && d <= plot.dbMax).map((d) => (
                  <g key={d}>
                    <line x1={plot.PAD.l} y1={plot.y(d)} x2={plot.W - plot.PAD.r} y2={plot.y(d)} stroke="var(--color-border)" strokeWidth=".6" strokeDasharray="3 3" />
                    <text x={plot.PAD.l - 5} y={plot.y(d) + 3} textAnchor="end" fontSize="8.5" fill="var(--color-faint)" fontFamily="var(--font-mono)">{d} dB</text>
                  </g>
                ))}
                <path d={plot.phPath} fill="none" stroke="var(--color-faint)" strokeWidth="1" strokeDasharray="4 3" opacity=".7" />
                <path d={plot.magPath} fill="none" stroke="var(--color-accent)" strokeWidth="1.8" />
                {plot.corner && (
                  <g>
                    <circle cx={plot.x(plot.corner.f)} cy={plot.y(plot.corner.db)} r="3.5" fill="none" stroke="#46dca6" strokeWidth="1.5" />
                    <text x={plot.x(plot.corner.f) + 6} y={plot.y(plot.corner.db) - 6} fontSize="9" fill="#46dca6" fontFamily="var(--font-mono)">−3 dB ≈ {fmtF(plot.corner.f)}</text>
                  </g>
                )}
              </svg>
              <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-faint)]">
                <span><span className="mr-1 inline-block h-[3px] w-4 align-middle" style={{ background: "var(--color-accent)" }} /> magnitude</span>
                <span><span className="mr-1 inline-block h-0 w-4 border-t border-dashed border-[var(--color-faint)] align-middle" /> phase (±180°)</span>
                <span className="ml-auto font-mono">peak |H| {plot.peak.mag >= 0.99 ? "1.0 (passband)" : plot.peak.mag.toFixed(3)} @ {fmtF(plot.peak.f)}</span>
              </div>
              <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-[11.5px] leading-relaxed text-[var(--color-dim)]">
                {result.notes.map((n, i) => <div key={i}>· {n}</div>)}
                <div>· Exact math on R, C, and L at each frequency — closed-form, not simulation.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
