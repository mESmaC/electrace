import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-7 py-24 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3.5 py-1.5 text-xs font-semibold text-accent">
        ⚡ The electrical engineer&apos;s IDE
      </span>
      <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight">
        See inside every circuit.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-dim">
        Blocks that explain themselves — and catch what doesn&apos;t add up.
      </p>
      <Link
        href="/blocks"
        className="mt-8 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-white transition-colors hover:bg-accent-hi"
      >
        Browse the block library →
      </Link>
    </main>
  );
}
