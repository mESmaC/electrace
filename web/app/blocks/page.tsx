import { listBlocks } from "@/lib/blocks";
import BlocksBrowser from "./BlocksBrowser";

export const metadata = { title: "Block library — Electrace" };

export default function BlocksIndex() {
  // shape only what the browser needs (and keep it serializable across the server→client boundary)
  const items = listBlocks().map(({ slug, block, explain }) => ({
    slug,
    explain,
    block: { name: block.name, glyph: block.glyph, category: block.category, spec: block.spec },
  }));

  return (
    <main className="mx-auto max-w-6xl px-7 py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Block library</h1>
      <p className="mt-2 max-w-xl text-dim">
        Every block explains itself — what it does, the schematic, and why each part is there.
      </p>
      <BlocksBrowser items={items} />
    </main>
  );
}
