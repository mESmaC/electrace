import Link from "next/link";
import { GLOSSARY } from "@/lib/glossary";

const SITE = "https://www.electrace.net";

export const metadata = {
  title: "Electronics glossary — terms that actually explain — Electrace",
  description: "Hysteresis, flyback diodes, Thévenin equivalents, power factor, E-series values — short definitions written by people who build, each linked to a live circuit, calculator, or check.",
  alternates: { canonical: `${SITE}/glossary` },
};

export default function GlossaryIndex() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  const ld = {
    "@context": "https://schema.org", "@type": "DefinedTermSet", name: "Electrace electronics glossary",
    url: `${SITE}/glossary`,
    hasDefinedTerm: sorted.map((t) => ({ "@type": "DefinedTerm", name: t.term, url: `${SITE}/glossary/${t.slug}` })),
  };
  return (
    <main className="mx-auto max-w-4xl px-7 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">Electronics glossary</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-dim">
        Short definitions that respect your time, written by people who build. Every term links onward — to the live circuit,
        the calculator, or the check that uses it.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {sorted.map((t) => (
          <Link key={t.slug} href={`/glossary/${t.slug}`} className="rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent">
            <div className="text-[15px] font-semibold">{t.term}</div>
            {t.also && <div className="mt-0.5 text-[11px] text-faint">also: {t.also.join(" · ")}</div>}
            <div className="mt-1.5 line-clamp-2 text-[12.5px] text-faint">{t.def}</div>
          </Link>
        ))}
      </div>
      <div className="mt-12 rounded-2xl border border-border bg-surface p-5">
        <div className="text-[15px] font-bold">Reading is the slow way</div>
        <p className="mt-1 text-[13.5px] text-dim">Every one of these concepts is live in the editor — place the circuit and watch the checks explain it on your design.</p>
        <Link href="/editor" className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hi">Open the editor →</Link>
      </div>
    </main>
  );
}
