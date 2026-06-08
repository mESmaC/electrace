"use client";
import { useEffect, useRef, useState } from "react";

// A themed replacement for window.prompt / confirm / alert. Promise-based so call sites just `await` it:
//   if (await confirmDialog({ title: "Delete?", danger: true })) { ... }
//   const name = await promptDialog({ title: "Rename", defaultValue: cur });
// A single <DialogHost/> (mounted in the root layout) renders whatever's requested.

type Kind = "confirm" | "prompt" | "alert";
type Req = {
  kind: Kind; title: string; message?: string;
  confirmText?: string; cancelText?: string; danger?: boolean;
  defaultValue?: string; placeholder?: string;
  resolve: (v: unknown) => void;
};
type Opts = Omit<Req, "kind" | "resolve">;

let emit: ((r: Req | null) => void) | null = null;
const fallback = (k: Kind) => (k === "confirm" ? false : k === "prompt" ? null : undefined);

function request(kind: Kind, opts: Opts): Promise<unknown> {
  return new Promise((resolve) => {
    if (!emit) { resolve(fallback(kind)); return; } // no host yet (SSR) — resolve safely
    emit({ kind, ...opts, resolve });
  });
}

export const confirmDialog = (o: Opts): Promise<boolean> => request("confirm", o) as Promise<boolean>;
export const promptDialog = (o: Opts): Promise<string | null> => request("prompt", o) as Promise<string | null>;
export const alertDialog = (o: Opts): Promise<void> => request("alert", o) as Promise<void>;

export function DialogHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emit = (r) => { setReq(r); setVal(r?.defaultValue ?? ""); }; return () => { emit = null; }; }, []);
  useEffect(() => { if (req?.kind === "prompt") inputRef.current?.select(); }, [req]);

  if (!req) return null;
  const done = (v: unknown) => { req.resolve(v); setReq(null); };
  const confirm = () => done(req.kind === "confirm" ? true : req.kind === "prompt" ? val : undefined);
  const cancel = () => done(fallback(req.kind));

  return (
    <div
      role="dialog" aria-modal="true"
      className="fixed inset-0 z-[120] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
        else if (e.key === "Enter" && req.kind !== "prompt") { e.preventDefault(); confirm(); }
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl">
        <h2 className="text-[16px] font-bold text-text">{req.title}</h2>
        {req.message && <p className="mt-1.5 text-[14px] leading-relaxed text-dim">{req.message}</p>}
        {req.kind === "prompt" && (
          <input
            ref={inputRef} autoFocus value={val} placeholder={req.placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
            className="mt-3.5 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          {req.kind !== "alert" && (
            <button onClick={cancel} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-dim transition hover:border-accent hover:text-text">
              {req.cancelText ?? "Cancel"}
            </button>
          )}
          <button
            autoFocus={req.kind !== "prompt"} onClick={confirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${req.danger ? "bg-[#e2554b] hover:bg-[#cf4940]" : "bg-accent hover:bg-accent-hi"}`}
          >
            {req.confirmText ?? (req.kind === "alert" ? "OK" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
