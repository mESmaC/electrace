// Consent-gated local capture for editor telemetry. Default OFF — `track()` is a no-op until
// the user opts in. Events buffer to localStorage (capped) in the canonical core shape, ready
// to inspect, export, or later ship to a collection endpoint. No PII: only structured ids/types.
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
  if (typeof window === "undefined" || !telemetryEnabled()) return;
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
