// Per-design OG card — what a /share link unfurls to when pasted anywhere. Renders the design's
// own name, block count, and the green/amber/red check chip (the same status the page shows), so
// every shared link is a self-attributing "made with Electrace" artifact instead of the generic
// site card. Mirrors the block OG image's next/og usage. Falls back to a generic card on any miss.
import { ImageResponse } from "next/og";
import { analyze, type Design } from "@electrace/core";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { blockLibrary } from "@/lib/blocks";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "An Electrace circuit design";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let name = "Electrace design";
  let blocks = 0;
  let status: "pass" | "warn" | "error" | null = null;
  try {
    if (supabaseConfigured) {
      const sb = await supabaseServer(); // no session → RLS shows public/unlisted, 404s private (generic card)
      const { data } = await sb.from("designs").select("name, graph").eq("id", id).maybeSingle();
      const d = data as { name: string; graph: Design } | null;
      if (d) {
        name = d.name || name;
        blocks = d.graph?.blocks?.length ?? 0;
        try {
          const map = new Map(Object.entries(blockLibrary()));
          const known = (d.graph.blocks ?? []).filter((b) => map.has(b.block));
          const refs = new Set(known.map((b) => b.ref));
          const conns = new Set((d.graph.connectors ?? []).map((x) => x.ref));
          const graph: Design = {
            ...d.graph, blocks: known,
            connections: (d.graph.connections ?? []).filter((c) => {
              const a = c.from.split(".")[0], b = c.to.split(".")[0];
              return (refs.has(a) || conns.has(a)) && (refs.has(b) || conns.has(b));
            }),
          };
          const live = analyze(graph, map).findings.filter((f) => !f.acknowledged);
          status = live.some((f) => f.severity === "error") ? "error" : live.some((f) => f.severity === "warn") ? "warn" : "pass";
        } catch { /* no chip — name + count still render */ }
      }
    }
  } catch { /* generic card */ }

  const chip = status === "error" ? { t: "errors found", c: "#f87171", bg: "rgba(248,113,113,.14)", bd: "rgba(248,113,113,.5)" }
    : status === "warn" ? { t: "warnings", c: "#fbbf24", bg: "rgba(251,191,36,.14)", bd: "rgba(251,191,36,.5)" }
    : status === "pass" ? { t: "checks pass", c: "#34d399", bg: "rgba(52,211,153,.12)", bd: "rgba(52,211,153,.5)" }
    : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#2b3447", color: "#e8edf5", fontFamily: "monospace" }}>
        <div style={{ display: "flex", fontSize: 26, color: "#6ea3ff", fontWeight: 700, letterSpacing: 1 }}>ELECTRACE · SHARED DESIGN</div>
        <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1.05, marginTop: 20 }}>{name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 40 }}>
          <div style={{ display: "flex", padding: "10px 20px", borderRadius: 10, background: "#222a3a", border: "1px solid #3a4458", fontSize: 26, color: "#c2cbd8" }}>{blocks} block{blocks === 1 ? "" : "s"}</div>
          {chip && (
            <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderRadius: 10, background: chip.bg, border: `1px solid ${chip.bd}`, fontSize: 26, color: chip.c, fontWeight: 700 }}>● {chip.t}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 56, fontSize: 26, color: "#9aa6b6" }}>every block explains itself · every number checked deterministically</div>
      </div>
    ),
    size,
  );
}
