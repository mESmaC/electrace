"use client";
import { useState } from "react";
import { Num, Out } from "../ui";
import { nearestE, fmtOhms } from "@/lib/eseries";

const fmtF = (hz: number) => !isFinite(hz) ? "—" : hz >= 1e6 ? `${+(hz / 1e6).toFixed(3)} MHz` : hz >= 1e3 ? `${+(hz / 1e3).toFixed(3)} kHz` : `${+hz.toFixed(2)} Hz`;

export default function Calc() {
  const [r, setR] = useState(10000);
  const [c, setC] = useState(100); // nF
  const fc = 1 / (2 * Math.PI * r * c * 1e-9);
  const [tFc, setTFc] = useState(1000);
  const [tC, setTC] = useState(100);
  const needR = 1 / (2 * Math.PI * tFc * tC * 1e-9);
  const stdR = nearestE(needR, "E24");
  const gotFc = 1 / (2 * Math.PI * stdR * tC * 1e-9);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="R" value={r} onChange={setR} unit="Ω" step={100} />
          <Num label="C" value={c} onChange={setC} unit="nF" step={10} />
        </div>
        <div className="flex flex-col gap-2.5">
          {r > 0 && c > 0 ? <>
            <Out label="Cutoff frequency (−3 dB)" value={fmtF(fc)} strong note="1 / (2π · R · C)" />
            <Out label="At the cutoff" value="−3 dB · 45° phase" note="signal is at 70.7%, not gone — rolloff is 20 dB/decade after" />
          </> : <Out label="Both values must be positive" value="—" warn />}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Reverse: pick R for a target cutoff (choose C first — fewer standard values)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Target cutoff" value={tFc} onChange={setTFc} unit="Hz" step={10} />
            <Num label="Chosen C" value={tC} onChange={setTC} unit="nF" step={10} />
          </div>
          <div className="flex flex-col gap-2.5">
            {tFc > 0 && tC > 0 ? <>
              <Out label="Exact R" value={fmtOhms(needR)} />
              <Out label="Nearest standard (E24)" value={fmtOhms(stdR)} strong />
              <Out label="Actual cutoff with it" value={fmtF(gotFc)} note={`${(((gotFc - tFc) / tFc) * 100).toFixed(1)}% off target`} />
            </> : <Out label="Values must be positive" value="—" warn />}
          </div>
        </div>
      </div>
    </div>
  );
}
