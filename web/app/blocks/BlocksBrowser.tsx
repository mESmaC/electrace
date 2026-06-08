"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

type Item = { slug: string; explain?: string; block: { name: string; glyph?: string; category?: string; spec?: Record<string, unknown> } };

// inlined from lib/blocks (that module imports node:fs, so it can't be pulled into a client bundle)
function fmtSpec(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const r = v as { value?: number; min?: number; max?: number; unit?: string };
    const u = r.unit ? ` ${r.unit}` : "";
    if (r.value != null) return `${r.value}${u}`;
    if (r.min != null || r.max != null) return `${r.min ?? "?"}–${r.max ?? "?"}${u}`;
  }
  return "";
}

export default function BlocksBrowser({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const categories = useMemo(
    () => ["All", ...[...new Set(items.map((i) => i.block.category).filter(Boolean) as string[])].sort()],
    [items],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat !== "All" && i.block.category !== cat) return false;
      if (!needle) return true;
      const hay = `${i.block.name} ${i.block.category ?? ""} ${i.explain ?? ""} ${Object.keys(i.block.spec ?? {}).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, cat]);

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search blocks…"
          className="w-64 rounded-lg border border-border-strong bg-surface px-3.5 py-2 text-sm text-text outline-none focus:border-accent"
        />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-lg border px-3 py-1.5 text-[13px] capitalize transition ${cat === c ? "border-accent bg-accent/15 text-accent" : "border-border-strong text-dim hover:border-accent hover:text-text"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[13px] text-faint">{shown.length} block{shown.length === 1 ? "" : "s"}</span>
      </div>

      {shown.length === 0 ? (
        <p className="mt-12 text-center text-dim">No blocks match “{q}”.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ slug, block }) => (
            <Link key={slug} href={`/blocks/${slug}`} className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/15 text-xl text-accent">{block.glyph ?? "▦"}</span>
                <div>
                  <div className="font-semibold">{block.name}</div>
                  <div className="text-xs capitalize text-faint">{block.category}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(block.spec ?? {}).slice(0, 3).map(([k, v]) => (
                  <span key={k} className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-dim">{k} {fmtSpec(v)}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
