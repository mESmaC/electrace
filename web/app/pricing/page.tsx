import Link from "next/link";
import { PLANS } from "@/lib/plans";

export const metadata = {
  title: "Pricing — Electrace",
  description: "Maker-first pricing: the whole understand-your-circuit loop is free. You pay only for privacy or to ship.",
};

const FAQ = [
  { q: "Is the free tier actually free?", a: "Yes — forever. The entire understand-loop (blocks, hover & drill-in, expand-to-discrete, linting, themes) is free, with up to 10 designs. We never charge you to learn." },
  { q: "What do I get with Pro?", a: "Pro lifts the 10-design cap entirely and unlocks private designs, manufacturing-grade export (Gerber / BOM / pick-and-place), version history, and advanced checks — for when you're shipping real hardware." },
  { q: "Are my designs private?", a: "On Hobby, designs are public — discoverable, like a public repo. Keeping designs private is a Pro feature, for when you need to hold work to yourself." },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-[1140px] px-7 py-16">
      {/* header */}
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[1.4px] text-accent">Pricing</div>
        <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-tight">Free to understand.<br />Pay only to ship.</h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[18px] text-dim">
          The whole understand-your-circuit loop is free, forever — up to 10 designs. Upgrade when you need more room, private projects, or manufacturing-grade output.
        </p>
      </div>

      {/* early-adopter banner */}
      <div className="mx-auto mt-8 flex max-w-[700px] items-center justify-center gap-2.5 rounded-xl border px-4 py-2.5 text-center text-[13.5px]"
        style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)" }}>
        <span className="text-accent">⚡</span>
        <span><b className="font-semibold">Early adopters get a discount on Pro.</b> Start free today.</span>
      </div>

      {/* tiers */}
      <div className="mt-11 grid items-start gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.key}
            className={`relative flex h-full flex-col rounded-2xl border bg-surface p-6 ${p.highlight ? "border-accent shadow-2xl" : "border-border"}`}
            style={p.highlight ? { boxShadow: "0 0 0 1px var(--color-accent), 0 18px 50px -12px color-mix(in srgb, var(--color-accent) 45%, transparent)" } : undefined}>
            {p.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Most popular</span>
            )}
            <div className="text-[17px] font-bold">{p.name}</div>
            <div className="mt-1 min-h-[40px] text-[13.5px] text-dim">{p.tagline}</div>
            {p.price ? (
              <div className="mt-4 flex h-[44px] items-end gap-2">
                <span className="text-[34px] font-extrabold leading-none tracking-tight">{p.price}</span>
                <span className="pb-0.5 text-[12.5px] text-faint">{p.priceNote}</span>
              </div>
            ) : (
              <div className="mt-4 flex h-[44px] items-center">
                <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[13px] font-semibold text-accent">{p.priceNote}</span>
              </div>
            )}
            <Link href={p.cta.href}
              className={`mt-5 rounded-xl py-2.5 text-center font-semibold transition ${p.highlight ? "bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-hi" : "border border-border-strong hover:border-accent hover:text-accent"}`}>
              {p.cta.label}
            </Link>
            {p.featuresLead && <div className="mt-6 text-[12.5px] font-semibold text-dim">{p.featuresLead}</div>}
            <ul className={`flex flex-col gap-2.5 text-[13.5px] text-dim ${p.featuresLead ? "mt-2.5" : "mt-6"}`}>
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5"><span className="mt-0.5 font-bold text-green">✓</span><span>{f}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* the principle */}
      <div className="mx-auto mt-14 max-w-[760px] rounded-2xl border border-border bg-bg2 px-7 py-7 text-center">
        <h2 className="text-[20px] font-bold">Free to understand. Pro to ship.</h2>
        <p className="mx-auto mt-2 max-w-[600px] text-[15px] text-dim">
          Hobby gives you the entire understand-loop and up to 10 designs — plenty to learn and prototype, in the open.
          Pro lifts the cap and unlocks private projects and manufacturing-grade output, for when you&apos;re building real hardware.
        </p>
      </div>

      {/* faq */}
      <div className="mx-auto mt-14 max-w-[760px]">
        <h2 className="mb-6 text-center text-[24px] font-extrabold tracking-tight">Questions</h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-surface p-5">
              <div className="text-[15px] font-semibold">{f.q}</div>
              <p className="mt-1.5 text-[14px] leading-relaxed text-dim">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* closing cta */}
      <div className="mx-auto mt-14 max-w-[680px] text-center">
        <h2 className="text-[26px] font-extrabold tracking-tight">Start understanding your circuits.</h2>
        <p className="mt-2 text-[15px] text-dim">No card, no catch — the understand-loop is free.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:bg-accent-hi">Start free</Link>
          <Link href="/blocks" className="rounded-xl border border-border-strong px-6 py-3 font-semibold transition hover:border-accent hover:text-accent">Browse the library</Link>
        </div>
      </div>
    </main>
  );
}
