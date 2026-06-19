"use client";
// The share page's actions: copy the link, or fork the design into YOUR workspace ("open a
// copy"). The fork is client-side on purpose — createProject writes the copy to localStorage
// (the local-first home) and the sync mirror pushes it to the visitor's own account; the editor
// route's auth gate handles sign-in if they don't have one yet.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Design } from "@electrace/core";
import { createProject } from "@/lib/projects";
import { logUsage } from "@/lib/telemetry";

export default function ShareActions({ id, name, graph }: { id: string; name: string; graph: Design }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/share/${id}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };
  const openCopy = () => {
    logUsage("share.fork", {}); // the viral-entry event: a visitor forks someone's public design
    const meta = createProject(`${name} (copy)`, graph);
    router.push(`/editor?p=${meta.id}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={openCopy}
        className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white hover:opacity-90">
        Open a copy in Electrace
      </button>
      <button onClick={copy}
        className="rounded-lg border border-border-strong bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-text hover:border-accent">
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
