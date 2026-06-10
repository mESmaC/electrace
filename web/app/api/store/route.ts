// Durable store for the client's `electrace:*` localStorage keys. localStorage stays the fast
// offline cache; this is the durable copy. Two backends, same interface:
//  · SIGNED IN → Postgres `user_kv` (RLS owner-only) — user blocks, block drafts, settings, the
//    project index all survive devices and deploys. (Designs have their own table/API.)
//  · anonymous/local → the original file store (web/.data locally, /tmp on Vercel — ephemeral
//    there, which is fine: real persistence requires an account).
// Values are stored verbatim (they're already JSON strings), so the server never parses shapes.
import { promises as fs } from "fs";
import path from "path";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

const BASE = process.env.VERCEL ? "/tmp" : process.cwd();
const DIR = path.join(BASE, ".data", "kv");
const fileFor = (key: string) => path.join(DIR, encodeURIComponent(key).replace(/\*/g, "%2A") + ".json");
const keyFromFile = (f: string) => decodeURIComponent(f.replace(/\.json$/, ""));
const ensureDir = () => fs.mkdir(DIR, { recursive: true });

async function userOrNull() {
  if (!supabaseConfigured) return { sb: null, user: null };
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

/** GET → the whole snapshot as { "electrace:…": "<json string>" } for hydrating localStorage. */
export async function GET() {
  const { sb, user } = await userOrNull();
  if (sb && user) {
    const { data, error } = await sb.from("user_kv").select("k, v").eq("owner_id", user.id);
    if (!error) return Response.json(Object.fromEntries((data ?? []).map((r) => [r.k, r.v])));
    // table missing (migration not applied) → fall through to the file store
  }
  const out: Record<string, string> = {};
  try {
    await ensureDir();
    for (const f of await fs.readdir(DIR)) {
      if (!f.endsWith(".json")) continue;
      try { out[keyFromFile(f)] = await fs.readFile(path.join(DIR, f), "utf8"); } catch { /* skip */ }
    }
  } catch { /* no store yet — client falls back to its own localStorage */ }
  return Response.json(out);
}

/** POST { key, value } → write one key; value null/omitted → delete it. */
export async function POST(req: Request) {
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: string | null };
  if (!key || !key.startsWith("electrace:")) {
    return Response.json({ error: "key must start with electrace:" }, { status: 400 });
  }
  if (typeof value === "string" && value.length > 2_000_000) {
    return Response.json({ error: "value too large" }, { status: 413 });
  }
  const { sb, user } = await userOrNull();
  if (sb && user) {
    const r = value == null
      ? await sb.from("user_kv").delete().eq("owner_id", user.id).eq("k", key)
      : await sb.from("user_kv").upsert({ owner_id: user.id, k: key, v: value }, { onConflict: "owner_id,k" });
    if (!r.error) return Response.json({ ok: true, durable: true });
    // table missing → fall through to the file store rather than dropping the write
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
