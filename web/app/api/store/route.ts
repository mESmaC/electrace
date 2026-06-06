// File-backed durable store for the client's `electrace:*` localStorage keys. localStorage stays the
// fast offline cache; this is the source of truth on disk (web/.data/kv/<key>.json). Single-user,
// no auth — an interim before the Supabase/Drizzle plan in storage.md. Values are stored verbatim
// (they're already JSON strings from localStorage), so the server never parses circuit shapes.
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), ".data", "kv");
// encodeURIComponent strips "/" and ".." so a key can't escape DIR; also encode "*" for safety.
const fileFor = (key: string) => path.join(DIR, encodeURIComponent(key).replace(/\*/g, "%2A") + ".json");
const keyFromFile = (f: string) => decodeURIComponent(f.replace(/\.json$/, ""));
const ensureDir = () => fs.mkdir(DIR, { recursive: true });

/** GET → the whole snapshot as { "electrace:…": "<json string>" } for hydrating localStorage. */
export async function GET() {
  await ensureDir();
  const out: Record<string, string> = {};
  for (const f of await fs.readdir(DIR)) {
    if (!f.endsWith(".json")) continue;
    try { out[keyFromFile(f)] = await fs.readFile(path.join(DIR, f), "utf8"); } catch { /* skip */ }
  }
  return Response.json(out);
}

/** POST { key, value } → write one key; value null/omitted → delete it. */
export async function POST(req: Request) {
  await ensureDir();
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: string | null };
  if (!key || !key.startsWith("electrace:")) {
    return Response.json({ error: "key must start with electrace:" }, { status: 400 });
  }
  const file = fileFor(key);
  if (value == null) { await fs.rm(file, { force: true }); return Response.json({ ok: true, deleted: true }); }
  await fs.writeFile(file, value, "utf8");
  return Response.json({ ok: true });
}
