"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Route-level error boundary (Next convention). Caught render/runtime errors land here. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center px-7 py-16 text-center">
      <div>
        <div className="font-mono text-[56px] font-black leading-none tracking-tight text-amber">⚡</div>
        <h1 className="mt-3 text-2xl font-bold text-text">Something shorted out.</h1>
        <p className="mx-auto mt-2 max-w-sm text-dim">An unexpected error broke this page. Your saved work is safe — try again.</p>
        {error?.digest && <p className="mt-2 font-mono text-[11px] text-faint">ref {error.digest}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white transition hover:bg-accent-hi">Try again</button>
          <Link href="/" className="rounded-xl border border-border-strong px-5 py-2.5 font-semibold transition hover:border-accent hover:text-accent">Home</Link>
        </div>
      </div>
    </main>
  );
}
