import { listBlocks } from "@/lib/blocks";
import BlocksBrowser from "./BlocksBrowser";

export const metadata = {
  title: "Block library — self-explaining circuit blocks — Electrace",
  description: "Browse circuit building blocks that explain themselves: regulators, drivers, protection, timers — each with its real schematic, per-part reasoning, and failure modes.",
  alternates: { canonical: "https://www.electrace.net/blocks" },
};

export default function BlocksIndex() {
  // shape only what the browser needs (and keep it serializable across the server→client boundary);
  // id/topology/terminals ride along so the client can spec-search ("18V → 5V at 3A") on declared data
  const items = listBlocks().map(({ slug, block, explain }) => ({
    slug,
    explain,
    block: {
      id: block.id, name: block.name, version: block.version, glyph: block.glyph,
      category: block.category, topology: block.topology, spec: block.spec, terminals: block.terminals,
    },
  }));

  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.block.name, url: `https://www.electrace.net/blocks/${b.slug}` })),
  };
  return (
    <main className="mx-auto max-w-6xl px-7 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />
      <h1 className="text-3xl font-extrabold tracking-tight">Block library</h1>
      <p className="mt-2 max-w-xl text-dim">
        Every block explains itself — what it does, the schematic, and why each part is there.
      </p>
      <BlocksBrowser items={items} />
    </main>
  );
}
