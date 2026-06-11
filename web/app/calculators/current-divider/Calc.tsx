"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { fmtOhms } from "@/lib/eseries";

export default function Calc() {
  const [i, setI] = useState(0.1);
  const [r1, setR1] = useState(100);
  const [r2, setR2] = useState(300);
  const ok = i > 0 && r1 > 0 && r2 > 0;
  const i1 = i * r2 / (r1 + r2); // current divides INVERSELY: each branch takes the OTHER's share
  const i2 = i * r1 / (r1 + r2);
  const rp = (r1 * r2) / (r1 + r2);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
        <Num label="Total current in" value={i} onChange={setI} unit="A" step={0.1} />
        <Num label="R1" value={r1} onChange={setR1} unit="Ω" step={10} />
        <Num label="R2" value={r2} onChange={setR2} unit="Ω" step={10} />
      </div>
      <div className="flex flex-col gap-2.5">
        {ok ? <>
          <Out label="Current through R1" value={`${(i1 * 1000).toFixed(1)} mA`} strong note="I × R2/(R1+R2) — the OTHER branch's resistance on top" />
          <Out label="Current through R2" value={`${(i2 * 1000).toFixed(1)} mA`} note="I × R1/(R1+R2)" />
          <Out label="Parallel resistance" value={fmtOhms(rp)} note="R1∥R2 — what the source actually sees" />
          <Out label="Voltage across the pair" value={`${(i * rp).toFixed(2)} V`} note="same across both branches — that's WHY current divides this way" />
        </> : <Out label="All inputs must be positive" value="—" warn />}
      </div>
    </div>
  );
}
