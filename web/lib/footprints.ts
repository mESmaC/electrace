// A local library of imported KiCad footprints. Parse .kicad_mod files (single, or a whole .pretty folder
// via multi-select) into our Footprint model and keep them in localStorage so they can be browsed and —
// later — assigned to parts in the PCB editor. The parsing lives in core (parseKicadFootprint).
import { useEffect, useState } from "react";
import { parseKicadFootprint, type Footprint } from "@electrace/core";

export interface StoredFootprint { id: string; name: string; footprint: Footprint; addedAt: number }

const KEY = "electrace:footprints";
const EVT = "electrace:footprints";

export function getFootprints(): StoredFootprint[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredFootprint[]; } catch { return []; }
}
function write(list: StoredFootprint[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ }
}

/** Parse + store one or more .kicad_mod texts (same id replaces). Returns added/failed counts. */
export function importKicadFootprints(files: { name: string; text: string }[]): { added: number; failed: number } {
  const byId = new Map(getFootprints().map((f) => [f.id, f]));
  let added = 0, failed = 0;
  for (const f of files) {
    const parsed = parseKicadFootprint(f.text);
    if (!parsed || !parsed.footprint.pads.length) { failed++; continue; }
    byId.set(parsed.footprint.id, { id: parsed.footprint.id, name: parsed.name, footprint: parsed.footprint, addedAt: Date.now() });
    added++;
  }
  write([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
  return { added, failed };
}

export function removeFootprint(id: string): void { write(getFootprints().filter((f) => f.id !== id)); }

/** Subscribe to the imported-footprint library. */
export function useFootprints(): StoredFootprint[] {
  const [list, setList] = useState<StoredFootprint[]>([]);
  useEffect(() => {
    const sync = () => setList(getFootprints());
    sync();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) sync(); };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", onStorage); };
  }, []);
  return list;
}
