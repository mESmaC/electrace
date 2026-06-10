"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { nearestE, fmtOhms } from "@/lib/eseries";

export default function Calc() {
  const [r1, setR1] = useState(100000);
  const [r2, setR2] = useState(10000);
  const gNon = 1 + r1 / r2;
  const gInv = -(r1 / r2);
  const [target, setTarget] = useState(20);
  const tR1 = (target - 1) * 10000;
  const tStd = nearestE(tR1, "E24");
  const gActual = 1 + tStd / 10000;
  const ok = r1 > 0 && r2 > 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="R1 (feedback)" value={r1} onChange={setR1} unit="Ω" step={1000} />
          <Num label="R2 (to ground / input)" value={r2} onChange={setR2} unit="Ω" step={1000} />
        </div>
        <div className="flex flex-col gap-2.5">
          {ok ? <>
            <Out label="Non-inverting gain" value={`×${gNon.toFixed(2)}`} strong note="1 + R1/R2" />
            <Out label="Inverting gain (same two resistors)" value={`×${gInv.toFixed(2)}`} note="−R1/R2" />
            <Out label="In decibels (non-inv.)" value={`${(20 * Math.log10(gNon)).toFixed(1)} dB`} />
          </> : <Out label="Both resistors must be positive" value="—" warn />}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Reverse: pick resistors for a target gain (non-inverting, R2 = 10 kΩ)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Num label="Target gain" value={target} onChange={setTarget} step={1} />
          <div className="flex flex-col gap-2.5">
            {target > 1 ? <>
              <Out label="R1 (nearest E24)" value={fmtOhms(tStd)} strong />
              <Out label="Actual gain" value={`×${gActual.toFixed(2)}`} note={`${(((gActual - target) / target) * 100).toFixed(1)}% off target`} />
            </> : <Out label="Non-inverting gain can't go below 1 — that's a follower" value="×1" warn />}
          </div>
        </div>
      </div>
    </div>
  );
}
