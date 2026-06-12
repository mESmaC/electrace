import Link from "next/link";
import { notFound } from "next/navigation";
import { GLOSSARY, GLOSSARY_BY_SLUG } from "@/lib/glossary";

const SITE = "https://www.electrace.net";

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = GLOSSARY_BY_SLUG[(await params).slug];
  if (!t) return {};
  return {
    title: `${t.term} — what it means and why it matters — Electrace`,
    description: t.def.slice(0, 158),
    alternates: { canonical: `${SITE}/glossary/${t.slug}` },
  };
}

export default async function TermPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = GLOSSARY_BY_SLUG[(await params).slug];
  if (!t) notFound();
  const ld = {
    "@context": "https://schema.org", "@type": "DefinedTerm",
    name: t.term, description: t.def, url: `${SITE}/glossary/${t.slug}`,
    inDefinedTermSet: `${SITE}/glossary`,
    ...(t.also ? { alternateName: t.also } : {}),
  };
  const related = GLOSSARY.filter((r) => r.slug !== t.slug).filter((r) =>
    t.links.some((l) => l.href === `/glossary/${r.slug}`) || r.links.some((l) => l.href === `/glossary/${t.slug}`)
  ).slice(0, 4);
  return (
    <main className="mx-auto max-w-3xl px-7 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav className="text-sm text-faint"><Link href="/glossary" className="hover:text-dim">← Glossary</Link></nav>
      <h1 className="mt-4 text-[30px] font-extrabold leading-tight tracking-tight">{t.term}</h1>
      {t.also && <div className="mt-1 text-[13px] text-faint">also known as: {t.also.join(" · ")}</div>}

      <p className="mt-6 text-[17px] leading-relaxed">{t.def}</p>

      <section className="mt-7">
        <h2 className="text-[18px] font-bold">In practice</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-dim">{t.practice}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-bold uppercase tracking-wider text-faint">See it for real</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {t.links.map((l) => (
            <Link key={l.href + l.label} href={l.href} className="rounded-xl border border-border bg-surface px-4 py-3 text-[14px] font-semibold transition hover:border-accent">{l.label} →</Link>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-faint">Related terms</h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/glossary/${r.slug}`} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] font-semibold transition hover:border-accent">{r.term}</Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
