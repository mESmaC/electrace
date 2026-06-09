// One design: read (owner or public/unlisted — RLS decides), update fields, delete.
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";

const unavailable = () => Response.json({ error: "Cloud designs are not available yet.", code: "unavailable" }, { status: 503 });

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!supabaseConfigured) return unavailable();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  // RLS: returns the row iff it's public/unlisted or yours — a private design you don't own is a clean 404
  const { data, error } = await sb.from("designs").select("id, owner_id, name, visibility, graph, pcb, meta, updated_at").eq("id", id).maybeSingle();
  if (error) return unavailable();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  const { data: { user } } = await sb.auth.getUser();
  return Response.json({ design: data, owned: !!user && user.id === data.owner_id });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!supabaseConfigured) return unavailable();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first.", code: "auth" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { name?: string; visibility?: "public" | "unlisted" | "private"; graph?: unknown; pcb?: unknown; meta?: unknown };
  if (b.visibility === "private" && planForEmail(user.email) !== "pro") {
    const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
    if (data?.plan !== "pro") return Response.json({ error: "Private designs are part of Pro.", code: "upgrade" }, { status: 403 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 200);
  if (b.visibility) patch.visibility = b.visibility;
  if (b.graph !== undefined) patch.graph = b.graph;
  if (b.pcb !== undefined) patch.pcb = b.pcb;
  if (b.meta !== undefined) patch.meta = b.meta;
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await sb.from("designs").update(patch).eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();
  if (error) return Response.json({ error: "Could not update.", code: "denied" }, { status: 403 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!supabaseConfigured) return unavailable();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first.", code: "auth" }, { status: 401 });
  const { error } = await sb.from("designs").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return Response.json({ error: "Could not delete.", code: "denied" }, { status: 403 });
  return Response.json({ ok: true });
}
