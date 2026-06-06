// Bridges the client's localStorage to the file-backed server store (/api/store).
//
//  · installMirror() wraps localStorage.setItem/removeItem so every `electrace:*` write is mirrored
//    to the server (debounced, fire-and-forget). One hook catches all stores — designs, the project
//    index, user blocks, and block schematics — without touching each call site.
//  · pullAll() hydrates localStorage from the server on startup, BACKFILLING ONLY keys that are
//    absent locally (so it can't clobber in-progress local edits). This is what restores your work
//    after clearing the browser cache or opening a fresh browser on this machine.
//
// localStorage is the fast cache; the server (web/.data) is the durable copy. Last write wins.
// Cross-device live-merge of a key edited in two places is intentionally out of scope for this
// interim — that's what the Supabase/Drizzle layer in storage.md is for.

const PREFIX = "electrace:";
const ENDPOINT = "/api/store";
const HYDRATED_EVENT = "electrace:hydrated";

let installed = false;
let origSet: ((k: string, v: string) => void) | null = null;
let origRem: ((k: string) => void) | null = null;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

/** Push one key to the server, debounced per-key (autosave writes the same key repeatedly). */
function push(key: string, value: string | null): void {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).catch(() => { /* offline — localStorage still holds it; next write re-syncs */ });
  }, 500);
}

/** Wrap localStorage so electrace:* writes mirror to the server. Idempotent + SSR-safe. */
export function installMirror(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const ls = window.localStorage;
  origSet = ls.setItem.bind(ls);
  origRem = ls.removeItem.bind(ls);
  ls.setItem = (k: string, v: string) => { origSet!(k, v); if (k.startsWith(PREFIX)) push(k, v); };
  ls.removeItem = (k: string) => { origRem!(k); if (k.startsWith(PREFIX)) push(k, null); };
}

/** Pull the server snapshot into localStorage, backfilling only absent keys. Returns #keys written. */
export async function pullAll(): Promise<number> {
  if (typeof window === "undefined") return 0;
  const ls = window.localStorage;
  const rawSet = origSet ?? ls.setItem.bind(ls); // bypass the mirror so hydration doesn't echo back
  let wrote = 0;
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = (await res.json()) as Record<string, string>;
    for (const [k, v] of Object.entries(data)) {
      if (ls.getItem(k) == null) { try { rawSet(k, v); wrote++; } catch { /* quota */ } }
    }
  } catch { /* offline — keep whatever localStorage has */ }
  if (wrote) { try { window.dispatchEvent(new Event(HYDRATED_EVENT)); } catch { /* ignore */ } }
  return wrote;
}

/** Subscribe to "server data just hydrated localStorage" so a view can re-read its store. */
export function onHydrated(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(HYDRATED_EVENT, fn);
  return () => window.removeEventListener(HYDRATED_EVENT, fn);
}
