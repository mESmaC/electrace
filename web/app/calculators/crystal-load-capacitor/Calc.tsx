"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { nearestE, fmtCap } from "@/lib/eseries";

export default function Calc() {
  const [cl, setCl] = useState(12.5);
  const [stray, setStray] = useState(3.5);
  const c = 2 * (cl - stray);
  const cStd = nearestE(c, "E12");
  const clActual = cStd / 2 + stray;
  const bad = !(cl > 0) || stray >= cl;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
        <Num label="Crystal's rated load capacitance (CL)" value={cl} onChange={setCl} unit="pF" />
        <Num label="Board stray capacitance" value={stray} onChange={setStray} unit="pF" />
        <p className="text-[12px] leading-relaxed text-faint">Strays are the traces + MCU pin capacitance — typically 2–5 pF on a tight layout. The datasheet CL is on the crystal&apos;s page, usually 8–20 pF.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {bad
          ? <Out label="Strays must be less than CL (and CL > 0)" value="—" warn />
          : <>
              <Out label="Each load cap, exactly" value={fmtCap(c)} note="C = 2 × (CL − Cstray)" />
              <Out label="Use this standard value (×2)" value={fmtCap(cStd)} strong />
              <Out label="Actual CL the crystal sees" value={`${clActual.toFixed(1)} pF`} note={`${Math.abs(clActual - cl) < 0.8 ? "close enough — ppm-level pull" : "noticeably off — consider the other E12 neighbour"}`} warn={Math.abs(clActual - cl) >= 0.8} />
            </>}
      </div>
    </div>
  );
}
