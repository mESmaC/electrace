import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "op-amp-gain",
  title: "Op-Amp Gain Calculator",
  h1: "Op-amp gain calculator",
  tagline: "Non-inverting and inverting gain from two resistors — and reverse: pick standard resistors for a target gain.",
  blockSlug: "opamp-noninverting",
  faq: [
    { q: "Why does the same resistor pair give two different gains?", a: "Topology. Feed the signal into in+ with the divider sensing the output (non-inverting): gain = 1 + R1/R2. Feed it through R2 into in− (inverting): gain = −R1/R2. Same parts, different wiring — the non-inverting version also has near-infinite input impedance, the inverting one's input impedance is just R2." },
    { q: "Does the op-amp model matter for gain?", a: "Almost never for the gain itself — that's the resistor ratio, which is the whole point. The op-amp matters for everything else: bandwidth (gain × bandwidth is roughly constant), input offset (multiplied by the gain!), and how close the output can swing to the rails." },
    { q: "My amplifier's output is stuck near the supply — why?", a: "Usually the gain is fine and the input isn't: gain 20 on a 5 V single supply clips for any input above ~0.25 V, and a signal that swings below ground can't be reproduced at all without mid-rail biasing. Size the gain for your LARGEST input, not the typical one." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>An op-amp drives its output until its inputs match. R1 and R2 divide the output by (1 + R1/R2) before showing it to in−, so the output must be that many times the input for the inputs to agree: <code>G = 1 + R1/R2</code>. Precision comes from the resistor <em>ratio</em> — which is why two 1% resistors make a 1% amplifier out of an op-amp whose own open-loop gain varies wildly between parts.</p>
      </>
    }><Calc /></CalcShell>
  );
}
