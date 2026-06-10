// "Electrace vs X" comparison pages — the highest-intent SEO surface there is (searchers are
// actively tool-shopping). Honesty is the conversion strategy: every page states the other
// tool's strengths plainly and names when IT is the better choice. Data: lib/comparisons.ts.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPARISONS, comparisonBySlug } from "@/lib/comparisons";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = comparisonBySlug((await params).slug);
  if (!c) return {};
  return {
    title: `${c.title} — Electrace`,
    description: `${c.tagline} An honest comparison: what ${c.name} does better, what Electrace does better, and how to choose.`,
    alternates: { canonical: `${SITE}/vs/${c.slug}` },
    openGraph: { title: c.title, description: c.tagline, type: "article" },
  };
}

export default async function VsPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = comparisonBySlug((await params).slug);
  if (!c) notFound();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <main className="mx-auto max-w-4xl px-7 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Link href="/vs" className="text-sm text-faint hover:text-dim">← Comparisons</Link>
      <h1 className="mt-4 text-[34px] font-extrabold leading-tight tracking-tight">{c.title.replace(" — Electrace", "")}</h1>
      <p className="mt-2 text-[17px] text-dim">{c.tagline}</p>

      <h2 className="mt-9 text-xl font-bold">What {c.name} is</h2>
      <p className="mt-2 leading-relaxed text-dim">{c.what}</p>
      <ul className="mt-3 flex flex-col gap-2 text-[14.5px] text-dim">
        {c.theirStrengths.map((s) => <li key={s} className="flex gap-2.5"><span className="mt-0.5 font-bold text-green">✓</span><span>{s}</span></li>)}
      </ul>

      <div className="mt-9 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold">When {c.name} is the better choice</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-dim">{c.whenThem}</p>
        </div>
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
          <h2 className="text-[15px] font-bold">When Electrace is the better choice</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-dim">{c.whenUs}</p>
        </div>
      </div>

      <h2 className="mt-10 text-xl font-bold">Side by side</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left">
              <th className="px-4 py-2.5 font-semibold">Feature</th>
              <th className="px-4 py-2.5 font-semibold text-accent">Electrace</th>
              <th className="px-4 py-2.5 font-semibold">{c.name}</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.feature} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium">{r.feature}</td>
                <td className="px-4 py-2.5 text-dim">{r.us}</td>
                <td className="px-4 py-2.5 text-dim">{r.them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold">Common questions</h2>
      <div className="mt-3 flex flex-col gap-3">
        {c.faq.map((f) => (
          <div key={f.q} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-[14.5px] font-semibold">{f.q}</div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-dim">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-bg2 px-6 py-5">
        <h2 className="text-[15px] font-bold">The honest verdict</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-dim">{c.verdict}</p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/signup" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white hover:opacity-90">Try Electrace free</Link>
        <Link href="/blocks" className="rounded-xl border border-border-strong px-5 py-2.5 font-semibold hover:border-accent hover:text-accent">Browse the block library</Link>
        <span className="text-[12.5px] text-faint">No card — the whole understand-loop is free.</span>
      </div>
    </main>
  );
}
