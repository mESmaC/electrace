import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "voltage-divider",
  title: "Voltage Divider Calculator",
  h1: "Voltage divider calculator",
  tagline: "Output voltage, output impedance, and standing current — plus reverse mode: find R2 for a target output.",
  blockSlug: "voltage-divider",
  faq: [
    { q: "Can I power something from a voltage divider?", a: "Almost never. A divider makes a reference voltage, not a supply: any load current flows through R1 and drags the output down. The output impedance line in this calculator (R1 ∥ R2) tells you how badly — a load comparable to that impedance sags the output significantly. To power things, use a regulator." },
    { q: "What resistor values should I use?", a: "It's the RATIO that sets the voltage; the absolute values set the standing current and the stiffness. 10k–100k total is the usual sweet spot: small enough to drive an ADC pin, large enough not to waste battery. The calculator shows the always-flowing current so you can judge." },
    { q: "Why is my divider's output wrong when I connect it to something?", a: "The thing you connected is now part of the divider — its input resistance sits in parallel with R2. If the load is less than ~10× the divider's output impedance, the error is over a percent and grows fast. Buffer with an op-amp follower when it matters." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>Two resistors in series share the input voltage in proportion to their resistance: <code>Vout = Vin · R2 / (R1 + R2)</code>. The same current flows through both, so the bigger resistor takes the bigger share of the voltage.</p>
        <p>The two numbers everyone forgets: the <strong>output impedance</strong> (R1 ∥ R2 — what a load actually sees), and the <strong>standing current</strong> (Vin / (R1+R2)) that flows forever, which matters on batteries.</p>
      </>
    }><Calc /></CalcShell>
  );
}
