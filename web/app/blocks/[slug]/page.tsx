// The public block-explainer page — the SEO surface AND the product content, generated from the
// same authored source that powers the editor (business-strategy.md: "the corpus IS the
// distribution"). Statically generated per block; every section is declared data, never inference.
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { discreteEquivalentFor, type Terminal } from "@electrace/core";
import { listBlocks, loadBlock, fmtSpec, type LoadedBlock } from "@/lib/blocks";
import SchematicPreview from "@/app/editor/SchematicPreview";
import { BLOCK_VIDEOS } from "@/lib/blockVideos";
import { blockImage } from "@/lib/blockImages";
import { BLOCK_SEO } from "@/lib/blockSeo";

export function generateStaticParams() {
  return listBlocks().map((b) => ({ slug: b.slug }));
}

/** First explain.md paragraph, de-markdown'd — the meta description learners actually search for. */
function summary(explain: string): string {
  const para = explain.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith("#")) ?? "";
  return para.replace(/[*_`>#[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Meta-description clamp: search engines want ~25–160 chars (Bing flags outside that); cut at
 *  a word boundary. Target 150 — HTML-entity encoding (&amp; etc.) inflates the rendered
 *  attribute, so leave headroom. The longer summary() stays for JSON-LD/og where length is fine. */
function metaDesc(s: string): string {
  if (s.length <= 150) return s;
  const cut = s.slice(0, 147);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 115))}…`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { block, explain } = loadBlock(slug);
    const title = `${BLOCK_SEO[slug] ?? block.name} — what it does and how it works`;
    const description = metaDesc(summary(explain) || `${block.name}: a self-explaining circuit block on Electrace.`);
    const img = blockImage(slug);
    return {
      title: `${title} — Electrace`,
      description,
      alternates: { canonical: `https://www.electrace.net/blocks/${slug}` },
      openGraph: { title, description, type: "article", ...(img ? { images: [{ url: img, alt: `${block.name} — internal schematic` }] } : {}) },
      ...(img ? { twitter: { card: "summary_large_image", images: [img] } } : {}),
    };
  } catch {
    return {};
  }
}

const netColor: Record<string, string> = {
  power: "text-amber",
  rail: "text-green",
  gnd: "text-gray",
  signal: "text-accent",
};

export default async function BlockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data: LoadedBlock;
  try {
    data = loadBlock(slug);
  } catch {
    notFound();
  }
  const { block, explain } = data!;
  // demote markdown h1s — the page provides THE h1; explain.md's leading "# Title" was
  // rendering as a duplicate <h1> inside the article (bad heading structure for SEO)
  const html = (await marked.parse(explain)).replace(/<h1>/g, "<h2>").replace(/<\/h1>/g, "</h2>");
  // the chips inside this block that have an authored discrete equivalent — the "nothing is a
  // black box" payoff, rendered right on the public page
  const discretes = (block.schematic?.parts ?? [])
    .flatMap((p) => { const eq = discreteEquivalentFor(p.part); return eq ? [{ part: p, eq }] : []; });
  const related = listBlocks().filter((b) => b.slug !== slug && b.block.category === block.category).slice(0, 4);

  const video = BLOCK_VIDEOS[slug];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    ...(video ? {
      video: {
        "@type": "VideoObject",
        name: video.title,
        description: summary(explain),
        thumbnailUrl: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        uploadDate: video.uploadDate,
        embedUrl: `https://www.youtube.com/embed/${video.id}`,
        contentUrl: `https://www.youtube.com/watch?v=${video.id}`,
      },
    } : {}),
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Block library", item: "https://www.electrace.net/blocks" },
        { "@type": "ListItem", position: 2, name: block.name, item: `https://www.electrace.net/blocks/${slug}` },
      ],
    },
    headline: `${BLOCK_SEO[slug] ?? block.name} — what it does and how it works`,
    description: summary(explain),
    author: { "@type": "Organization", name: "Electrace" },
    publisher: { "@type": "Organization", name: "Electrace", url: "https://www.electrace.net" },
    mainEntityOfPage: `https://www.electrace.net/blocks/${slug}`,
  };

  return (
    <main className="mx-auto max-w-5xl px-7 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/blocks" className="text-sm text-faint hover:text-dim">← Block library</Link>

      <header className="mt-5 flex items-start gap-4 border-b border-border pb-7">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/15 text-2xl text-accent">
          {block.glyph ?? "▦"}
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{BLOCK_SEO[slug] ?? block.name}</h1>
          <div className="mt-1 font-mono text-sm text-faint">
            {block.id}@{block.version}{block.license ? ` · ${block.license}` : ""}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(block.spec ?? {}).map(([k, v]) => (
              <span key={k} className="rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-dim">
                {k} <b className="text-text">{fmtSpec(v)}</b>
              </span>
            ))}
          </div>
        </div>
      </header>

      {block.layout && (
        <figure className="mt-8 max-w-3xl">
          <SchematicPreview blockId={block.id} layout={block.layout} height="fit" />
          <figcaption className="mt-2 text-[12.5px] text-faint">The actual schematic inside this block — every part is explained below.</figcaption>
        </figure>
      )}

      <article className="prose-block mt-8 max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />
      {video && (
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Watch it explained</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border" style={{ width: 315, maxWidth: "100%" }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.id}`}
              title={video.title}
              loading="lazy"
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ display: "block", width: "100%", aspectRatio: "9 / 16", border: 0 }}
            />
          </div>
        </section>
      )}

      <h2 className="mt-10 text-xl font-bold">Exposed nets</h2>
      <div className="mt-3 space-y-2">
        {block.terminals.map((t: Terminal) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 font-mono text-sm">
            <span className={netColor[t.type] ?? "text-dim"}>●</span>
            <span>{t.id}</span>
            <span className="ml-auto text-xs uppercase tracking-wide text-faint">
              {t.role} · {t.type}{t.v ? ` · ${fmtSpec(t.v)}` : ""}
            </span>
          </div>
        ))}
      </div>

      {block.schematic?.parts?.length ? (
        <>
          <h2 className="mt-10 text-xl font-bold">Inside this block</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {block.schematic.parts.map((p) => (
              <div key={p.ref} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
                <div className="w-16 shrink-0 font-mono font-bold">
                  {p.ref}
                  <div className="text-xs font-normal text-faint">{p.value ?? p.part ?? p.type}</div>
                </div>
                <div className="text-sm text-dim">{p.why}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {discretes.map(({ part, eq }) => (
        <section key={part.ref} className="mt-10">
          <h2 className="text-xl font-bold">Inside the chip: {eq.name}</h2>
          <p className="mt-1 text-[13px] text-faint">What {part.ref} actually does, drawn out in discrete parts — the same view the editor&apos;s &ldquo;break into discrete&rdquo; shows.</p>
          {eq.layout && (
            <div className="mt-3 max-w-3xl">
              <SchematicPreview blockId={`${block.id}::discrete:${eq.ic}`} layout={eq.layout} height="fit" />
            </div>
          )}
          {eq.note && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-dim">{eq.note}</p>}
        </section>
      ))}

      {block.limits?.length ? (
        <>
          <h2 className="mt-10 text-xl font-bold">Limits &amp; gotchas</h2>
          {block.limits.map((l, i) => (
            <div key={i} className="mt-3 flex gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm">
              <span className="text-amber">⚠</span>
              <span className="text-dim">
                <b className="font-mono text-text">{l.field} {l.value}{l.unit ?? ""}</b> — {l.note}
              </span>
            </div>
          ))}
        </>
      ) : null}

      <div className="mt-12 flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4">
        <div className="min-w-[240px] flex-1">
          <div className="text-[15px] font-bold text-text">Use this block in a real design</div>
          <div className="mt-0.5 text-[13px] text-dim">Drop it on a canvas, wire it up, and watch the live checks — free, no card.</div>
        </div>
        <Link href="/signup" className="rounded-xl bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:opacity-90">Start designing →</Link>
      </div>

      {related.length > 0 && (
        <nav className="mt-10">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-faint">Related blocks</h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/blocks/${r.slug}`}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-dim transition hover:border-accent hover:text-text">
                {r.block.glyph ?? "▦"} {r.block.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <div className="mt-10 flex gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-dim">
        <span className="text-accent">✦</span>
        <span>This page is generated from the block&apos;s source — the same content powers the editor&apos;s explanations and live checks.</span>
      </div>
    </main>
  );
}
