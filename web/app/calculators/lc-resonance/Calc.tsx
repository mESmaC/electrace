"use client";
import { useState } from "react";
import { Num, Out } from "../ui";

const fmtF = (hz: number) => hz >= 1e6 ? `${(hz / 1e6).toFixed(3)} MHz` : hz >= 1e3 ? `${(hz / 1e3).toFixed(3)} kHz` : `${hz.toFixed(1)} Hz`;

export default function Calc() {
  const [luH, setLuH] = useState(10);    // µH
  const [cnF, setCnF] = useState(100);   // nF
  const [fkHz, setFkHz] = useState(100); // kHz
  const L = luH * 1e-6, C = cnF * 1e-9, f = fkHz * 1e3;
  const ok = L > 0 && C > 0 && f > 0;
  const xl = 2 * Math.PI * f * L;
  const xc = 1 / (2 * Math.PI * f * C);
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const z0 = Math.sqrt(L / C);

  const [la, setLa] = useState(10), [lb, setLb] = useState(22); // µH
  const [ca, setCa] = useState(10), [cb, setCb] = useState(22); // nF
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="Inductance" value={luH} onChange={setLuH} unit="µH" step={1} />
          <Num label="Capacitance" value={cnF} onChange={setCnF} unit="nF" step={10} />
          <Num label="Frequency" value={fkHz} onChange={setFkHz} unit="kHz" step={10} />
        </div>
        <div className="flex flex-col gap-2.5">
          {ok ? <>
            <Out label="Resonant frequency" value={fmtF(f0)} strong note="f₀ = 1 / (2π√LC) — where XL and XC cancel exactly" />
            <Out label={`XL at ${fkHz} kHz`} value={`${xl.toFixed(2)} Ω`} note="2πfL — grows with frequency" />
            <Out label={`XC at ${fkHz} kHz`} value={`${xc.toFixed(2)} Ω`} note="1/(2πfC) — shrinks with frequency" />
            <Out label="Characteristic impedance" value={`${z0.toFixed(2)} Ω`} note="√(L/C) — the reactance of either part AT resonance" />
          </> : <Out label="All inputs must be positive" value="—" warn />}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Series &amp; parallel combinations</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="L1" value={la} onChange={setLa} unit="µH" step={1} />
            <Num label="L2" value={lb} onChange={setLb} unit="µH" step={1} />
            <Num label="C1" value={ca} onChange={setCa} unit="nF" step={1} />
            <Num label="C2" value={cb} onChange={setCb} unit="nF" step={1} />
          </div>
          <div className="flex flex-col gap-2.5">
            {la > 0 && lb > 0 && ca > 0 && cb > 0 ? <>
              <Out label="Inductors in series" value={`${(la + lb).toFixed(1)} µH`} note="L1 + L2 — like resistors (no mutual coupling assumed)" />
              <Out label="Inductors in parallel" value={`${((la * lb) / (la + lb)).toFixed(2)} µH`} note="product / sum — like resistors" />
              <Out label="Capacitors in parallel" value={`${(ca + cb).toFixed(1)} nF`} note="C1 + C2 — caps are the mirror image" />
              <Out label="Capacitors in series" value={`${((ca * cb) / (ca + cb)).toFixed(2)} nF`} note="product / sum — and the pair survives less voltage than you hope" />
            </> : <Out label="All values must be positive" value="—" warn />}
          </div>
        </div>
      </div>
    </div>
  );
}
