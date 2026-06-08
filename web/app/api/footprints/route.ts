// Server-side footprint library. The footprint registry is shared reference data (like the block
// library) — it belongs on the server, not crammed per-user into browser storage. The client uploads
// raw .kicad_mod text; the server parses it (parseKicadFootprint) and persists each footprint to disk
// (web/.data/footprints/<id>.json). Single-user, no auth — interim until the Supabase phase, when this
// becomes a real shared registry + per-user custom footprints.
import { promises as fs } from "fs";
import path from "path";
import { parseKicadFootprint, type Footprint } from "@electrace/core";

interface StoredFootprint { id: string; name: string; footprint: Footprint; addedAt: number }

const DIR = path.join(process.cwd(), ".data", "footprints");
const fileFor = (id: string) => path.join(DIR, encodeURIComponent(id).replace(/\*/g, "%2A") + ".json");
const ensureDir = () => fs.mkdir(DIR, { recursive: true });

/** GET → the whole footprint library as StoredFootprint[]. */
export async function GET() {
  await ensureDir();
  const out: StoredFootprint[] = [];
  for (const f of await fs.readdir(DIR)) {
    if (!f.endsWith(".json")) continue;
    try { out.push(JSON.parse(await fs.readFile(path.join(DIR, f), "utf8"))); } catch { /* skip */ }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return Response.json(out);
}

/** POST { files: [{ name, text }] } → parse + store each .kicad_mod. Returns { added, failed }. */
export async function POST(req: Request) {
  await ensureDir();
  const { files } = (await req.json().catch(() => ({}))) as { files?: { name: string; text: string }[] };
  if (!Array.isArray(files)) return Response.json({ error: "files[] required" }, { status: 400 });
  let added = 0, failed = 0;
  for (const f of files) {
    const parsed = typeof f?.text === "string" ? parseKicadFootprint(f.text) : null;
    if (!parsed || !parsed.footprint.pads.length) { failed++; continue; }
    const rec: StoredFootprint = { id: parsed.footprint.id, name: parsed.name, footprint: parsed.footprint, addedAt: Date.now() };
    try { await fs.writeFile(fileFor(rec.id), JSON.stringify(rec), "utf8"); added++; } catch { failed++; }
  }
  return Response.json({ added, failed });
}

/** DELETE { id } → remove a footprint. */
export async function DELETE(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await fs.rm(fileFor(id), { force: true });
  return Response.json({ ok: true });
}
