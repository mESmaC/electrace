"use client";
// The BOM panel body: every line is buyable. Rows link to a Digi-Key search (part number when
// declared, value+package otherwise); rows WITH part numbers can be pushed to a Digi-Key cart in
// one click via their myLists API. CSV export for everything else. The disclosure line is the
// FTC-required affiliate notice — value-framed, and the second sentence is the vendor-neutrality
// promise that actually differentiates us.
import { useState } from "react";
import { bomCsv, type BomRow } from "@electrace/core";
import { digikeyUrl, orderable, partQuery } from "@/lib/partLinks";
import { askSparky } from "@/lib/assistant";
import { track, logUsage } from "@/lib/telemetry";

export default function BomPanel({ rows, designName, pro }: { rows: BomRow[]; designName: string; pro?: boolean | null }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const cartRows = rows.filter(orderable);
  // rows the cart can't take: a real part number is missing (a connector, or a part declared only by
  // value/type). These still have a working "buy ↗" search — they just can't go in a one-click cart.
  const needsPn = rows.filter((r) => !orderable(r));

  // Hand the gap to Sparky: open it with a grounded prompt to fill the missing rows with REAL,
  // orderable Digi-Key manufacturer part numbers (Sparky authors mpns onto the blocks' parts).
  const askSparkyForPns = () => {
    const list = needsPn.map((r) => `${r.refs.join(" ")} — ${r.value ?? r.type}${r.footprint ? ` (${r.footprint})` : ""}`).join("; ");
    track({ kind: "bom.sparky_pns", rows: needsPn.length });
    askSparky(
      `Fill in real, orderable Digi-Key manufacturer part numbers for the parts in "${designName}" that don't have one yet, so I can push the BOM to a Digi-Key cart. ` +
      `Pick in-stock, common parts that match each one's value/footprint, and set the mpn on the relevant block parts. Rows missing a part number: ${list || "(none)"}.`
    );
  };

  const downloadCsv = () => {
    // CSV is the manufacturing handoff → Pro. Viewing the BOM and the Digi-Key cart stay free
    // (the cart earns its keep). Unknown plan (null) passes — never block on a slow fetch.
    if (pro === false) { setUpgrade(true); logUsage("paywall.hit", { feature: "bom_csv" }); return; }
    const blob = new Blob([bomCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(designName || "design").replace(/\s+/g, "-").toLowerCase()}-bom.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    logUsage("export.bom", { rows: rows.length }); // Pro manufacturing handoff completed
  };

  const sendToCart = async () => {
    if (busy || !cartRows.length) return;
    setBusy(true); setNote(null);
    track({ kind: "bom.cart", parts: cartRows.length });
    logUsage("bom.cart", { parts: cartRows.length }); // ordering intent — strong "real project" signal
    try {
      const r = await fetch("/api/bom/digikey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${designName || "Electrace design"} — BOM`,
          parts: cartRows.map((row) => ({ pn: row.part, ref: row.refs.join(" "), qty: row.qty, note: [row.value, row.value === row.footprint ? null : row.footprint].filter(Boolean).join(" ") })),
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
          title={cartRows.length
            ? `Creates a Digi-Key cart with the ${cartRows.length} line${cartRows.length > 1 ? "s" : ""} that declare an exact part number`
            : "The one-click cart needs an exact part number per line — no row has one yet. Every row still has a “buy ↗” search."}
          className="rounded-md border border-[#4c8dff66] bg-[#4c8dff26] px-2 py-0.5 text-[10.5px] text-[#4c8dff] hover:border-[#4c8dff] disabled:opacity-40">
          {busy ? "Sending…" : `Send to Digi-Key ↗${cartRows.length ? ` (${cartRows.length})` : ""}`}
        </button>
        {pro && needsPn.length > 0 && (
          <button onClick={askSparkyForPns}
            title={`Let Sparky pick real, orderable part numbers for the ${needsPn.length} row${needsPn.length > 1 ? "s that don't" : " that doesn't"} have one`}
            className="rounded-md border border-[#8b6cff66] bg-[#8b6cff26] px-2 py-0.5 text-[10.5px] text-[#a98bff] hover:border-[#8b6cff]">
            ✨ Fill part numbers
          </button>
        )}
      </div>
      {/* clarify the cart-vs-search distinction exactly when the cart is empty (the confusing state) */}
      {rows.length > 0 && cartRows.length === 0 && (
        <p className="mb-2 text-[10.5px] leading-relaxed text-[var(--color-dim)]">
          The one-click cart needs an <em>exact</em> part number per line, which none of these declare yet — but every row’s <span className="text-[var(--color-link)]">buy ↗</span> opens a Digi-Key search that works.
          {pro
            ? <> Want a real cart? <button onClick={askSparkyForPns} className="text-[#a98bff] hover:underline">have Sparky fill them in ↗</button>.</>
            : <> Declare a part number on a block’s part to enable the cart.</>}
        </p>
      )}
      {note && <p className="mb-2 text-[10.5px] text-[#fbbf24]">{note}</p>}
      {upgrade && (
        <p className="mb-2 text-[10.5px] text-[var(--color-dim)]">
          <span className="mr-1 rounded-full bg-[var(--color-accent)] px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-white">Pro</span>
          CSV export is part of Pro — the manufacturing handoff.{" "}
          <a href="/pricing" className="text-[var(--color-link)] hover:underline">See Pro ↗</a>
        </p>
      )}
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
