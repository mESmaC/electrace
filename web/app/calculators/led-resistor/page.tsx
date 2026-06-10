import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "led-resistor",
  title: "LED Resistor Calculator",
  h1: "LED resistor calculator",
  tagline: "Series resistor for any LED: value, nearest standard part, actual current, and power — instantly.",
  blockSlug: "led-indicator",
  faq: [
    { q: "Why does an LED need a resistor at all?", a: "An LED is not a resistor — its current rises almost vertically once the supply passes its forward voltage. Without something to limit current, the LED takes whatever the supply can deliver and burns out. The series resistor absorbs the difference between supply and forward voltage at a current you choose." },
    { q: "What current should I pick?", a: "Modern indicator LEDs are bright at 2–5 mA; 10 mA is plenty for almost anything, and 20 mA is the traditional absolute maximum for small LEDs. Lower current = longer life, less heat, dimmer light." },
    { q: "Why round the resistor value UP?", a: "A slightly larger resistor gives slightly less current — a marginally dimmer LED. A slightly smaller one gives more current, which eats into the LED's safety margin. Dimmer beats fried, so this calculator rounds up to the next E24 value." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>The resistor sees whatever voltage the LED doesn&apos;t take: <code>V = Vs − Vf</code>. Ohm&apos;s law turns that into a value: <code>R = (Vs − Vf) / I</code>. A red LED (Vf ≈ 2 V) on 5 V at 10 mA: R = 3 V / 0.01 A = 300 Ω.</p>
        <p>Forward voltage depends on the LED&apos;s colour chemistry, not its size: red/yellow sit near 2 V, green/blue/white near 3–3.3 V. When in doubt, the datasheet&apos;s Vf at your chosen current is the number to use.</p>
      </>
    }><Calc /></CalcShell>
  );
}
