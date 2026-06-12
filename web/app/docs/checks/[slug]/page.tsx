import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECK_DOCS, CHECK_DOC_BY_SLUG } from "@/lib/checkDocs";
import { SevChip, CATEGORY_TITLES } from "../ui";

const SITE = "https://www.electrace.net";

export function generateStaticParams() {
  return CHECK_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = CHECK_DOC_BY_SLUG[(await params).slug];
  if (!d) return {};
  return {
    title: `${d.name} — Electrace check rule`,
    description: `${d.what} Why it matters and how to fix it — one of ${CHECK_DOCS.length} live electrical checks in Electrace.`,
    alternates: { canonical: `${SITE}/docs/checks/${d.slug}` },
  };
}

export default async function CheckPage({ params }: { params: Promise<{ slug: string }> }) {
  const d = CHECK_DOC_BY_SLUG[(await params).slug];
  if (!d) notFound();
  const related = CHECK_DOCS.filter((r) => r.category === d.category && r.slug !== d.slug).slice(0, 4);
  return (
    <main className="mx-auto max-w-3xl px-7 py-12">
      <nav className="text-sm text-faint">
        <Link href="/docs/checks" className="hover:text-dim">← All check rules</Link>
        <span className="mx-2">·</span>{CATEGORY_TITLES[d.category]}
      </nav>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">{d.name}</h1>
        <SevChip sev={d.severity} />
      </div>
      <div className="mt-1.5 font-mono text-[12.5px] text-faint">{d.rule}</div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-faint">What it looks like</div>
        <div className="mt-1.5 font-mono text-[13.5px] leading-relaxed">{d.example}</div>
      </div>

      <section className="mt-8">
        <h2 className="text-[18px] font-bold">What it checks</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-dim">{d.what}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-[18px] font-bold">Why it matters</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-dim">{d.why}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-[18px] font-bold">How to fix it</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-dim">{d.fix}</p>
      </section>
      {d.intended && (
        <section className="mt-6 rounded-xl border border-border bg-surface-2 p-4">
          <h2 className="text-[14px] font-bold">When it&apos;s intended</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-dim">{d.intended} In the editor, mark any error or warning <em>intended</em> with a note — it mutes the finding without hiding it, and the note stays with the design.</p>
        </section>
      )}

      <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
        <div className="text-[15px] font-bold">This check runs live while you wire</div>
        <p className="mt-1 text-[13.5px] text-dim">Findings name the exact net and pin, with the numbers behind the verdict. Free, in your browser, no account needed.</p>
        <Link href="/editor" className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hi">Try it on your design →</Link>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-faint">Related checks</h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/docs/checks/${r.slug}`} className="rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] font-semibold transition hover:border-accent">{r.name}</Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
