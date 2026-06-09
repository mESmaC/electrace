// Designs CRUD — the P1 server home for projects (storage.md). Every query runs AS the signed-in
// user through the Supabase session, so Row-Level Security in Postgres is the real enforcement;
// the checks here exist for friendlier errors (and the free-tier design cap, which is a quota,
// not an ownership rule). Falls back cleanly (code: "unavailable") when Supabase isn't configured
// or the migration hasn't been applied — the client keeps working from localStorage.
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";

export const FREE_DESIGN_CAP = 10;

type Body = {
  id?: string; name?: string; visibility?: "public" | "unlisted" | "private";
  graph?: unknown; pcb?: unknown; meta?: unknown;
};

const unavailable = () => Response.json({ error: "Cloud designs are not available yet.", code: "unavailable" }, { status: 503 });

async function user() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}

/** Is this user pro? The users.plan column is the eventual truth (billing flips it); the
 *  SPARKY_PRO_EMAILS allowlist is the interim override until billing lands. */
async function isPro(sb: Awaited<ReturnType<typeof supabaseServer>>, uid: string, email: string | undefined): Promise<boolean> {
  if (planForEmail(email) === "pro") return true;
  const { data } = await sb.from("users").select("plan").eq("id", uid).maybeSingle();
  return data?.plan === "pro";
}

/** GET → the signed-in user's designs (metadata only — graphs are fetched per-design). */
export async function GET() {
  if (!supabaseConfigured) return unavailable();
  const { sb, user: u } = await user();
  if (!u) return Response.json({ error: "Sign in to list your designs.", code: "auth" }, { status: 401 });
  const { data, error } = await sb
    .from("designs")
    .select("id, name, visibility, meta, updated_at")
    .eq("owner_id", u.id)
    .order("updated_at", { ascending: false });
  if (error) return unavailable(); // most likely: migration not applied yet
  return Response.json({ designs: data });
}

/** POST → upsert one design (create or autosave — same call, keyed by the client id). */
export async function POST(req: Request) {
  if (!supabaseConfigured) return unavailable();
  const { sb, user: u } = await user();
  if (!u) return Response.json({ error: "Sign in to save designs to your account.", code: "auth" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.id || typeof b.id !== "string" || b.id.length > 80) return Response.json({ error: "Bad design id" }, { status: 400 });
  if (b.graph == null) return Response.json({ error: "Missing design graph" }, { status: 400 });
  if (JSON.stringify(b.graph).length > 1_500_000) return Response.json({ error: "Design too large" }, { status: 413 });

  const pro = await isPro(sb, u.id, u.email);
  if (b.visibility === "private" && !pro) {
    return Response.json({ error: "Private designs are part of Pro.", code: "upgrade" }, { status: 403 });
  }

  // the free design cap applies to NEW designs only — autosaves of existing ones always land
  const { data: existing } = await sb.from("designs").select("id").eq("id", b.id).maybeSingle();
  if (!existing && !pro) {
    const { count } = await sb.from("designs").select("id", { count: "exact", head: true }).eq("owner_id", u.id);
    if ((count ?? 0) >= FREE_DESIGN_CAP) {
      return Response.json({ error: `The Hobby plan includes ${FREE_DESIGN_CAP} designs — upgrade to Pro for unlimited.`, code: "cap" }, { status: 403 });
    }
  }

  const row = {
    id: b.id, owner_id: u.id,
    name: typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 200) : "Untitled project",
    ...(b.visibility ? { visibility: b.visibility } : {}),
    graph: b.graph,
    ...(b.pcb !== undefined ? { pcb: b.pcb } : {}),
    ...(b.meta !== undefined ? { meta: b.meta } : {}),
  };
  const { error } = await sb.from("designs").upsert(row, { onConflict: "id" });
  if (error) {
    // RLS rejections surface here too (e.g. trying to upsert someone else's id) — don't leak which
    return Response.json({ error: "Could not save this design.", code: "denied" }, { status: 403 });
  }
  return Response.json({ ok: true });
}
