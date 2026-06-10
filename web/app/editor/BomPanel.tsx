"use client";
// The BOM panel body: every line is buyable. Rows link to a Digi-Key search (part number when
// declared, value+package otherwise); rows WITH part numbers can be pushed to a Digi-Key cart in
// one click via their myLists API. CSV export for everything else. The disclosure line is the
// FTC-required affiliate notice — value-framed, and the second sentence is the vendor-neutrality
// promise that actually differentiates us.
import { useState } from "react";
import { bomCsv, type BomRow } from "@electrace/core";
import { digikeyUrl, orderable, partQuery } from "@/lib/partLinks";
import { track } from "@/lib/telemetry";

export default function BomPanel({ rows, designName }: { rows: BomRow[]; designName: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const cartRows = rows.filter(orderable);

  const downloadCsv = () => {
    const blob = new Blob([bomCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(designName || "design").replace(/\s+/g, "-").toLowerCase()}-bom.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sendToCart = async () => {
    if (busy || !cartRows.length) return;
    setBusy(true); setNote(null);
    track({ kind: "bom.cart", parts: cartRows.length });
    try {
      const r = await fetch("/api/bom/digikey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${designName || "Electrace design"} — BOM`,
          parts: cartRows.map((row) => ({ pn: row.part, ref: row.refs.join(" "), qty: row.qty, note: [row.value, row.footprint].filter(Boolean).join(" ") })),
        }),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok && b.url) window.open(b.url, "_blank", "noopener"); // single-use URL — open immediately, it expires
      else setNote(b.error ?? "Couldn't reach Digi-Key — try again in a moment.");
    } catch { setNote("Couldn't reach Digi-Key — try again in a moment."); }
    setBusy(false);
  };

  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button onClick={downloadCsv} disabled={!rows.length}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10.5px] text-[var(--color-text)] hover:border-[#4c8dff] disabled:opacity-40">CSV</button>
        <button onClick={sendToCart} disabled={busy || !cartRows.length}
          title={cartRows.length ? `Creates a Digi-Key list with the ${cartRows.length} line${cartRows.length > 1 ? "s" : ""} that declare a part number` : "No row declares an orderable part number yet"}
          className="rounded-md border border-[#4c8dff66] bg-[#4c8dff26] px-2 py-0.5 text-[10.5px] text-[#4c8dff] hover:border-[#4c8dff] disabled:opacity-40">
          {busy ? "Sending…" : `Send to Digi-Key ↗${cartRows.length ? ` (${cartRows.length})` : ""}`}
        </button>
      </div>
      {note && <p className="mb-2 text-[10.5px] text-[#fbbf24]">{note}</p>}
      <div className="space-y-1 font-mono text-[11px] text-[var(--color-text)]">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span className="min-w-0 flex-1 truncate">
              {r.qty}× {r.value ?? r.part ?? r.type}
              {r.polarized && <span className="ml-1 rounded-sm bg-[#4c8dff26] px-1 text-[10px] text-[var(--color-link)]">pol</span>}{" "}
              <span className="text-[var(--color-faint)]">{r.refs.join(", ")}</span>
            </span>
            <a href={digikeyUrl(r)} target="_blank" rel="noopener sponsored" onClick={() => track({ kind: "bom.buy", q: partQuery(r) })}
              title={`Find "${partQuery(r)}" at Digi-Key`}
              className="shrink-0 text-[10px] text-[var(--color-link)] hover:underline">buy ↗</a>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <p className="mt-2.5 border-t border-[var(--color-border)] pt-2 text-[9.5px] leading-relaxed text-[var(--color-faint)]">
          Electrace may earn a commission on parts ordered through these links, at no extra cost to you.
          Links never influence which parts a block recommends.
        </p>
      )}
    </div>
  );
}
