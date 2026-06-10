"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";
import { fmtOhms } from "@/lib/eseries";

type Solve = "R" | "V" | "I";
const fmtI = (a: number) => !isFinite(a) ? "—" : a >= 1 ? `${+a.toFixed(3)} A` : a >= 1e-3 ? `${+(a * 1e3).toFixed(2)} mA` : `${+(a * 1e6).toFixed(1)} µA`;
const fmtP = (w: number) => !isFinite(w) ? "—" : w >= 1 ? `${+w.toFixed(2)} W` : `${+(w * 1e3).toFixed(1)} mW`;

export default function Calc() {
  const [solve, setSolve] = useState<Solve>("R");
  const [v, setV] = useState(5);
  const [iMa, setIMa] = useState(20);
  const [r, setR] = useState(250);
  const i = iMa / 1000;
  const out = solve === "R" ? { R: v / i, V: v, I: i } : solve === "V" ? { R: r, V: i * r, I: i } : { R: r, V: v, I: v / r };
  const p = out.V * out.I;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">Solve for</div>
          <div className="flex gap-1.5">
            {(["R", "V", "I"] as Solve[]).map((m) => <Preset key={m} label={m === "R" ? "Resistance" : m === "V" ? "Voltage" : "Current"} active={solve === m} onClick={() => setSolve(m)} />)}
          </div>
        </div>
        {solve !== "V" && <Num label="Voltage" value={v} onChange={setV} unit="V" />}
        {solve !== "I" && <Num label="Current" value={iMa} onChange={setIMa} unit="mA" step={1} />}
        {solve !== "R" && <Num label="Resistance" value={r} onChange={setR} unit="Ω" step={10} />}
      </div>
      <div className="flex flex-col gap-2.5">
        <Out label="Resistance" value={fmtOhms(out.R)} strong={solve === "R"} note={solve === "R" ? "R = V / I" : undefined} />
        <Out label="Voltage" value={`${+out.V.toFixed(3)} V`} strong={solve === "V"} note={solve === "V" ? "V = I · R" : undefined} />
        <Out label="Current" value={fmtI(out.I)} strong={solve === "I"} note={solve === "I" ? "I = V / R" : undefined} />
        <Out label="Power dissipated" value={fmtP(p)} warn={p > 0.25} note={p > 0.25 ? "over ¼ W — check the part's rating" : "P = V · I"} />
      </div>
    </div>
  );
}
