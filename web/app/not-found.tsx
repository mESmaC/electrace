import Link from "next/link";

export const metadata = { title: "Not found — Electrace" };

export default function NotFound() {
  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-7 py-16 text-center">
      <div>
        <div className="font-mono text-[64px] font-black leading-none tracking-tight text-accent">404</div>
        <h1 className="mt-3 text-2xl font-bold text-text">This net goes nowhere.</h1>
        <p className="mx-auto mt-2 max-w-sm text-dim">The page you&apos;re after isn&apos;t connected to anything. Check the address, or head back to a known node.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition hover:bg-accent-hi">Home</Link>
          <Link href="/projects" className="rounded-xl border border-border-strong px-5 py-2.5 font-semibold transition hover:border-accent hover:text-accent">Your designs</Link>
        </div>
      </div>
    </main>
  );
}
