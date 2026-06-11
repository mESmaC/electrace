import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "ac-motor",
  title: "AC Motor Calculator (Slip, Speed, Torque)",
  h1: "AC induction motor calculator",
  tagline: "Synchronous speed, slip, rotor frequency, shaft torque, three-phase input power and efficiency.",
  faq: [
    { q: "Why does an induction motor HAVE to run slower than synchronous?", a: "Torque comes from the rotor cutting field lines — which only happens when the rotor lags the rotating field. Run at exactly synchronous speed and the rotor sees zero relative field, zero induced current, zero torque. Slip isn't a defect; it's the mechanism. Typical full-load slip is 2–5%." },
    { q: "What does 120 mean in Ns = 120f/p?", a: "It's 60 seconds-per-minute × 2 poles-per-pole-pair. The field makes one electrical revolution per cycle, and p/2 pole pairs share the mechanical circle — so a 4-pole 60 Hz machine spins its field at 1800 rpm, a 2-pole at 3600." },
    { q: "Negative slip in the calculator — what did I just compute?", a: "A rotor spinning FASTER than the field: that's an induction generator. Wind turbines do exactly this. The same machine, same math — power simply flows the other way. (If you weren't expecting it, check your poles/frequency inputs.)" },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>How it works</h2>
        <p>The stator&apos;s three phases build a field rotating at <code>Ns = 120·f/poles</code>. The rotor chases it, always a little behind — that lag is slip, <code>s = (Ns−n)/Ns</code>, and the rotor conductors see frequency <code>f×s</code>. Shaft torque is just power over angular speed, <code>τ = 9.549·P/n</code> — the same 9.549 that links Kv and Kt in the DC motor calculator, because it&apos;s nothing more than 60/2π.</p>
      </>
    }><Calc /></CalcShell>
  );
}
