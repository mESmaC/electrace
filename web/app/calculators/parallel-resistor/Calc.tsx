"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";
import { nearestE, fmtOhms } from "@/lib/eseries";

export default function Calc() {
  const [rs, setRs] = useState<number[]>([10000, 10000]);
  const set = (i: number, v: number) => setRs(rs.map((r, j) => (j === i ? v : r)));
  const valid = rs.filter((r) => r > 0);
  const par = valid.length ? 1 / valid.reduce((a, r) => a + 1 / r, 0) : NaN;
  const ser = valid.reduce((a, r) => a + r, 0);
  const [target, setTarget] = useState(2500);
  const [have, setHave] = useState(10000);
  const need = (target * have) / (have - target);
  const needStd = nearestE(need, "E24");
  const got = (have * needStd) / (have + needStd);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          {rs.map((r, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1"><Num label={`R${i + 1}`} value={r} onChange={(v) => set(i, v)} unit="Ω" step={100} /></div>
              {rs.length > 2 && <button onClick={() => setRs(rs.filter((_, j) => j !== i))} className="rounded-lg border border-border-strong px-2.5 py-2 text-[13px] text-faint hover:text-text">✕</button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Preset label="+ add resistor" onClick={() => setRs([...rs, 10000])} />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Out label={`Parallel (${valid.length} resistors)`} value={fmtOhms(par)} strong note="1 / (1/R1 + 1/R2 + …)" />
          <Out label="Series (same set)" value={fmtOhms(ser)} />
          {valid.length === 2 && <Out label="Sanity check" value={fmtOhms((valid[0] * valid[1]) / (valid[0] + valid[1]))} note="two-resistor shortcut: product / sum" />}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Reverse: what do I parallel with what I have?</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Target combined value" value={target} onChange={setTarget} unit="Ω" step={100} />
            <Num label="Resistor you already have" value={have} onChange={setHave} unit="Ω" step={100} />
          </div>
          <div className="flex flex-col gap-2.5">
            {target > 0 && have > target ? <>
              <Out label="Parallel this (exact)" value={fmtOhms(need)} />
              <Out label="Nearest standard (E24)" value={fmtOhms(needStd)} strong />
              <Out label="Actual combined" value={fmtOhms(got)} note={`${(((got - target) / target) * 100).toFixed(1)}% off target`} />
            </> : <Out label="Target must be below the resistor you have" value="—" warn note="parallel only ever DECREASES resistance" />}
          </div>
        </div>
      </div>
    </div>
  );
}
