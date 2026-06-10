"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { nearestE, fmtOhms } from "@/lib/eseries";

export default function Calc() {
  const [vin, setVin] = useState(12);
  const [r1, setR1] = useState(10000);
  const [r2, setR2] = useState(10000);
  const vout = (vin * r2) / (r1 + r2);
  const zout = (r1 * r2) / (r1 + r2);
  const i = vin / (r1 + r2);
  const [tVout, setTVout] = useState(3.3);
  const [tR1, setTR1] = useState(10000);
  const tR2 = (tR1 * tVout) / (vin - tVout);
  const tStd = nearestE(tR2, "E24");
  const tActual = (vin * tStd) / (tR1 + tStd);
  const ok = vin > 0 && r1 > 0 && r2 > 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="Input voltage" value={vin} onChange={setVin} unit="V" />
          <Num label="R1 (top)" value={r1} onChange={setR1} unit="Ω" step={100} />
          <Num label="R2 (bottom)" value={r2} onChange={setR2} unit="Ω" step={100} />
        </div>
        <div className="flex flex-col gap-2.5">
          {ok ? <>
            <Out label="Output voltage" value={`${vout.toFixed(3)} V`} strong note="Vin · R2 / (R1 + R2)" />
            <Out label="Output impedance" value={fmtOhms(zout)} note="R1 ∥ R2 — what a load actually sees" />
            <Out label="Divider current (always flowing)" value={i >= 0.001 ? `${(i * 1000).toFixed(2)} mA` : `${(i * 1e6).toFixed(1)} µA`} warn={i > 0.001} note={i > 0.001 ? "battery-powered? consider 10× larger resistors" : undefined} />
          </> : <Out label="All values must be positive" value="—" warn />}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Reverse: find R2 for a target output</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Target output" value={tVout} onChange={setTVout} unit="V" />
            <Num label="Chosen R1" value={tR1} onChange={setTR1} unit="Ω" step={100} />
          </div>
          <div className="flex flex-col gap-2.5">
            {tVout > 0 && tVout < vin && tR1 > 0 ? <>
              <Out label="Exact R2" value={fmtOhms(tR2)} />
              <Out label="Nearest standard (E24)" value={fmtOhms(tStd)} strong />
              <Out label="Actual output with it" value={`${tActual.toFixed(3)} V`} note={`${(((tActual - tVout) / tVout) * 100).toFixed(1)}% off target`} />
            </> : <Out label="Target must be between 0 and Vin" value="—" warn />}
          </div>
        </div>
      </div>
    </div>
  );
}
