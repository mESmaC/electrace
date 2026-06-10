"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { fmtOhms } from "@/lib/eseries";

const fmtF = (hz: number) => !isFinite(hz) ? "—" : hz >= 1e6 ? `${+(hz / 1e6).toFixed(3)} MHz` : hz >= 1e3 ? `${+(hz / 1e3).toFixed(3)} kHz` : `${+hz.toFixed(2)} Hz`;
const fmtT = (s: number) => !isFinite(s) ? "—" : s >= 1 ? `${+s.toFixed(3)} s` : s >= 1e-3 ? `${+(s * 1e3).toFixed(2)} ms` : `${+(s * 1e6).toFixed(1)} µs`;

export default function Calc() {
  const [ra, setRa] = useState(10000);
  const [rb, setRb] = useState(47000);
  const [c, setC] = useState(10); // nF
  const cf = c * 1e-9;
  const f = 1.44 / ((ra + 2 * rb) * cf);
  const tHigh = 0.693 * (ra + rb) * cf;
  const tLow = 0.693 * rb * cf;
  const duty = (ra + rb) / (ra + 2 * rb) * 100;
  const ok = ra > 0 && rb > 0 && c > 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
        <Num label="Ra (pin 7 → VCC)" value={ra} onChange={setRa} unit="Ω" step={100} />
        <Num label="Rb (pin 7 → pins 2/6)" value={rb} onChange={setRb} unit="Ω" step={100} />
        <Num label="Timing capacitor C" value={c} onChange={setC} unit="nF" step={1} />
        <p className="text-[12px] leading-relaxed text-faint">Astable (free-running) mode. Keep Ra ≥ 1k so pin 7 isn&apos;t asked to short the supply, and C ≥ 100 pF so strays don&apos;t dominate.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {ok ? <>
          <Out label="Frequency" value={fmtF(f)} strong note="1.44 / ((Ra + 2Rb) · C)" />
          <Out label="Duty cycle (HIGH share)" value={`${duty.toFixed(1)}%`} warn={duty > 95} note={duty > 95 ? "Ra ≫ Rb pushes duty toward 100% — grow Rb" : "always > 50% in this topology"} />
          <Out label="HIGH time" value={fmtT(tHigh)} note="0.693 · (Ra + Rb) · C" />
          <Out label="LOW time" value={fmtT(tLow)} note="0.693 · Rb · C" />
          <Out label="With these parts" value={`${fmtOhms(ra)} + ${fmtOhms(rb)} + ${c} nF`} />
        </> : <Out label="All values must be positive" value="—" warn />}
      </div>
    </div>
  );
}
