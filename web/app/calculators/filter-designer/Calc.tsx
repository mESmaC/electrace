"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";
import { nearestE, fmtOhms } from "@/lib/eseries";

// Butterworth pole Qs: stage k of N has Q = 1/(2·sin((2k−1)π/2N)); odd N adds a real pole (plain RC).
// Sallen-Key unity-gain LP with R1=R2=R: ω0 = 1/(R√(C1C2)), Q = √(C1/C2)/2 → C1 = 4Q²·C2.
// Sallen-Key unity-gain HP with C1=C2=C: ω0 = 1/(C√(R1R2)), Q = √(R2/R1)/2 → R2 = 4Q²·R1.
const stageQs = (n: number): (number | null)[] => {
  const out: (number | null)[] = [];
  const pairs = Math.floor(n / 2);
  for (let k = 1; k <= pairs; k++) out.push(1 / (2 * Math.sin(((2 * k - 1) * Math.PI) / (2 * n))));
  if (n % 2) out.push(null); // the real pole — a plain first-order RC stage
  return out.sort((a, b) => (a ?? 0) - (b ?? 0)); // low-Q first: best dynamic range in a real cascade
};
const fmtC = (f: number) => f >= 1e-6 ? `${+(f * 1e6).toFixed(2)} µF` : f >= 1e-9 ? `${+(f * 1e9).toFixed(2)} nF` : `${+(f * 1e12).toFixed(1)} pF`;

export default function Calc() {
  const [n, setN] = useState(4);
  const [mode, setMode] = useState<"lp" | "hp">("lp");
  const [fkHz, setFkHz] = useState(1);
  const [baseN, setBaseN] = useState(10); // LP: C2 per stage (nF) · HP: R1 per stage (kΩ)
  const fc = fkHz * 1e3;
  const w0 = 2 * Math.PI * fc;
  const ok = n >= 2 && n <= 8 && fc > 0 && baseN > 0;
  const qs = stageQs(Math.round(n));

  const stages = qs.map((q, i) => {
    if (q == null) {
      // first-order stage: plain RC at fc
      if (mode === "lp") {
        const c = baseN * 1e-9;
        const r = 1 / (w0 * c);
        const rStd = nearestE(r, "E24");
        return { i, q, parts: `R = ${fmtOhms(rStd)} · C = ${fmtC(c)}`, achieved: `fc ${(1 / (2 * Math.PI * rStd * c) / 1e3).toFixed(3)} kHz`, note: "real pole — plain RC into a buffer" };
      }
      const r = baseN * 1e3;
      const c = 1 / (w0 * r);
      const cStd = nearestE(c, "E12");
      return { i, q, parts: `C = ${fmtC(cStd)} · R = ${fmtOhms(r)}`, achieved: `fc ${(1 / (2 * Math.PI * r * cStd) / 1e3).toFixed(3)} kHz`, note: "real pole — plain CR into a buffer" };
    }
    if (mode === "lp") {
      const c2 = baseN * 1e-9;
      const c1 = nearestE(4 * q * q * c2, "E12");
      const r = nearestE(1 / (w0 * Math.sqrt(c1 * c2)), "E24");
      const aF0 = 1 / (2 * Math.PI * r * Math.sqrt(c1 * c2));
      const aQ = Math.sqrt(c1 / c2) / 2;
      return { i, q, parts: `R1 = R2 = ${fmtOhms(r)} · C1 = ${fmtC(c1)} · C2 = ${fmtC(c2)}`, achieved: `fc ${(aF0 / 1e3).toFixed(3)} kHz · Q ${aQ.toFixed(3)}`, note: `target Q ${q.toFixed(4)}` };
    }
    const r1 = baseN * 1e3;
    const r2 = nearestE(4 * q * q * r1, "E24");
    const c = nearestE(1 / (w0 * Math.sqrt(r1 * r2)), "E12");
    const aF0 = 1 / (2 * Math.PI * c * Math.sqrt(r1 * r2));
    const aQ = Math.sqrt(r2 / r1) / 2;
    return { i, q, parts: `C1 = C2 = ${fmtC(c)} · R1 = ${fmtOhms(r1)} · R2 = ${fmtOhms(r2)}`, achieved: `fc ${(aF0 / 1e3).toFixed(3)} kHz · Q ${aQ.toFixed(3)}`, note: `target Q ${q.toFixed(4)}` };
  });
  const maxQ = Math.max(...qs.map((q) => q ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="Filter order (2–8)" value={n} onChange={setN} step={1} min={2} />
          <Num label="Cutoff frequency" value={fkHz} onChange={setFkHz} unit="kHz" step={0.1} />
          <Num label={mode === "lp" ? "C2 per stage" : "R1 per stage"} value={baseN} onChange={setBaseN} unit={mode === "lp" ? "nF" : "kΩ"} step={1} />
          <div className="flex flex-wrap gap-1.5">
            <Preset label="Low-pass" active={mode === "lp"} onClick={() => setMode("lp")} />
            <Preset label="High-pass" active={mode === "hp"} onClick={() => setMode("hp")} />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {ok ? <>
            <Out label="Response" value={`Butterworth, order ${Math.round(n)}`} strong note="maximally flat passband — the default unless you have a reason" />
            <Out label="Rolloff past cutoff" value={`${Math.round(n) * 20} dB/decade`} note={`${Math.round(n) * 6} dB/octave`} />
            <Out label="Stages to build" value={`${stages.length}`} note="cascaded Sallen-Key biquads (one op-amp each), low-Q first" />
            {maxQ > 2 && <Out label="Component spread warning" value={`Q up to ${maxQ.toFixed(2)}`} warn note={`hottest stage needs a ${Math.round(4 * maxQ * maxQ)}:1 C1/C2 ratio — tolerances bite hardest exactly where the response peaks; consider whether you truly need the order`} />}
          </> : <Out label="Order must be 2–8, inputs positive" value="—" warn />}
        </div>
      </div>
      {ok && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 text-[13px] font-bold">Stage-by-stage (unity-gain Sallen-Key, standard E-series values)</div>
          <div className="flex flex-col gap-2.5">
            {stages.map((s) => (
              <div key={s.i} className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12px] font-bold text-accent">Stage {s.i + 1}</span>
                  <span className="text-[11px] text-faint">{s.note}</span>
                  <span className="ml-auto font-mono text-[11px] text-green">{s.achieved}</span>
                </div>
                <div className="mt-1 font-mono text-[12.5px]">{s.parts}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            Achieved values (green) are recomputed from the snapped standard parts — what your filter will actually do.
            Cascade order matters in practice: lowest-Q stage first keeps internal signals from clipping before the output does.
          </p>
        </div>
      )}
    </div>
  );
}
