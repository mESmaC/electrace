import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "ohms-law",
  title: "Ohm's Law Calculator",
  h1: "Ohm's law calculator",
  tagline: "V, I, R, and power — enter two, get the rest, with a wattage warning when parts start cooking.",
  faq: [
    { q: "Which form of the law do I use?", a: "They're all the same triangle: V = I·R, I = V/R, R = V/I. Pick the one whose unknown you need. This calculator does the picking — choose what to solve for and feed it the other two." },
    { q: "Why does the power number matter so much?", a: "Because parts fail by wattage, not by being 'wrong'. A 1k resistor across 12 V is a perfectly legal resistance — dissipating 144 mW, fine for a ¼ W part, fatal for an 0402. Every resistance decision is secretly also a power decision." },
    { q: "Milliamps or amps?", a: "This calculator takes milliamps because that's the realistic range for signal-level electronics (LEDs ~10 mA, GPIO ~20 mA max, logic ~µA-mA). For motors and heaters, think in amps — and stop using ¼ W resistors." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>One relationship, three arrangements: <code>V = I · R</code>. Voltage pushes, resistance resists, current is what results. Power is the part everyone forgets: <code>P = V · I</code> — and it&apos;s the number that decides whether your resistor survives.</p>
      </>
    }><Calc /></CalcShell>
  );
}
