"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";
import { nearestE, fmtOhms } from "@/lib/eseries";

const COLORS: [string, number][] = [["Red", 2.0], ["Yellow", 2.1], ["Green", 3.1], ["Blue", 3.3], ["White", 3.3]];

export default function Calc() {
  const [vs, setVs] = useState(5);
  const [vf, setVf] = useState(2.0);
  const [ima, setIma] = useState(10);
  const drop = vs - vf;
  const r = drop / (ima / 1000);
  const rStd = nearestE(r, "E24", "up"); // round UP — slightly dimmer beats slightly fried
  const iActual = (drop / rStd) * 1000;
  const p = (drop * drop) / rStd;
  const bad = !(vs > 0) || !(ima > 0) || drop <= 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
        <Num label="Supply voltage" value={vs} onChange={setVs} unit="V" />
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-faint">LED forward voltage</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {COLORS.map(([c, v]) => <Preset key={c} label={`${c} ${v} V`} active={vf === v} onClick={() => setVf(v)} />)}
          </div>
          <Num label="" value={vf} onChange={setVf} unit="V" />
        </div>
        <Num label="LED current" value={ima} onChange={setIma} unit="mA" step={1} />
      </div>
      <div className="flex flex-col gap-2.5">
        {bad
          ? <Out label="Supply must exceed the LED's forward voltage" value="—" warn />
          : <>
              <Out label="Exact resistance" value={fmtOhms(r)} note="(Vs − Vf) / I" />
              <Out label="Use this standard value (E24)" value={fmtOhms(rStd)} strong note="rounded up — dimmer beats fried" />
              <Out label="Actual current with it" value={`${iActual.toFixed(1)} mA`} />
              <Out label="Resistor dissipation" value={`${(p * 1000).toFixed(0)} mW`} warn={p > 0.1} note={p > 0.1 ? "over 1/10 W — use a 1/4 W part" : "fine for an 0603/1/10 W part"} />
            </>}
      </div>
    </div>
  );
}
