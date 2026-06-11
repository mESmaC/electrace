import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "current-divider",
  title: "Current Divider Calculator",
  h1: "Current divider calculator",
  tagline: "How current splits between parallel resistors — the mirror image of the voltage divider.",
  blockSlug: "voltage-divider",
  faq: [
    { q: "Why is the OTHER resistor on top of the fraction?", a: "Both branches see the same voltage, so the branch with LESS resistance takes MORE current — division is inverse. I1 = I × R2/(R1+R2): R2 in the numerator because R1's share grows as R2 grows. It's the exact mirror of the voltage divider, where your own resistor sits on top." },
    { q: "Does 'current takes the path of least resistance' mean it all goes one way?", a: "No — that phrase is folklore. Current takes EVERY path, in inverse proportion to resistance. A 1 Ω path in parallel with a 1 kΩ path still sends ~0.1% through the 1 kΩ. The only time all current takes one path is when the other is truly open." },
    { q: "What about three or more branches?", a: "Same principle through conductances: each branch takes G_branch/G_total of the current, where G = 1/R. For two branches that algebra simplifies to the R2/(R1+R2) form; for more, work in conductances — it stays one line." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>Parallel branches share one voltage. Ohm&apos;s law then fixes each branch&apos;s current: <code>I_branch = V/R_branch</code>. Express V as <code>I_total × (R1∥R2)</code> and the divider falls out: <code>I1 = I × R2/(R1+R2)</code>. The inverse proportionality is the whole lesson — and the reason a fat copper trace in parallel with your shunt resistor quietly ruins a current measurement.</p>
      </>
    }><Calc /></CalcShell>
  );
}
