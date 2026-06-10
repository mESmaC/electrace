import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "555-timer",
  title: "555 Timer Calculator (Astable)",
  h1: "555 timer calculator",
  tagline: "Frequency, duty cycle, and HIGH/LOW times for the astable 555 — from Ra, Rb, and C.",
  blockSlug: "timer-555",
  faq: [
    { q: "Why can't this circuit do 50% duty cycle?", a: "The capacitor charges through Ra + Rb but discharges through Rb only, so the HIGH half is always longer. Get close to 50% by making Rb much larger than Ra — or hang a diode across Rb so charge bypasses it, the classic mod." },
    { q: "What values are safe for Ra, Rb, and C?", a: "Keep Ra ≥ 1k (pin 7 shorts Ra to ground every cycle — too small cooks the chip), both resistors under ~10M (leakage territory), and C ≥ 100 pF (below that, strays and chip capacitance dominate and the math drifts)." },
    { q: "Why is my real frequency off from the calculation?", a: "Capacitor tolerance, mostly — ceramics are ±10–20% and electrolytics worse. The resistor formula is honest; the cap rarely is. For frequencies that matter, use a film cap (±5%) or trim with Rb." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>The 555 bounces its capacitor between ⅓ and ⅔ of VCC, forever. Charge runs through <code>Ra + Rb</code> (output HIGH), discharge through <code>Rb</code> alone into pin 7 (output LOW). One RC time constant per half, ln(2) each: <code>f ≈ 1.44 / ((Ra + 2Rb) · C)</code>.</p>
      </>
    }><Calc /></CalcShell>
  );
}
