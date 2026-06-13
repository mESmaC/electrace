// Cloud sync for DESIGNS — the real Postgres home (/api/designs), distinct from the interim kv
// mirror in serverSync.ts. Local-first, server-authoritative (storage.md): the editor keeps writing
// localStorage exactly as before; the mirror routes design keys here, and reconcile() merges the
// account's designs on startup (newer updatedAt wins) — which is also the localStorage→account
// import on first sign-in. Everything no-ops quietly when signed out or the backend isn't live.
import type { Design } from "@electrace/core";
import type { ProjectMeta } from "./projects";

const INDEX = "electrace:projects";
const DESIGN_RE = /^electrace:design:(.+)$/;
const PCB_RE = /^electrace:pcb:(.+)$/;

let available = true; // flips false on 503 (unconfigured / migration missing) — stop retry noise
let signedOut = false; // flips true on 401 — reconcile() resets it (a new session may exist)

const keepalive = () => typeof document !== "undefined" && document.visibilityState === "hidden";

async function api(path: string, init?: RequestInit): Promise<Response | null> {
  if (!available) return null;
  try {
    const r = await fetch(path, { ...init, keepalive: init?.keepalive ?? keepalive(), headers: { "content-type": "application/json", ...init?.headers } });
    if (r.status === 503) available = false;
    if (r.status === 401) signedOut = true;
    return r;
  } catch { return null; } // offline — localStorage still holds it
}

const readJson = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
};
const metaOf = (id: string): ProjectMeta | undefined => (readJson<ProjectMeta[]>(INDEX) ?? []).find((p) => p.id === id);

/** Push one design (graph + dashboard meta + any saved board) up to the account.
 *  Deliberately NEVER sends visibility — an autosave must not change how a design is shared
 *  (and the local value is a stale stub artifact anyway). Visibility changes are an explicit
 *  user action: the editor's Share dialog PATCHes it. */
export async function pushDesignNow(id: string): Promise<void> {
  if (signedOut) return;
  const d = readJson<Design>(`electrace:design:${id}`);
  if (!d) return;
  const m = metaOf(id);
  const r = await api("/api/designs", {
    method: "POST",
    body: JSON.stringify({
      id, name: d.name || m?.name,
      graph: d, pcb: readJson(`electrace:pcb:${id}`) ?? undefined,
      meta: { lint: m?.lint, starred: m?.starred, updatedAt: m?.updatedAt },
    }),
  });
  if (r && !r.ok && r.status !== 401 && r.status !== 503) {
    // cap / upgrade / denied — surface for the dashboard to show, don't silently eat it
    const body = await r.json().catch(() => ({}));
    try { window.dispatchEvent(new CustomEvent("electrace:designsync", { detail: { id, ...body } })); } catch { /* ignore */ }
  }
}

/** Mirror hook: called by serverSync for every localStorage write. Returns true when the key is
 *  design-shaped and was routed here (the kv mirror then skips it — designs have a real home now). */
export function syncDesignKey(key: string, value: string | null): boolean {
  const dm = key.match(DESIGN_RE);
  if (dm) {
    if (value === null) void api(`/api/designs/${encodeURIComponent(dm[1])}`, { method: "DELETE" });
    else void pushDesignNow(dm[1]);
    return true;
  }
  const pm = key.match(PCB_RE);
  if (pm) {
    if (value !== null) {
      void api(`/api/designs/${encodeURIComponent(pm[1])}`, { method: "PATCH", body: JSON.stringify({ pcb: JSON.parse(value) }) })
        .then((r) => { if (r?.status === 404) void pushDesignNow(pm[1]); }); // board saved before the design row — create it
    }
    return true;
  }
  if (key === INDEX) {
    // star/lint/rename touch only the index — patch metas for entries that changed since our last look
    const cur = readJson<ProjectMeta[]>(INDEX) ?? [];
    for (const p of cur) {
      const prev = lastIndex.get(p.id);
      if (!prev || prev.name !== p.name || prev.starred !== p.starred || JSON.stringify(prev.lint) !== JSON.stringify(p.lint)) {
        void api(`/api/designs/${encodeURIComponent(p.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ name: p.name, meta: { lint: p.lint, starred: p.starred, updatedAt: p.updatedAt } }),
        });
      }
      lastIndex.set(p.id, p);
    }
    return false; // the index still goes to the kv mirror too (cheap, and pullAll backfills it)
  }
  return false;
}
const lastIndex = new Map<string, ProjectMeta>();

// ── delete tombstones ────────────────────────────────────────────────────────────────────
// A deleted design is "missing locally" — exactly what reconcileDesigns treats as
// pull-me-from-the-server. Without a tombstone, ANY lost DELETE (debounce + refresh,
// offline, a latched 401) resurrects the project on next load. The tombstone makes the
// delete intent durable until the server confirms (ok or 404), then clears itself.
const TOMBS = "electrace:tombstones"; // in serverSync's NO_MIRROR set — local bookkeeping only
const readTombs = (): string[] => readJson<string[]>(TOMBS) ?? [];
const writeTombs = (ids: string[]) => { try { localStorage.setItem(TOMBS, JSON.stringify(ids)); } catch { /* ignore */ } };

/** Record the delete intent durably, then push it to the server (keepalive — survives unload). */
export function markDesignDeleted(id: string): void {
  writeTombs([...new Set([...readTombs(), id])]);
  void confirmDelete(id);
}
async function confirmDelete(id: string): Promise<void> {
  const r = await api(`/api/designs/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true });
  if (r && (r.ok || r.status === 404)) writeTombs(readTombs().filter((x) => x !== id));
}

/** Merge the account's designs with local work — both directions, newer updatedAt wins.
 *  Covers cross-device pull AND the first-sign-in import of pre-account local designs.
 *  `rawWrite` must bypass the mirror (or every pulled design would echo straight back up). */
export async function reconcileDesigns(rawWrite: (k: string, v: string) => void): Promise<number> {
  signedOut = false;
  const r = await api("/api/designs");
  if (!r || !r.ok) return 0;
  const { designs: remote } = (await r.json()) as { designs: { id: string; name: string; meta?: { updatedAt?: number }; updated_at: string }[] };
  const index = readJson<ProjectMeta[]>(INDEX) ?? [];
  const localById = new Map(index.map((p) => [p.id, p]));
  let changed = 0;

  // pull: remote designs that are missing locally or newer than the local copy
  const tombs = new Set(readTombs());
  for (const d of remote) {
    if (tombs.has(d.id)) { void confirmDelete(d.id); continue; } // deleted HERE — finish the delete, don't resurrect
    const local = localById.get(d.id);
    const remoteStamp = d.meta?.updatedAt ?? Date.parse(d.updated_at);
    if (local && local.updatedAt >= remoteStamp && localStorage.getItem(`electrace:design:${d.id}`)) continue;
    const fr = await api(`/api/designs/${encodeURIComponent(d.id)}`);
    if (!fr?.ok) continue;
    const { design } = (await fr.json()) as { design: { graph: Design; pcb?: unknown; name: string; meta?: { lint?: ProjectMeta["lint"]; starred?: boolean } } };
    rawWrite(`electrace:design:${d.id}`, JSON.stringify(design.graph));
    if (design.pcb != null) rawWrite(`electrace:pcb:${d.id}`, JSON.stringify(design.pcb));
    const meta: ProjectMeta = { id: d.id, name: design.name, updatedAt: remoteStamp, lint: design.meta?.lint, starred: design.meta?.starred };
    localById.set(d.id, meta);
    changed++;
  }
  if (changed) rawWrite(INDEX, JSON.stringify([...localById.values()].sort((a, b) => b.updatedAt - a.updatedAt)));

  // import/push: local designs the account doesn't have yet (the pre-account work).
  // ALSO sweep raw design keys missing from the index — first-rev designs predate the
  // index and were invisible to this loop (Cameron's cross-system gap): rebuild their
  // meta from the design itself so they push like everything else.
  const indexIds = new Set(index.map((p) => p.id));
  let indexGrew = false;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const m = k?.match(/^electrace:design:(.+)$/);
    if (!m || indexIds.has(m[1]) || readTombs().includes(m[1])) continue;
    const d = readJson<Design>(k!);
    if (!d || !Array.isArray(d.blocks)) continue;
    index.push({ id: m[1], name: d.name || "Untitled project", updatedAt: Date.now() });
    indexIds.add(m[1]);
    indexGrew = true;
  }
  if (indexGrew) rawWrite(INDEX, JSON.stringify([...index].sort((a, b) => b.updatedAt - a.updatedAt)));
  const remoteIds = new Set(remote.map((d) => d.id));
  for (const p of index) if (!remoteIds.has(p.id)) await pushDesignNow(p.id);

  for (const p of localById.values()) lastIndex.set(p.id, p);
  return changed;
}
