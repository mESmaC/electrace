"use client";
import { useState } from "react";
import { Num, Out, Preset } from "../ui";
import { fmtOhms } from "@/lib/eseries";

export default function Calc() {
  const [mode, setMode] = useState<"d2y" | "y2d">("d2y");
  const [a, setA] = useState(300);  // d2y: Rab, Rbc, Rca · y2d: Ra, Rb, Rc
  const [b, setB] = useState(300);
  const [c, setC] = useState(300);
  const ok = a > 0 && b > 0 && c > 0;
  // Δ→Y: each Y leg = product of the two Δ sides touching its node / sum of all three
  const sumD = a + b + c;
  const ra = (a * c) / sumD, rb = (a * b) / sumD, rc = (b * c) / sumD;
  // Y→Δ: each Δ side = sum of leg pair-products / the OPPOSITE leg
  const pp = a * b + b * c + c * a;
  const rab = pp / c, rbc = pp / a, rca = pp / b;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Preset label="Δ → Y (delta to wye)" active={mode === "d2y"} onClick={() => setMode("d2y")} />
        <Preset label="Y → Δ (wye to delta)" active={mode === "y2d"} onClick={() => setMode("y2d")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
          <Num label={mode === "d2y" ? "R(A–B) — delta side" : "Ra — wye leg at node A"} value={a} onChange={setA} unit="Ω" step={10} />
          <Num label={mode === "d2y" ? "R(B–C) — delta side" : "Rb — wye leg at node B"} value={b} onChange={setB} unit="Ω" step={10} />
          <Num label={mode === "d2y" ? "R(C–A) — delta side" : "Rc — wye leg at node C"} value={c} onChange={setC} unit="Ω" step={10} />
        </div>
        <div className="flex flex-col gap-2.5">
          {!ok ? <Out label="All resistances must be positive" value="—" warn /> : mode === "d2y" ? <>
            <Out label="Ra (leg at node A)" value={fmtOhms(ra)} strong note="R(A–B)·R(C–A) / ΣΔ — the two sides touching A" />
            <Out label="Rb (leg at node B)" value={fmtOhms(rb)} note="R(A–B)·R(B–C) / ΣΔ" />
            <Out label="Rc (leg at node C)" value={fmtOhms(rc)} note="R(B–C)·R(C–A) / ΣΔ" />
          </> : <>
            <Out label="R(A–B)" value={fmtOhms(rab)} strong note="(RaRb + RbRc + RcRa) / Rc — pair-products over the OPPOSITE leg" />
            <Out label="R(B–C)" value={fmtOhms(rbc)} note="(…) / Ra" />
            <Out label="R(C–A)" value={fmtOhms(rca)} note="(…) / Rb" />
          </>}
        </div>
      </div>
    </div>
  );
}
