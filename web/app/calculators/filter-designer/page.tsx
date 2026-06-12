import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "filter-designer",
  title: "Active Filter Designer — Butterworth Sallen-Key (Order 2–8)",
  h1: "Active filter designer — Butterworth, order 2–8",
  tagline: "Higher-order low-pass and high-pass filters as cascaded Sallen-Key stages: pole Qs, standard-part values, and the response you'll actually get.",
  blockSlug: "opamp-noninverting",
  faq: [
    { q: "Why do higher-order filters become cascades of second-order sections?", a: "Because any filter polynomial factors into first- and second-order terms with real coefficients — an 8th-order response IS four biquads in a row, exactly. Nobody builds one giant 8th-order RC network: the cascade is mathematically identical, far less sensitive to component tolerances, and you can probe and debug it stage by stage." },
    { q: "What does 'Butterworth' actually choose?", a: "Where the poles sit. Butterworth spaces them evenly on a semicircle, which makes the passband maximally flat — no ripple, moderate rolloff, well-behaved step response. Chebyshev trades passband ripple for a steeper edge; Bessel trades rolloff for flat group delay (clean pulses). Butterworth is the default for a reason: it's the no-surprises choice." },
    { q: "Why does component spread blow up at high Q?", a: "The unity-gain Sallen-Key realizes Q through a component RATIO: C1/C2 = 4Q² (low-pass) or R2/R1 = 4Q² (high-pass). Order 8's hottest stage has Q ≈ 2.56 — already a 26:1 capacitor spread — and the stage's actual Q rides on that ratio, so tolerance errors hit hardest exactly where the response peaks. If you need still-sharper filters, that's the cue for a different topology (MFB) or a gain-of-K stage, not bigger ratios." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>An order-N Butterworth has pole pairs with <code>Q_k = 1 / (2·sin((2k−1)π/2N))</code> — one Sallen-Key stage per pair, plus a plain RC for the real pole when N is odd. Each low-pass stage uses equal resistors: <code>C1 = 4Q²·C2</code> and <code>R = 1/(ω₀√(C1·C2))</code>; high-pass mirrors it with equal capacitors and <code>R2 = 4Q²·R1</code>. Every stage shares the same ω₀ = 2πf_c — only Q differs. The calculator snaps each value to a standard E-series part, then recomputes the cutoff and Q those snapped parts actually deliver — the ideal you asked for and the filter you'll solder are rarely the same thing, and the gap is shown, not hidden.</p>
        <p>Stages are listed lowest-Q first — build them in that order. High-Q stages peak near cutoff (up to Q× the input), so putting them last keeps intermediate op-amp outputs inside the rails.</p>
      </>
    }><Calc /></CalcShell>
  );
}
