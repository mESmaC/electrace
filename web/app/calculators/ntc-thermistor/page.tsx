import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "ntc-thermistor",
  title: "NTC Thermistor Table Calculator",
  h1: "NTC thermistor calculator",
  tagline: "Resistance, divider output, and ADC counts across temperature — a firmware lookup table from four numbers.",
  blockSlug: "ntc-thermistor",
  faq: [
    { q: "What is the B (beta) value?", a: "A single number describing how steeply the NTC's resistance falls with temperature, fitted between two points (usually 25 °C and 85 °C — hence B25/85). 3950 is the most common for hobby 10k NTCs. It's on the datasheet, and using the wrong B gives readings that are right at 25 °C and drift wrong away from it." },
    { q: "How accurate is the B equation?", a: "Within about ±1 °C over 0–70 °C, which covers most products. For wider ranges or tighter accuracy, use the three-coefficient Steinhart–Hart fit — same divider, just a better curve in firmware." },
    { q: "Why do my readings drift upward after power-on?", a: "Self-heating: the divider current warms the NTC, which dutifully reports its own warmth. Keep the current well under a milliamp (bigger resistors), or pulse the divider from a GPIO and sample right after switching it on." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>The NTC&apos;s resistance follows <code>R(T) = R25 · e^(B·(1/T − 1/298.15))</code> with T in kelvin. In a divider with the NTC on top, the output ratio is <code>Rfix / (Rfix + R(T))</code> — rising with temperature — and the ADC count is just that ratio times full-scale. Powering the divider from the ADC&apos;s own reference makes the measurement ratiometric: supply wobble cancels out.</p>
      </>
    }><Calc /></CalcShell>
  );
}
