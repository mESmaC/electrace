import Link from "next/link";
import { SITE } from "@/lib/site";

const CALCS = [
  { slug: "led-resistor", name: "LED resistor", desc: "Series resistor, nearest standard value, actual current and power." },
  { slug: "voltage-divider", name: "Voltage divider", desc: "Output voltage, output impedance, standing current — plus reverse mode." },
  { slug: "crystal-load-capacitor", name: "Crystal load capacitors", desc: "The two caps from rated CL and board strays." },
  { slug: "ntc-thermistor", name: "NTC thermistor table", desc: "Resistance, divider ratio, and ADC counts across temperature." },
  { slug: "op-amp-gain", name: "Op-amp gain", desc: "Non-inverting and inverting gain; reverse mode picks standard resistors." },
  { slug: "motor-winding", name: "Motor winding & Kv", desc: "Kv to torque, rewind turns scaling, wye/delta, cogging steps, winding wire math." },
  { slug: "parallel-resistor", name: "Parallel resistors", desc: "Any number in parallel + series, and what to parallel with what you have." },
  { slug: "555-timer", name: "555 timer (astable)", desc: "Frequency, duty cycle, HIGH/LOW times from Ra, Rb, and C." },
  { slug: "rc-filter", name: "RC filter cutoff", desc: "Cutoff from R and C; reverse picks the resistor for your target." },
  { slug: "ohms-law", name: "Ohm's law + power", desc: "Solve V, I, or R — with the wattage number that decides part survival." },
];

export const metadata = {
  title: "Circuit Calculators — Electrace",
  description: "Free circuit calculators that show the real schematic, not just the formula: LED resistor, voltage divider, crystal load caps, NTC tables, op-amp gain.",
  alternates: { canonical: `${SITE}/calculators` },
};

export default function CalcIndex() {
  const ld = {
    "@context": "https://schema.org", "@type": "ItemList",
    itemListElement: CALCS.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${SITE}/calculators/${c.slug}` })),
  };
  return (
    <main className="mx-auto max-w-4xl px-7 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="text-3xl font-extrabold tracking-tight">Circuit calculators</h1>
      <p className="mt-2 max-w-xl text-dim">Each one computes the numbers AND shows the real circuit they belong to — with a one-click path to designing it for real.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CALCS.map((c) => (
          <Link key={c.slug} href={`/calculators/${c.slug}`} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent">
            <div className="text-[16px] font-bold">{c.name}</div>
            <p className="mt-1.5 text-[13.5px] text-dim">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
