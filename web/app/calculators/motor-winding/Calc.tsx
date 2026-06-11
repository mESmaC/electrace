"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";

// All exact relationships, SI: Kt [Nm/A] = 60/(2π·Kv[rpm/V]) ≈ 9.5493/Kv. Rewind: Kv ∝ 1/turns.
// Termination: Kv(delta) = √3 × Kv(wye). AWG: d[mm] = 0.127·92^((36−n)/39); ρ_cu = 1.724e-8 Ω·m.
const KT = (kv: number) => 9.5493 / kv;
const awgDia = (n: number) => 0.127 * Math.pow(92, (36 - n) / 39); // mm
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export default function Calc() {
  const [kv, setKv] = useState(900);
  const [volts, setVolts] = useState(22.2);
  const [amps, setAmps] = useState(20);
  const ok = kv > 0;
  const kt = KT(kv);

  const [turnsOld, setTurnsOld] = useState(12);
  const [turnsNew, setTurnsNew] = useState(14);
  const [term, setTerm] = useState<"same" | "wye2delta" | "delta2wye">("same");
  const termK = term === "wye2delta" ? Math.sqrt(3) : term === "delta2wye" ? 1 / Math.sqrt(3) : 1;
  const kvNew = kv * (turnsOld / turnsNew) * termK;

  const [slots, setSlots] = useState(12);
  const [poles, setPoles] = useState(14);
  const cogging = slots > 0 && poles > 0 ? (slots * poles) / gcd(slots, poles) : 0;

  const [awg, setAwg] = useState(26);
  const [strands, setStrands] = useState(2);
  const [wireM, setWireM] = useState(3);
  const dia = awgDia(awg);
  const areaM2 = Math.PI * Math.pow((dia / 1000) / 2, 2) * Math.max(1, strands);
  const ohmPerM = 1.724e-8 / areaM2;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label="Motor Kv" value={kv} onChange={setKv} unit="rpm/V" step={50} />
          <Num label="Supply voltage" value={volts} onChange={setVolts} unit="V" step={0.1} />
          <Num label="Motor current" value={amps} onChange={setAmps} unit="A" step={1} />
          <div className="flex flex-wrap gap-1.5">
            <Preset label="Drone 2207 (1750Kv, 4S)" onClick={() => { setKv(1750); setVolts(14.8); setAmps(30); }} />
            <Preset label="E-skate 6374 (190Kv, 10S)" onClick={() => { setKv(190); setVolts(37); setAmps(40); }} />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {ok ? <>
            <Out label="Torque constant Kt" value={`${(kt * 1000).toFixed(2)} mNm/A`} strong note="Kt = 9.549 / Kv — the same constant as Kv, seen from the torque side" />
            <Out label="No-load speed" value={`${Math.round(kv * volts).toLocaleString()} rpm`} note="Kv × V (ideal — real motors sit a little under)" />
            <Out label={`Torque at ${amps} A`} value={`${(kt * amps * 1000).toFixed(0)} mNm`} note="Kt × I, before friction and saturation" />
            <Out label="Back-EMF per 1000 rpm" value={`${(1000 / kv).toFixed(2)} V`} />
          </> : <Out label="Kv must be positive" value="—" warn />}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Rewind: turns &amp; termination → new Kv</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Turns per tooth (current)" value={turnsOld} onChange={setTurnsOld} step={1} min={1} />
            <Num label="Turns per tooth (new)" value={turnsNew} onChange={setTurnsNew} step={1} min={1} />
            <div className="flex flex-wrap gap-1.5">
              <Preset label="Same termination" active={term === "same"} onClick={() => setTerm("same")} />
              <Preset label="Wye → Delta" active={term === "wye2delta"} onClick={() => setTerm("wye2delta")} />
              <Preset label="Delta → Wye" active={term === "delta2wye"} onClick={() => setTerm("delta2wye")} />
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {turnsOld > 0 && turnsNew > 0 ? <>
              <Out label="New Kv" value={`${Math.round(kvNew)} rpm/V`} strong note={`Kv × ${turnsOld}/${turnsNew}${term !== "same" ? (term === "wye2delta" ? " × √3" : " ÷ √3") : ""}`} />
              <Out label="New Kt" value={`${(KT(kvNew) * 1000).toFixed(2)} mNm/A`} note="more turns → lower Kv → more torque per amp (not per watt)" />
            </> : <Out label="Turns must be positive" value="—" warn />}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-[13px] font-bold">Stator &amp; wire</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Num label="Stator slots" value={slots} onChange={setSlots} step={1} min={3} />
            <Num label="Magnet poles" value={poles} onChange={setPoles} step={2} min={2} />
            <Num label="Wire gauge (AWG)" value={awg} onChange={setAwg} step={1} min={10} />
            <Num label="Parallel strands" value={strands} onChange={setStrands} step={1} min={1} />
            <Num label="Wire per phase" value={wireM} onChange={setWireM} unit="m" step={0.5} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Out label="Cogging steps per revolution" value={`${cogging || "—"}`} note="LCM(slots, poles) — higher = smoother, finer detents" />
            <Out label="Electrical revs per mech rev" value={`${poles / 2}`} note="pole pairs — what your ESC actually commutates" />
            <Out label={`AWG ${awg} diameter`} value={`${dia.toFixed(3)} mm`} note={strands > 1 ? `${strands} strands ≈ one AWG ${Math.round(awg - Math.log10(strands) / Math.log10(92 ** (2 / 39)))} equivalent` : "bare copper, excludes enamel"} />
            <Out label="Phase resistance (copper, 20°C)" value={`${(ohmPerM * wireM * 1000).toFixed(1)} mΩ`} note={`${(ohmPerM * 1000).toFixed(2)} mΩ/m × ${wireM} m — I²R: ${(amps * amps * ohmPerM * wireM).toFixed(1)} W lost here at ${amps} A`} />
          </div>
        </div>
      </div>
    </div>
  );
}
