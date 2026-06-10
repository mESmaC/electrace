// Server-side shell for calculator pages: heading, the interactive calculator (client), the REAL
// schematic of the related block (the differentiator — incumbent calculator pages are formula-only),
// prose for the crawlers and the curious, FAQ JSON-LD, and the funnel into the block page + editor.
import Link from "next/link";
import { loadBlock } from "@/lib/blocks";
import { SITE } from "@/lib/site";
import SchematicPreview from "@/app/editor/SchematicPreview";

export interface CalcMeta {
  slug: string; title: string; h1: string; tagline: string;
  blockSlug?: string; // omit for pure-math calculators (no natural related block)
  faq: { q: string; a: string }[];
}

export function calcMetadata(c: CalcMeta) {
  return {
    title: `${c.title} — Electrace`,
    description: `${c.tagline} Free, instant, with the real schematic — not just the formula.`,
    alternates: { canonical: `${SITE}/calculators/${c.slug}` },
  };
}

export default function CalcShell({ c, prose, children }: { c: CalcMeta; prose: React.ReactNode; children: React.ReactNode }) {
  const b = c.blockSlug ? loadBlock(c.blockSlug) : null;
  const faqLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <main className="mx-auto max-w-4xl px-7 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Link href="/calculators" className="text-sm text-faint hover:text-dim">← All calculators</Link>
      <h1 className="mt-4 text-[32px] font-extrabold leading-tight tracking-tight">{c.h1}</h1>
      <p className="mt-2 text-[16px] text-dim">{c.tagline}</p>

      <div className="mt-8">{children}</div>

      {b && (
        <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-bold">The circuit this computes</h2>
            <Link href={`/blocks/${c.blockSlug}`} className="text-[13px] font-semibold text-accent hover:underline">{b.block.name} — fully explained →</Link>
          </div>
          <SchematicPreview blockId={b.block.id} layout={b.block.layout} height="fit" />
        </div>
      )}

      <div className="prose-block mt-10 max-w-3xl">{prose}</div>

      <h2 className="mt-10 text-xl font-bold">Common questions</h2>
      <div className="mt-3 flex flex-col gap-3">
        {c.faq.map((f) => (
          <div key={f.q} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-[14.5px] font-semibold">{f.q}</div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-dim">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/editor" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white hover:opacity-90">Design it in the editor — free</Link>
        <span className="text-[12.5px] text-faint">Live electrical checks, automatic BOM, KiCad export.</span>
      </div>
    </main>
  );
}
