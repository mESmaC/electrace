import CalcShell, { calcMetadata, type CalcMeta } from "../shell";
import Calc from "./Calc";

const C: CalcMeta = {
  slug: "motor-winding",
  title: "Motor Winding Calculator",
  h1: "Motor winding & Kv calculator",
  tagline: "Kv to torque, rewind turns scaling, wye/delta, cogging steps, winding wire math — exact, no guesswork.",
  blockSlug: "h-bridge",
  faq: [
    { q: "What does Kv actually mean?", a: "Revolutions per minute the motor wants to spin per volt of back-EMF — and, flipped around, it IS the torque constant: Kt [Nm/A] = 9.549 / Kv. A high-Kv motor isn't 'weaker'; it trades torque-per-amp for speed, exactly like gearing. The same constant, seen from two sides." },
    { q: "Do more turns mean more torque?", a: "More torque per AMP (lower Kv → higher Kt), not more torque per WATT. The winding doesn't change the motor's underlying ability — copper fill does. More turns means thinner wire in the same slot, so resistance rises and the copper losses meet you on the other side. Rewinding chooses your operating point; it doesn't create free torque." },
    { q: "Wye or delta?", a: "Delta termination raises Kv by √3 (≈1.732) over wye with identical windings. Wye gives more torque per amp and gentler current draw — common for e-bikes and gimbals; delta gives more speed from the same pack — common where RPM matters. Some controllers exploit both with wye-delta switching." },
    { q: "Will this tell me a valid winding layout for my slot/pole combo?", a: "No — and honestly so. Winding tables (which teeth get which phase, in which direction) depend on the slot/pole combination's winding factor, and picking them is real design work. This calculator handles the exact arithmetic around a layout you already have; for the layout itself, consult a winding table for your specific slot/pole count." },
  ],
};
export const metadata = calcMetadata(C);

export default function Page() {
  return (
    <CalcShell c={C} prose={
      <>
        <h2>The one constant, two ways</h2>
        <p>Kv and Kt are the same physical constant expressed in different units: <code>Kt = 60 / (2π · Kv) ≈ 9.549 / Kv</code>. Every electrical watt the motor turns into mechanical power flows through that single number — which is why rewinding for half the Kv exactly doubles the torque per amp, and why no winding change can make a motor fundamentally more powerful. Power limits live in the copper fill, the magnets, and the heat path.</p>
        <p>Rewind scaling is plain proportionality: <code>Kv_new = Kv_old × N_old / N_new</code>, times √3 if you also switch wye→delta. Cogging steps per revolution are <code>LCM(slots, poles)</code> — a 12N14P motor detents 84 times per turn, which is why it feels smoother than a 12N4P.</p>
      </>
    }><Calc /></CalcShell>
  );
}
