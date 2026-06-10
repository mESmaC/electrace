"use client";
// "Report a bug" — the only path by which the local capture buffer ever leaves the device.
// One press opens a confirm dialog that says EXACTLY what's attached (and lets you look at it);
// nothing is sent until the user chooses to send it.
import { useState } from "react";
import { getEvents } from "@/lib/telemetry";

export default function ReportBug({ getDesign }: { getDesign?: () => unknown }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [includeDesign, setIncludeDesign] = useState(true);
  const [showData, setShowData] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  const events = open ? getEvents().slice(-300) : [];
  const design = open && includeDesign && getDesign ? getDesign() : null;

  const send = async () => {
    setState("busy");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: desc.trim(),
          events,
          design: includeDesign ? design : null,
          meta: { url: location.pathname, ua: navigator.userAgent.slice(0, 200) },
        }),
      });
      setState(r.ok ? "sent" : "error");
    } catch { setState("error"); }
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setState("idle"); }}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
        title="Something off? Send a report with the context already attached.">
        ⚑ Report a bug
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-[460px] rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {state === "sent" ? (
          <>
            <div className="text-[16px] font-bold text-[var(--color-text)]">Sent — thank you.</div>
            <p className="mt-1.5 text-[13px] text-[var(--color-dim)]">The report includes the context we need to actually reproduce it. Genuinely appreciated.</p>
            <button onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl border border-[var(--color-border-strong)] py-2 text-[13px] font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]">Close</button>
          </>
        ) : (
          <>
            <div className="text-[16px] font-bold text-[var(--color-text)]">Report a bug</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-dim)]">
              Nothing has been sent yet. This will send — once, now, and only if you press Send:
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-[var(--color-dim)]">
              <li>· your description below</li>
              <li>· the last {events.length} editor events from this device&apos;s local buffer (actions, not content){" "}
                <button onClick={() => setShowData((v) => !v)} className="text-[var(--color-accent)] hover:underline">{showData ? "hide" : "view"}</button></li>
              <li>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={includeDesign} onChange={(e) => setIncludeDesign(e.target.checked)} className="accent-[var(--color-accent)]" />
                  a snapshot of the current design (so we can reproduce it)
                </label>
              </li>
              <li>· the page you&apos;re on + browser version</li>
            </ul>
            {showData && (
              <pre className="mt-2 max-h-[140px] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[10px] leading-snug text-[var(--color-dim)]">{JSON.stringify(events, null, 1)}</pre>
            )}
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} autoFocus
              placeholder="What happened? What did you expect?"
              className="mt-3 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-2.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
            {state === "error" && <p className="mt-2 text-[12px] text-[#f87171]">Couldn&apos;t send — try again in a moment.</p>}
            <div className="mt-3 flex gap-2.5">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-[var(--color-border-strong)] py-2.5 text-[13px] font-semibold text-[var(--color-dim)] hover:text-[var(--color-text)]">Cancel — send nothing</button>
              <button onClick={send} disabled={state === "busy" || !desc.trim()}
                className="flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                {state === "busy" ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
