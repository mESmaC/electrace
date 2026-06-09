// File-backed durable store for the client's `electrace:*` localStorage keys. localStorage stays the
// fast offline cache; this is the source of truth on disk (web/.data/kv/<key>.json). Single-user,
// no auth — an interim before the Supabase/Drizzle plan in storage.md. Values are stored verbatim
// (they're already JSON strings from localStorage), so the server never parses circuit shapes.
import { promises as fs } from "fs";
import path from "path";

// On Vercel the function root (/var/task) is READ-ONLY — only /tmp is writable (ephemeral, per-instance).
// This store is just an interim mirror of the client's localStorage (the real cache), so best-effort /tmp
// is fine until persistence moves to Postgres. The hard rule: never 500 — degrade quietly.
const BASE = process.env.VERCEL ? "/tmp" : process.cwd();
const DIR = path.join(BASE, ".data", "kv");
// encodeURIComponent strips "/" and ".." so a key can't escape DIR; also encode "*" for safety.
const fileFor = (key: string) => path.join(DIR, encodeURIComponent(key).replace(/\*/g, "%2A") + ".json");
const keyFromFile = (f: string) => decodeURIComponent(f.replace(/\.json$/, ""));
const ensureDir = () => fs.mkdir(DIR, { recursive: true });

/** GET → the whole snapshot as { "electrace:…": "<json string>" } for hydrating localStorage. */
export async function GET() {
  const out: Record<string, string> = {};
  try {
    await ensureDir();
    for (const f of await fs.readdir(DIR)) {
      if (!f.endsWith(".json")) continue;
      try { out[keyFromFile(f)] = await fs.readFile(path.join(DIR, f), "utf8"); } catch { /* skip */ }
    }
  } catch { /* no store yet / read-only fs — the client falls back to its own localStorage */ }
  return Response.json(out);
}

/** POST { key, value } → write one key; value null/omitted → delete it. */
export async function POST(req: Request) {
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: string | null };
  if (!key || !key.startsWith("electrace:")) {
    return Response.json({ error: "key must start with electrace:" }, { status: 400 });
  }
  try {
    await ensureDir();
    const file = fileFor(key);
    if (value == null) { await fs.rm(file, { force: true }); return Response.json({ ok: true, deleted: true }); }
    await fs.writeFile(file, value, "utf8");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, persisted: false }); // read-only fs — localStorage stays the source of truth
  }
}
