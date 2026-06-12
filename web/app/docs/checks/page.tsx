import Link from "next/link";
import { CHECK_DOCS } from "@/lib/checkDocs";
import { SEV_LABEL, SevChip, CATEGORY_ORDER, CATEGORY_TITLES } from "./ui";

const SITE = "https://www.electrace.net";

export const metadata = {
  title: "Electrical check rules — what Electrace catches — Electrace",
  description: "Every rule the live checking engine can fire — over-voltage, rail budgets, thermal limits, signal integrity, isolation — what each one means, why it matters, and how to fix it.",
  alternates: { canonical: `${SITE}/docs/checks` },
};

export default function ChecksIndex() {
  return (
    <main className="mx-auto max-w-4xl px-7 py-12">
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">What the checks catch</h1>
      <p className="mt-2 max-w-2xl text-[16px] text-dim">
        Every finding the engine can raise, documented: what it examines, the physics of why it matters, and how to fix it.
        These are structural electrical checks computed from your actual schematic — not a simulation, and honest about the difference.
      </p>
      <p className="mt-3 text-[13.5px] text-faint">
        {CHECK_DOCS.length} rules · severities: {(["error", "warn", "info", "recommendation", "unknown"] as const).map((s) => SEV_LABEL[s]).join(" · ")}
      </p>

      {CATEGORY_ORDER.map((cat) => {
        const docs = CHECK_DOCS.filter((d) => d.category === cat);
        if (!docs.length) return null;
        return (
          <section key={cat} className="mt-10">
            <h2 className="text-[20px] font-bold tracking-tight">{CATEGORY_TITLES[cat]}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {docs.map((d) => (
                <Link key={d.slug} href={`/docs/checks/${d.slug}`} className="rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-semibold">{d.name}</span>
                    <SevChip sev={d.severity} />
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-[12.5px] text-faint">{d.what}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-12 rounded-2xl border border-border bg-surface p-5">
        <div className="text-[15px] font-bold">See them fire on your own design</div>
        <p className="mt-1 text-[13.5px] text-dim">The editor runs every rule live as you wire — no account needed to try it.</p>
        <Link href="/editor" className="mt-3 inline-block rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hi">Open the editor →</Link>
      </div>
    </main>
  );
}
