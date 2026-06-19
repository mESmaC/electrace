// Public read-only view of a design (views.md /app/share/[id]) — the link the Share dialog hands
// out. Server-rendered with NO session: Row-Level Security decides what's visible, so a private
// design is a clean 404 here by construction. Every public design page is also SEO surface —
// viewers see the self-explaining blocks and the deterministic findings, which IS the pitch.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { analyze, type Block, type Design } from "@electrace/core";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { blockLibrary, fmtSpec } from "@/lib/blocks";
import { SITE } from "@/lib/site";
import SchematicPreview from "@/app/editor/SchematicPreview";
import ShareActions from "./ShareActions";

type Row = { id: string; name: string; visibility: string; graph: Design; updated_at: string };

async function fetchDesign(id: string): Promise<Row | null> {
  if (!supabaseConfigured) return null;
  const sb = await supabaseServer();
  const { data } = await sb.from("designs").select("id, name, visibility, graph, updated_at").eq("id", id).maybeSingle();
  return (data as Row | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await fetchDesign(id);
  if (!d) return { title: "Design — Electrace" };
  const n = d.graph.blocks?.length ?? 0;
  return {
    // public designs are SEO surface; unlisted means "anyone with the LINK" — keep those out of the index
    robots: d.visibility === "public" ? undefined : { index: false, follow: true },
    // canonical protects the UGC surface from duplicate/self-competing URLs (the other public templates set one)
    alternates: { canonical: `${SITE}/share/${id}` },
    title: `${d.name} — Electrace`,
    description: `A ${n}-block circuit design on Electrace — every block explains itself, every number is checked deterministically.`,
  };
}

const specLine = (b: Block): string => {
  const s = b.spec ?? {};
  const vin = fmtSpec(s.vin), vout = fmtSpec(s.vout), iout = fmtSpec(s.iout_max);
  if (vin && vout) return `${vin} → ${vout}${iout ? ` · ${iout}` : ""}`;
  return Object.entries(s).flatMap(([k, v]) => { const t = fmtSpec(v); return t ? [`${k} ${t}`] : []; }).slice(0, 3).join(" · ");
};

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await fetchDesign(id);
  if (!d) notFound();

  const lib = blockLibrary();
  const map = new Map(Object.entries(lib));
  // user-authored blocks live client-side until the registry phase (P2) — show what we can,
  // say what we can't, never silently drop
  const known = (d.graph.blocks ?? []).filter((b) => map.has(b.block));
  const customCount = (d.graph.blocks ?? []).length - known.length;
  const knownRefs = new Set(known.map((b) => b.ref));
  const graphForAnalysis: Design = {
    ...d.graph,
    blocks: known,
    connections: (d.graph.connections ?? []).filter((c) => {
      const [a] = c.from.split("."), [b] = c.to.split(".");
      const conns = new Set((d.graph.connectors ?? []).map((x) => x.ref));
      return (knownRefs.has(a) || conns.has(a)) && (knownRefs.has(b) || conns.has(b));
    }),
  };
  let stats = { nets: 0, parts: 0, errors: 0, warns: 0 };
  try {
    const a = analyze(graphForAnalysis, map);
    const live = a.findings.filter((f) => !f.acknowledged);
    stats = {
      nets: a.resolved.nets.length,
      parts: a.bom.length,
      errors: live.filter((f) => f.severity === "error").length,
      warns: live.filter((f) => f.severity === "warn").length,
    };
  } catch { /* a malformed shared graph still gets a page, just without stats */ }

  const chip = (label: string, value: string | number) => (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-[12px] text-dim">
      {label} <b className="font-mono font-medium text-text">{value}</b>
    </span>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-[26px] font-extrabold tracking-tight text-text">{d.name}</h1>
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">{d.visibility}</span>
      </div>
      <p className="mb-5 text-[13px] text-faint">
        A shared Electrace design · updated {new Date(d.updated_at).toLocaleDateString()} · read-only
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {chip("Blocks", (d.graph.blocks ?? []).length)}
        {chip("Nets", stats.nets)}
        {chip("Parts", stats.parts)}
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${
          stats.errors ? "border-[#f8717155] bg-[#f8717114] text-[#f87171]"
          : stats.warns ? "border-[#fbbf2455] bg-[#fbbf2414] text-[#fbbf24]"
          : "border-[#34d39955] bg-[#34d39912] text-[#34d399]"}`}>
          {stats.errors ? `⬣ ${stats.errors} error${stats.errors > 1 ? "s" : ""}` : stats.warns ? `▲ ${stats.warns} warning${stats.warns > 1 ? "s" : ""}` : "● checks pass"}
        </span>
      </div>

      <ShareActions id={d.id} name={d.name} graph={d.graph} />

      <h2 className="mb-3 mt-8 text-[15px] font-bold text-text">What&apos;s on this board</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {known.map((inst) => {
          const b = map.get(inst.block)!;
          return (
            <div key={inst.ref} className="rounded-xl border border-border-strong bg-surface-2 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md border border-border bg-surface text-sm" style={b.glyphColor ? { color: b.glyphColor } : undefined}>{b.glyph ?? "▦"}</span>
                <span className="flex-1 text-[13px] font-semibold text-text">{b.name}</span>
                <span className="text-[9px] uppercase tracking-wide text-faint">{inst.ref}</span>
              </div>
              {specLine(b) && <div className="mb-2 font-mono text-[11px] text-dim">{specLine(b)}</div>}
              <SchematicPreview blockId={b.id} layout={b.layout} height="fit" />
            </div>
          );
        })}
      </div>
      {customCount > 0 && (
        <p className="mt-3 text-[12px] text-faint">
          + {customCount} custom block{customCount > 1 ? "s" : ""} by the author (custom blocks aren&apos;t published yet, so they can&apos;t be shown here).
        </p>
      )}

      <div className="mt-10 rounded-xl border border-border bg-surface px-5 py-4 text-[13.5px] text-dim">
        Built with <Link href="/" className="font-semibold text-accent">Electrace</Link> — the schematic IDE where every
        block explains itself and every number is checked deterministically. <Link href="/signup" className="font-semibold text-accent">Start your own design →</Link>
      </div>
    </div>
  );
}
