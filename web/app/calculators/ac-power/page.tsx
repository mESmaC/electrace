import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "ac-power",
  title: "AC Power & Power Factor Calculator",
  h1: "AC power & power factor calculator",
  tagline: "Real, reactive, and apparent power — single and three phase — plus PF correction sizing and efficiency.",
  faq: [
    { q: "If reactive power 'returns every cycle', why does anyone care?", a: "Because the CURRENT that carries it is real: it heats wires, fills transformer capacity, and trips breakers exactly like working current. A 0.7-PF load draws ~43% more current than a unity-PF load doing the same work — that's why utilities bill industry for poor PF, and why your wiring is sized in kVA, not kW." },
    { q: "Where does √3 come from in three-phase?", a: "Line-to-line voltage versus phase voltage. Three 120°-shifted phases mean V_LL = √3 × V_LN, and the power algebra inherits it: P = √3 × V_LL × I_L × PF. Use line-to-line voltage with line current and the √3 form is always self-consistent for balanced loads." },
    { q: "Can I just bolt the correction capacitor across any load?", a: "It must be sized for THIS load at THIS operating point — an oversized cap over-corrects into a leading PF, which is its own problem. Motors that vary load (compressors) often need switched banks. And the cap sees full line voltage forever: use proper X2/motor-run rated parts, never generic electrolytics." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>The power triangle: apparent power <code>S = V×I</code> is the hypotenuse, real power <code>P = S·cosφ</code> does the work, reactive power <code>Q = √(S²−P²)</code> sloshes between the source and the load&apos;s fields. Power factor is just <code>cos φ</code> — the fraction of the current that&apos;s actually working. Correction adds the opposite reactance so the sloshing happens locally in the capacitor instead of through every wire upstream: <code>Q_C = P(tanφ₁ − tanφ₂)</code>, <code>C = Q_C/(2πfV²)</code>.</p>
      </>
    }><Calc /></CalcShell>
  );
}
