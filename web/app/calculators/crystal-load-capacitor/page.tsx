import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "crystal-load-capacitor",
  title: "Crystal Load Capacitor Calculator",
  h1: "Crystal load capacitor calculator",
  tagline: "The two caps your crystal actually needs — from its rated CL and your board's strays.",
  blockSlug: "crystal-oscillator",
  faq: [
    { q: "What happens if I use the wrong load caps?", a: "Usually the oscillator still runs — just off-frequency (the crystal is 'pulled'), which shows up as UART garbling, USB enumeration failures, or RTC drift. Too-wrong values can also stop it starting at temperature extremes. It rarely fails on the bench, which is exactly why it ships broken." },
    { q: "Why 22 pF caps with a 12.5 pF crystal — the numbers don't match?", a: "The two caps are in SERIES as seen by the crystal, so two 22 pF parts present 11 pF, plus a few pF of board strays ≈ 12.5–15 pF. The caps being nearly double the rated CL is correct, not a typo." },
    { q: "How do I know my stray capacitance?", a: "You estimate: 2–3 pF for a tight layout next to the MCU, 4–5 pF for longer traces. MCU oscillator pins add ~1–3 pF each (datasheet). Get it within a picofarad or two and the pull is parts-per-million — good enough for everything except radio timing." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>A crystal is cut to resonate at its marked frequency only when it sees its rated load capacitance, CL. The two load caps are in series from the crystal&apos;s point of view, with board strays in parallel: <code>CL = (C1·C2)/(C1+C2) + Cstray</code>. With equal caps that inverts to <code>C = 2 × (CL − Cstray)</code> — what this calculator computes.</p>
      </>
    }><Calc /></CalcShell>
  );
}
