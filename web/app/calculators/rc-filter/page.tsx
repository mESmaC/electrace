import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "rc-filter",
  title: "RC Low-Pass Filter Calculator",
  h1: "RC filter cutoff calculator",
  tagline: "Cutoff frequency from R and C — and reverse: pick the resistor for the cutoff you want.",
  blockSlug: "rc-lowpass",
  faq: [
    { q: "What actually happens at the cutoff frequency?", a: "The signal is at 70.7% (−3 dB) and shifted 45° — NOT blocked. An RC filter is a gentle slope (20 dB per decade), not a wall: content an octave above the cutoff still gets through at half amplitude. If you need a wall, you need more poles (or an active filter)." },
    { q: "Filter before or after the amplifier?", a: "Both have costs: filtering first attenuates signal you then amplify (noise too); amplifying first means the amp must handle the unfiltered interference. The usual answer for sensor chains: gentle RC right at the ADC pin, real filtering earlier in the chain." },
    { q: "Why choose C first in the reverse mode?", a: "Capacitors come in far fewer standard values than resistors, and odd capacitances are annoying to buy. Pick a friendly C (1n, 10n, 100n), let R absorb the precision — E24 resistors get you within a few percent of any cutoff." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>The resistor and capacitor form a frequency-dependent divider: the cap&apos;s impedance falls as frequency rises, so high frequencies divide away. The knee sits where the two impedances are equal: <code>fc = 1 / (2π·R·C)</code>.</p>
      </>
    }><Calc /></CalcShell>
  );
}
