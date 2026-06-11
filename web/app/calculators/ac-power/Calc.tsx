"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";

export default function Calc() {
  const [phase, setPhase] = useState<1 | 3>(1);
  const [v, setV] = useState(230);   // single: line-neutral · three: line-line
  const [i, setI] = useState(10);
  const [pf, setPf] = useState(0.8);
  const k = phase === 3 ? Math.sqrt(3) : 1;
  const ok = v > 0 && i > 0 && pf > 0 && pf <= 1;
  const s = k * v * i;            // apparent [VA]
  const p = s * pf;               // real [W]
  const q = Math.sqrt(Math.max(0, s * s - p * p)); // reactive [var]
  const phi = (Math.acos(pf) * 180) / Math.PI;

  const [pfTarget, setPfTarget] = useState(0.95);
  const [hz, setHz] = useState(50);
  const qc = ok && pfTarget > pf && pfTarget <= 1 ? p * (Math.tan(Math.acos(pf)) - Math.tan(Math.acos(pfTarget))) : 0;
  const corrC = phase === 1 && qc > 0 ? qc / (2 * Math.PI * hz * v * v) : 0;

  const [pin, setPin] = useState(1000), [pout, setPout] = useState(870);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <div className="flex flex-wrap gap-1.5">
            <Preset label="Single-phase" active={phase === 1} onClick={() => setPhase(1)} />
            <Preset label="Three-phase" active={phase === 3} onClick={() => setPhase(3)} />
          </div>
          <Num label={phase === 3 ? "Line-to-line voltage" : "Voltage (RMS)"} value={v} onChange={setV} unit="V" step={5} />
          <Num label={phase === 3 ? "Line current" : "Current (RMS)"} value={i} onChange={setI} unit="A" step={1} />
          <Num label="Power factor (cos φ)" value={pf} onChange={setPf} step={0.05} />
        </div>
        <div className="flex flex-col gap-2.5">
          {ok ? <>
            <Out label="Real power P" value={`${(p / 1000).toFixed(2)} kW`} strong note={`${phase === 3 ? "√3 × " : ""}V × I × PF — what does work and makes heat`} />
            <Out label="Apparent power S" value={`${(s / 1000).toFixed(2)} kVA`} note={`${phase === 3 ? "√3 × " : ""}V × I — what your wiring and transformer must carry`} />
            <Out label="Reactive power Q" value={`${(q / 1000).toFixed(2)} kvar`} note="√(S² − P²) — borrowed and returned every cycle, but the current is real" />
            <Out label="Phase angle φ" value={`${phi.toFixed(1)}°`} note="cos⁻¹(PF)" />
          </> : <Out label="Need V, I > 0 and 0 < PF ≤ 1" value="—" warn />}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Power-factor correction (single-phase)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Target power factor" value={pfTarget} onChange={setPfTarget} step={0.01} />
            <Num label="Line frequency" value={hz} onChange={setHz} unit="Hz" step={10} />
          </div>
          <div className="flex flex-col gap-2.5">
            {phase === 3 ? <Out label="Shown for single-phase only" value="—" note="three-phase correction is per-phase/bank design — same Q math, more bookkeeping" warn />
              : qc > 0 ? <>
                <Out label="Reactive power to cancel" value={`${(qc / 1000).toFixed(2)} kvar`} strong note="P × (tan φ₁ − tan φ₂)" />
                <Out label="Correction capacitor" value={`${(corrC * 1e6).toFixed(1)} µF`} note="C = Q / (2πf·V²) — across the line, rated for it" />
              </> : <Out label="Target must be above the current PF" value="—" warn />}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Efficiency</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Power in" value={pin} onChange={setPin} unit="W" step={10} />
            <Num label="Power out" value={pout} onChange={setPout} unit="W" step={10} />
          </div>
          <div className="flex flex-col gap-2.5">
            {pin > 0 && pout >= 0 && pout <= pin ? <>
              <Out label="Efficiency" value={`${((pout / pin) * 100).toFixed(1)} %`} strong note="Pout / Pin" />
              <Out label="Lost as heat" value={`${(pin - pout).toFixed(0)} W`} note="the difference always becomes heat — size the cooling for THIS number" />
            </> : <Out label="Need 0 ≤ Pout ≤ Pin" value="—" warn />}
          </div>
        </div>
      </div>
    </div>
  );
}
