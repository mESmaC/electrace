"use client";
// Version history dialog: the design's timeline — auto checkpoints, named snapshots, restores.
// Restore is loss-proof (the server checkpoints the current state first, then creates a new
// version parented on the restored one); the dialog just has to ask and reload.
import { useEffect, useState } from "react";
import type { Design } from "@electrace/core";
import { confirmDialog, promptDialog } from "@/app/ui/dialog";
import { pushDesignNow } from "@/lib/designsSync";

interface Version { id: number; parent_id: number | null; kind: "auto" | "manual" | "restore"; label: string | null; summary: { blocks?: number; connections?: number; name?: string } | null; created_at: string }

const KIND_BADGE: Record<Version["kind"], { txt: string; cls: string }> = {
  auto: { txt: "auto", cls: "text-[var(--color-faint)] border-[var(--color-border)]" },
  manual: { txt: "saved", cls: "text-[#46dca6] border-[#46dca6]/40" },
  restore: { txt: "restore", cls: "text-[var(--color-link)] border-[var(--color-link)]/40" },
};

function rel(t: string): string {
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleString();
}

export default function HistoryDialog({ designId, signedIn, onClose, onRestore }: {
  designId: string; signedIn: boolean; onClose: () => void; onRestore: (d: Design) => void;
}) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [pro, setPro] = useState(false);
  const [keep, setKeep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch(`/api/designs/${encodeURIComponent(designId)}/versions`).catch(() => null);
    if (!r?.ok) { setVersions([]); setNote(r?.status === 401 ? "auth" : "err"); return; }
    const d = await r.json();
    setVersions(d.versions ?? []); setPro(!!d.pro); setKeep(d.keep ?? null); setNote(null);
  };
  useEffect(() => { if (signedIn) void load(); }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveVersion = async () => {
    const label = await promptDialog({ title: "Save a version", message: "Name this point in time — you can restore to it any time.", placeholder: "e.g. before PCB rework", confirmText: "Save version" });
    if (label === null) return;
    setBusy(true);
    await pushDesignNow(designId); // capture exactly what's on the canvas
    const r = await fetch(`/api/designs/${encodeURIComponent(designId)}/versions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) void load(); else setNote("err");
  };

  const restore = async (v: Version) => {
    const what = v.label || `the ${KIND_BADGE[v.kind].txt} version from ${rel(v.created_at)}`;
    if (!(await confirmDialog({ title: "Restore this version?", message: `The canvas becomes ${what}. Nothing is lost — the current state is checkpointed first and history only grows.`, confirmText: "Restore" }))) return;
    setBusy(true);
    const r = await fetch(`/api/designs/${encodeURIComponent(designId)}/versions/${v.id}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "restore" }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setNote("err"); return; }
    const d = await r.json();
    onRestore(d.graph as Design);
    void load();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
          <span className="text-[15px] font-bold text-[var(--color-text)]">Version history</span>
          <button onClick={saveVersion} disabled={busy || !signedIn} className="rounded-lg bg-[var(--color-accent)] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50">＋ Save version</button>
          <button onClick={onClose} className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-[var(--color-faint)] hover:text-[var(--color-text)]">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!signedIn ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--color-dim)]">Version history lives with your account — <a href="/signup" className="text-[var(--color-link)] underline">sign up free</a> and every save starts building a timeline.</p>
          ) : versions === null ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--color-faint)]">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-[var(--color-dim)]">{note === "auth" ? "Sign in to see this design's history." : "No versions yet — they accumulate as you edit, and ＋ Save version pins one on demand."}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5">
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${KIND_BADGE[v.kind].cls}`}>{KIND_BADGE[v.kind].txt}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[var(--color-text)]">{v.label || (v.summary?.name ?? "Checkpoint")}</div>
                    <div className="text-[11px] text-[var(--color-faint)]">{rel(v.created_at)}{v.summary ? ` · ${v.summary.blocks ?? 0} blocks · ${v.summary.connections ?? 0} wires` : ""}</div>
                  </div>
                  <button onClick={() => restore(v)} disabled={busy} className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:opacity-50">Restore</button>
                </div>
              ))}
            </div>
          )}
          {note === "err" && <p className="mt-3 text-center text-[12px] text-[#e2837e]">Something went wrong — try again in a moment.</p>}
        </div>
        {signedIn && keep != null && (
          <div className="border-t border-[var(--color-border)] px-5 py-2.5 text-[11.5px] text-[var(--color-dim)]">
            Hobby keeps the latest {keep} versions — <a href="/pricing" className="text-[var(--color-link)] underline">Pro</a> keeps your deep history.
          </div>
        )}
      </div>
    </div>
  );
}
