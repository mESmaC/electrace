"use client";
// The Pro card's CTA. With billing live it starts Stripe Checkout (monthly by default, yearly as
// the secondary); signed-out goes to login-then-back, and an unconfigured backend degrades to the
// signup link — the page never dead-ends.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpgradeCta() {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "month" | "year">(null);

  const go = async (interval: "month" | "year") => {
    if (busy) return;
    setBusy(interval);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interval }),
      });
      if (r.ok) { const { url } = await r.json(); if (url) { location.href = url; return; } }
      else if (r.status === 401) { router.push("/login?next=/pricing"); return; }
      else if (r.status === 503) { router.push("/signup"); return; }
      setBusy(null);
    } catch { setBusy(null); }
  };

  return (
    <div className="mt-5 flex flex-col gap-1.5">
      <button onClick={() => go("month")} disabled={!!busy}
        className="rounded-xl bg-accent py-2.5 text-center font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-hi disabled:opacity-60">
        {busy === "month" ? "Opening checkout…" : "Upgrade to Pro"}
      </button>
      <button onClick={() => go("year")} disabled={!!busy}
        className="py-1 text-center text-[12.5px] font-semibold text-accent hover:underline disabled:opacity-60">
        {busy === "year" ? "Opening checkout…" : "or pay yearly (best value)"}
      </button>
    </div>
  );
}
