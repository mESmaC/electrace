import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { listBlocks, loadBlock, fmtSpec, type LoadedBlock } from "@/lib/blocks";
import type { Terminal } from "@electrace/core";

export function generateStaticParams() {
  return listBlocks().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { block } = loadBlock(slug);
    return { title: `${block.name} — Electrace block` };
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
  const html = await marked.parse(explain);

  return (
    <main className="mx-auto max-w-5xl px-7 py-10">
      <Link href="/blocks" className="text-sm text-faint hover:text-dim">← Block library</Link>

      <header className="mt-5 flex items-start gap-4 border-b border-border pb-7">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/15 text-2xl text-accent">
          {block.glyph ?? "▦"}
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{block.name}</h1>
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

      <article className="prose-block mt-8 max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />

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

      <div className="mt-12 flex gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-dim">
        <span className="text-accent">✦</span>
        <span>This page is generated from the block&apos;s source — the same content powers the editor&apos;s explanations and live checks.</span>
      </div>
    </main>
  );
}
