"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";

export default function Calc() {
  const [hz, setHz] = useState(60);
  const [poles, setPoles] = useState(4);
  const [rpm, setRpm] = useState(1750);
  const ns = poles > 0 ? (120 * hz) / poles : 0;       // synchronous speed
  const slip = ns > 0 ? ((ns - rpm) / ns) * 100 : 0;   // %
  const fRotor = ns > 0 ? hz * (slip / 100) : 0;

  const [pmech, setPmech] = useState(1500);
  const tau = rpm > 0 ? (9.5493 * pmech) / rpm : 0;    // τ = P/ω

  const [vll, setVll] = useState(400);
  const [il, setIl] = useState(3.2);
  const [pf, setPf] = useState(0.85);
  const pin = Math.sqrt(3) * vll * il * pf;
  const eff = pin > 0 ? (pmech / pin) * 100 : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="Line frequency" value={hz} onChange={setHz} unit="Hz" step={10} />
          <Num label="Poles" value={poles} onChange={setPoles} step={2} min={2} />
          <Num label="Actual (rated) speed" value={rpm} onChange={setRpm} unit="rpm" step={10} />
          <div className="flex flex-wrap gap-1.5">
            <Preset label="60 Hz · 4P · 1750" onClick={() => { setHz(60); setPoles(4); setRpm(1750); }} />
            <Preset label="50 Hz · 2P · 2880" onClick={() => { setHz(50); setPoles(2); setRpm(2880); }} />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {ns > 0 ? <>
            <Out label="Synchronous speed" value={`${Math.round(ns).toLocaleString()} rpm`} strong note="Ns = 120·f / poles — the rotating field itself" />
            <Out label="Slip" value={`${slip.toFixed(2)} %`} note="(Ns − n)/Ns — an induction motor MUST slip to make torque" warn={slip < 0 || slip > 10} />
            <Out label="Rotor frequency" value={`${fRotor.toFixed(2)} Hz`} note="f × slip — what the rotor bars actually see" />
          </> : <Out label="Poles must be positive" value="—" warn />}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Torque, input power &amp; efficiency (three-phase)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Mechanical power out" value={pmech} onChange={setPmech} unit="W" step={50} />
            <Num label="Line-to-line voltage" value={vll} onChange={setVll} unit="V" step={5} />
            <Num label="Line current" value={il} onChange={setIl} unit="A" step={0.1} />
            <Num label="Power factor" value={pf} onChange={setPf} step={0.05} />
          </div>
          <div className="flex flex-col gap-2.5">
            {rpm > 0 && pin > 0 ? <>
              <Out label="Shaft torque" value={`${tau.toFixed(2)} Nm`} strong note="τ = 9.549 × P / n — same constant as the Kv↔Kt identity" />
              <Out label="Electrical power in" value={`${(pin / 1000).toFixed(2)} kW`} note="√3 × V_LL × I_L × PF" />
              <Out label="Efficiency" value={`${eff.toFixed(1)} %`} note="Pmech / Pin" warn={eff > 100} />
            </> : <Out label="Need speed, V, I > 0" value="—" warn />}
          </div>
        </div>
      </div>
    </div>
  );
}
