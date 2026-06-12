"use client";
// Production error monitoring: uncaught exceptions + unhandled rejections, reported once each
// per session (deduped by message) to /api/client-error. Deliberately tiny — no vendor SDK,
// no sampling config, no PII beyond the page path and (server-side) the signed-in email.
import { useEffect } from "react";

const seen = new Set<string>();
let sent = 0;

function report(message: string, stack?: string) {
  if (process.env.NODE_ENV !== "production") return;     // dev consoles already show everything
  const key = message.slice(0, 200);
  if (!key || seen.has(key) || sent >= 5) return;         // first occurrence only, 5 per session max
  // browser-extension and cross-origin noise: not ours, not actionable
  if (/extension:|moz-extension|safari-extension/.test(stack ?? "") || message === "Script error.") return;
  seen.add(key);
  sent++;
  const body = JSON.stringify({
    message: message.slice(0, 600),
    stack: stack?.slice(0, 4000),
    url: location.pathname,
    meta: { vw: innerWidth, vh: innerHeight, lang: navigator.language },
  });
  try {
    if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" }))) {
      fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* reporting must never throw */ }
}

export default function ErrorMonitor() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => report(e.message || String(e.error ?? "unknown error"), e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : `unhandled rejection: ${String(r).slice(0, 300)}`, r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
