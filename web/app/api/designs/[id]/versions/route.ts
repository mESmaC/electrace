// Version history for one design. GET → the timeline (metadata only); POST → a manual
// snapshot of the design's CURRENT stored graph (the client pushes the design first, then
// snapshots — so "Save version" captures exactly what the server has).
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";
import { captureVersion, FREE_VERSION_KEEP } from "@/lib/versionCapture";

const unavailable = () => Response.json({ error: "Cloud designs are not available yet.", code: "unavailable" }, { status: 503 });

async function ctx(id: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, design: null, pro: false };
  let pro = planForEmail(user.email) === "pro";
  if (!pro) {
    const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
    pro = data?.plan === "pro";
  }
  const { data: design } = await sb.from("designs").select("id, owner_id, graph, pcb").eq("id", id).maybeSingle();
  return { sb, user, design, pro };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return unavailable();
  const { id } = await params;
  const { sb, user, design, pro } = await ctx(id);
  if (!user) return Response.json({ error: "Sign in to see version history.", code: "auth" }, { status: 401 });
  if (!design || design.owner_id !== user.id) return Response.json({ error: "Not your design.", code: "denied" }, { status: 403 });
  const { data, error } = await sb
    .from("design_versions")
    .select("id, parent_id, kind, label, summary, created_at")
    .eq("design_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: "Could not load history." }, { status: 500 });
  return Response.json({ versions: data ?? [], pro, keep: pro ? null : FREE_VERSION_KEEP });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return unavailable();
  const { id } = await params;
  const { sb, user, design, pro } = await ctx(id);
  if (!user) return Response.json({ error: "Sign in to save versions.", code: "auth" }, { status: 401 });
  if (!design || design.owner_id !== user.id) return Response.json({ error: "Not your design.", code: "denied" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const r = await captureVersion(sb, {
    designId: id, ownerId: user.id, graph: design.graph, pcb: design.pcb ?? undefined,
    pro, kind: "manual", label: typeof body.label === "string" ? body.label.trim() : undefined,
  });
  if (!r.id) return Response.json({ error: "Could not save a version." }, { status: 500 });
  return Response.json({ ok: true, id: r.id });
}
