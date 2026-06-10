import Link from "next/link";
import { COMPARISONS } from "@/lib/comparisons";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Electrace vs the alternatives — honest comparisons",
  description: "How Electrace compares to Fritzing, Tinkercad Circuits, EasyEDA, and KiCad — including when each of THEM is the better choice.",
  alternates: { canonical: `${SITE}/vs` },
};

export default function VsIndex() {
  return (
    <main className="mx-auto max-w-4xl px-7 py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Honest comparisons</h1>
      <p className="mt-2 max-w-xl text-dim">Every page below names what the other tool does better, too — pick the right tool, even if it isn&apos;t us.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((c) => (
          <Link key={c.slug} href={`/vs/${c.slug}`} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent">
            <div className="text-[16px] font-bold">Electrace vs {c.name}</div>
            <p className="mt-1.5 text-[13.5px] text-dim">{c.tagline}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
