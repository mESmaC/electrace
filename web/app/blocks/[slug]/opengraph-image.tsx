// Per-block OG image — the card a block page shows when shared/linked. Generated from the same
// authored data as the page: glyph, name, the question-form framing, and the declared spec chips.
import { ImageResponse } from "next/og";
import { listBlocks, loadBlock, fmtSpec } from "@/lib/blocks";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export function generateStaticParams() {
  return listBlocks().map((b) => ({ slug: b.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let name = "Circuit block", chips: string[] = [];
  try {
    const { block } = loadBlock(slug);
    name = block.name;
    chips = Object.entries(block.spec ?? {}).slice(0, 4).flatMap(([k, v]) => { const t = fmtSpec(v); return t ? [`${k} ${t}`] : []; });
  } catch { /* fall back to generic */ }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#2b3447", color: "#e8edf5", fontFamily: "monospace" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 110, height: 110, borderRadius: 24, background: "rgba(76,141,255,.18)", border: "2px solid rgba(76,141,255,.45)", fontSize: 48, fontWeight: 800, color: "#6ea3ff" }}>{name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "EC"}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
            <div style={{ fontSize: 28, color: "#9aa6b6", marginTop: 10 }}>what it does and how it works</div>
          </div>
        </div>
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 14, marginTop: 44, flexWrap: "wrap" }}>
            {chips.map((c) => (
              <div key={c} style={{ display: "flex", padding: "10px 18px", borderRadius: 10, background: "#222a3a", border: "1px solid #3a4458", fontSize: 24, color: "#c2cbd8" }}>{c}</div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 56, fontSize: 26, color: "#6ea3ff", fontWeight: 700 }}>Electrace <span style={{ color: "#9aa6b6", fontWeight: 400 }}>· the schematic that explains itself</span></div>
      </div>
    ),
    size,
  );
}
