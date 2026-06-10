import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "parallel-resistor",
  title: "Parallel Resistor Calculator",
  h1: "Parallel resistor calculator",
  tagline: "Any number of resistors in parallel (and series) — plus reverse mode: what to parallel with what's in your drawer.",
  faq: [
    { q: "Why does parallel resistance always go DOWN?", a: "Each added resistor is another path for current — more paths, more total current at the same voltage, which is the definition of less resistance. The combined value is always smaller than the smallest resistor in the set." },
    { q: "What's the shortcut for two resistors?", a: "Product over sum: R = (R1·R2)/(R1+R2). Two equal resistors halve; a resistor paralleled with one 10× bigger barely moves (10k ∥ 100k ≈ 9.1k) — handy for fine-tuning a value you already placed." },
    { q: "Does power sharing work the same way?", a: "Each parallel resistor sees the full voltage, so it dissipates V²/R independently — smaller resistors in the set run hotter. Two equal resistors in parallel each take half the current, which is a legitimate way to split power across two cheap parts." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>Resistors in parallel share the same voltage, and their currents add — so conductances (1/R) add: <code>1/R = 1/R1 + 1/R2 + …</code>. In series the same current flows through each, so resistances simply add.</p>
        <p>The reverse mode answers the bench question this calculator really exists for: <em>&quot;I need 2.5k and I don&apos;t have one — what do I put in parallel with my 10k?&quot;</em></p>
      </>
    }><Calc /></CalcShell>
  );
}
