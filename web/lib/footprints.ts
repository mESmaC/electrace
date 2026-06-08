// Client view of the footprint library, which lives SERVER-SIDE (/api/footprints) — footprints are
// shared reference data like the block library, not per-user browser data. The client uploads raw
// .kicad_mod text; the server parses + persists it. No bulky browser storage.
import { useEffect, useState } from "react";
import type { Footprint } from "@electrace/core";

export interface StoredFootprint { id: string; name: string; footprint: Footprint; addedAt: number }

const ENDPOINT = "/api/footprints";
const EVT = "electrace:footprints";
const notify = () => { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } };

export async function getFootprints(): Promise<StoredFootprint[]> {
  try { const r = await fetch(ENDPOINT, { cache: "no-store" }); return r.ok ? (await r.json()) as StoredFootprint[] : []; } catch { return []; }
}

/** Upload .kicad_mod files; the server parses + stores them. Returns added/failed counts. */
export async function importKicadFootprints(files: { name: string; text: string }[]): Promise<{ added: number; failed: number }> {
  try {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) });
    const out = r.ok ? await r.json() : { added: 0, failed: files.length };
    notify();
    return out;
  } catch { return { added: 0, failed: files.length }; }
}

export async function removeFootprint(id: string): Promise<void> {
  try { await fetch(ENDPOINT, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); notify(); } catch { /* ignore */ }
}

/** Subscribe to the footprint library (loads from the server). */
export function useFootprints(): StoredFootprint[] {
  const [list, setList] = useState<StoredFootprint[]>([]);
  useEffect(() => {
    let alive = true;
    const sync = () => { getFootprints().then((l) => { if (alive) setList(l); }); };
    sync();
    window.addEventListener(EVT, sync);
    return () => { alive = false; window.removeEventListener(EVT, sync); };
  }, []);
  return list;
}
