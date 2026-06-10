"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { fmtOhms } from "@/lib/eseries";

export default function Calc() {
  const [r25, setR25] = useState(10000);
  const [b, setB] = useState(3950);
  const [rfix, setRfix] = useState(10000);
  const [bits, setBits] = useState(12);
  const full = 2 ** Math.max(1, Math.min(16, Math.round(bits))) - 1;
  const rows = [];
  for (let t = -20; t <= 100; t += 10) {
    const rT = r25 * Math.exp(b * (1 / (t + 273.15) - 1 / 298.15));
    const ratio = rfix / (rfix + rT); // NTC on top, fixed R on the bottom — output rises with temperature
    rows.push({ t, rT, ratio, counts: Math.round(ratio * full) });
  }
  const ok = r25 > 0 && b > 0 && rfix > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-2xl border border-border bg-surface-2 p-4 sm:grid-cols-4">
        <Num label="NTC R at 25 °C" value={r25} onChange={setR25} unit="Ω" step={100} />
        <Num label="Beta (B25/85)" value={b} onChange={setB} step={50} />
        <Num label="Fixed resistor" value={rfix} onChange={setRfix} unit="Ω" step={100} />
        <Num label="ADC bits" value={bits} onChange={setBits} step={1} min={8} />
      </div>
      {ok ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border bg-surface-2 text-left">
              <th className="px-3 py-2 font-semibold">Temp</th><th className="px-3 py-2 font-semibold">NTC resistance</th>
              <th className="px-3 py-2 font-semibold">Vout / Vcc</th><th className="px-3 py-2 font-semibold">ADC counts</th>
            </tr></thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr key={r.t} className={`border-b border-border last:border-0 ${r.t === 20 ? "bg-accent/5" : ""}`}>
                  <td className="px-3 py-1.5">{r.t} °C</td><td className="px-3 py-1.5">{fmtOhms(r.rT)}</td>
                  <td className="px-3 py-1.5">{r.ratio.toFixed(3)}</td><td className="px-3 py-1.5">{r.counts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Out label="All values must be positive" value="—" warn />}
      <p className="text-[12px] text-faint">Wired NTC-on-top (the reading rises with temperature). The B-equation is accurate to ~±1 °C over 0–70 °C; use a Steinhart–Hart fit beyond that.</p>
    </div>
  );
}
