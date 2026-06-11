import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "delta-wye",
  title: "Delta-Wye (Δ-Y) Conversion Calculator",
  h1: "Delta ↔ wye conversion calculator",
  tagline: "Transform a resistor triangle into an equivalent star and back — the unlock for bridges and three-phase networks.",
  faq: [
    { q: "Why would I ever need this?", a: "Whenever series/parallel reduction gets stuck. A Wheatstone bridge, for example, has no two resistors purely in series or parallel — convert one triangle of it to a Y and the rest collapses with ordinary series/parallel math. In three-phase power it's not even a trick; delta and wye are the two physical ways sources and loads actually connect." },
    { q: "Is the equivalence exact?", a: "Exact at the three terminals — any measurement you make from outside (any pair-wise resistance, any applied source) cannot tell the two networks apart. Inside is a different story: the Y has a center node the delta simply doesn't have, so internal voltages aren't comparable." },
    { q: "Balanced case shortcut?", a: "When all three are equal: R_Y = R_Δ/3, and R_Δ = 3·R_Y. A 300 Ω delta is a 100 Ω wye. For three-phase machines this ratio is why delta termination raises a motor's Kv by √3 in voltage terms — related math, same triangle." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>Δ→Y: each star leg is the product of the two delta sides touching that node, over the sum of all three: <code>Ra = R(A–B)·R(C–A) / (R(A–B)+R(B–C)+R(C–A))</code>. Y→Δ: each delta side is the sum of the leg pair-products over the <em>opposite</em> leg. Derive either by equating the terminal-pair resistances and the symmetry does the rest.</p>
      </>
    }><Calc /></CalcShell>
  );
}
