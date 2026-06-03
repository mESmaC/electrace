import Link from "next/link";
import { listBlocks, fmtSpec } from "@/lib/blocks";

export const metadata = { title: "Block library — Electrace" };

export default function BlocksIndex() {
  const blocks = listBlocks();
  return (
    <main className="mx-auto max-w-6xl px-7 py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Block library</h1>
      <p className="mt-2 max-w-xl text-dim">
        Every block explains itself — what it does, the schematic, and why each part is there.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map(({ slug, block }) => (
          <Link
            key={slug}
            href={`/blocks/${slug}`}
            className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/15 text-xl text-accent">
                {block.glyph ?? "▦"}
              </span>
              <div>
                <div className="font-semibold">{block.name}</div>
                <div className="text-xs text-faint">{block.category}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(block.spec ?? {}).slice(0, 3).map(([k, v]) => (
                <span key={k} className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-dim">
                  {k} {fmtSpec(v)}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
