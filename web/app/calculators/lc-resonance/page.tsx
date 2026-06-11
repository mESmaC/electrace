import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "lc-resonance",
  title: "LC Resonance & Reactance Calculator",
  h1: "LC resonance & reactance calculator",
  tagline: "Resonant frequency, reactance at any frequency, and series/parallel combination math for inductors and capacitors.",
  blockSlug: "crystal-oscillator",
  faq: [
    { q: "What physically happens at resonance?", a: "The inductor's reactance (rising with frequency) and the capacitor's (falling) are equal and opposite — energy sloshes between the magnetic field and the electric field with the source only topping up losses. A series LC looks like a short at f₀; a parallel LC looks like an open. Same frequency, opposite personalities." },
    { q: "Why do capacitor rules look like resistor rules, but flipped?", a: "Because capacitance is defined upside-down relative to impedance: more capacitance = LESS reactance. So caps in parallel add (more plate area), caps in series shrink by product-over-sum (more gap). Inductors follow resistor rules directly: series adds, parallel is product-over-sum." },
    { q: "What's √(L/C) good for?", a: "It's the characteristic impedance — the reactance of either element at resonance, and the knob that sets a tank's Q for a given loss resistance (Q = √(L/C)/R for series RLC). Two tanks can share one f₀ but behave totally differently because their L/C ratios differ." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>Reactance: <code>XL = 2πfL</code> climbs with frequency, <code>XC = 1/(2πfC)</code> falls. They cross at exactly one frequency — <code>f₀ = 1/(2π√LC)</code> — and that crossing is resonance. The combination rules come from impedances adding in series and admittances adding in parallel, which is why inductors behave like resistors and capacitors behave like resistors viewed in a mirror.</p>
      </>
    }><Calc /></CalcShell>
  );
}
