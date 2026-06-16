// Always-on LOCAL capture — the Shadowplay model. A rolling buffer of editor events lives in
// localStorage (capped, device-only, excluded from cloud sync via NO_MIRROR) and is transmitted
// in exactly one case: the user presses "Report a bug" and confirms a dialog that shows what's
// attached. No PII in events: only structured ids/types.
import type { ElectraceEvent, CapturedEvent } from "@electrace/core";

const CONSENT_KEY = "electrace:telemetry";
const STORE_KEY = "electrace:events";
const MAX = 2000;

let session = "";
function sessionId(): string {
  if (session) return session;
  try {
    session = sessionStorage.getItem("electrace:session") ?? "";
    if (!session) { session = "s-" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("electrace:session", session); }
  } catch { session = "s-mem"; }
  return session;
}

export function telemetryEnabled(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === "on"; } catch { return false; }
}

export function setTelemetry(on: boolean): void {
  try { localStorage.setItem(CONSENT_KEY, on ? "on" : "off"); window.dispatchEvent(new CustomEvent("electrace:telemetry")); } catch { /* ignore */ }
}

/** Record an event — a no-op unless the user has opted in. */
export function track(ev: ElectraceEvent): void {
  if (typeof window === "undefined") return;
  try {
    const arr: CapturedEvent[] = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    arr.push({ t: Date.now(), session: sessionId(), ev });
    if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    localStorage.setItem(STORE_KEY, JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent("electrace:telemetry"));
  } catch { /* ignore */ }
}

export function getEvents(): CapturedEvent[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]"); } catch { return []; }
}

export function clearEvents(): void {
  try { localStorage.removeItem(STORE_KEY); window.dispatchEvent(new CustomEvent("electrace:telemetry")); } catch { /* ignore */ }
}

// ── product-usage beacon (separate from the local Shadowplay buffer above) ───────────────────────
// Anonymous, aggregate "which feature got used" signal → /api/usage (service-role, RLS-locked). NOT
// consent-gated because it carries no PII and no design contents — only an event name + session id;
// the plan tag is resolved server-side. Buffered and flushed in batches (on idle + page-hide via
// sendBeacon) so it never blocks an interaction. This is the audience/feature data; track() above
// stays the local, consent-gated bug-report buffer.
let usageBuf: { event: string; url?: string; session: string; meta?: unknown }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushUsage(): void {
  if (typeof window === "undefined" || !usageBuf.length) return;
  const events = usageBuf; usageBuf = [];
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  const payload = JSON.stringify({ events });
  try {
    if (navigator.sendBeacon?.("/api/usage", new Blob([payload], { type: "application/json" }))) return;
  } catch { /* fall through */ }
  fetch("/api/usage", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => { /* telemetry never errors the app */ });
}

/** Record an anonymous product-usage event (a feature reached for). Batched + debounced. */
export function logUsage(event: string, meta?: unknown): void {
  if (typeof window === "undefined") return;
  usageBuf.push({ event, url: location.pathname, session: sessionId(), ...(meta !== undefined ? { meta } : {}) });
  if (usageBuf.length >= 20) { flushUsage(); return; }
  if (!flushTimer) flushTimer = setTimeout(flushUsage, 5000);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushUsage(); });
  window.addEventListener("pagehide", flushUsage);
}
