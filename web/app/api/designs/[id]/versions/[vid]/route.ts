// One version: GET → its full graph (for preview/inspection); POST {action:"restore"} →
// restore it. Restore is git-shaped: the design's CURRENT state is checkpointed first (so
// nothing is ever lost), then a NEW version is created whose parent is the restored one,
// and the design row is updated to match. History only ever grows.
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";
import { captureVersion } from "@/lib/versionCapture";

const unavailable = () => Response.json({ error: "Cloud designs are not available yet.", code: "unavailable" }, { status: 503 });

async function ctx(id: string, vid: string) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, design: null, version: null, pro: false };
  let pro = planForEmail(user.email) === "pro";
  if (!pro) {
    const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
    pro = data?.plan === "pro";
  }
  const { data: design } = await sb.from("designs").select("id, owner_id, graph, pcb").eq("id", id).maybeSingle();
  const { data: version } = await sb.from("design_versions").select("*").eq("id", Number(vid)).eq("design_id", id).maybeSingle();
  return { sb, user, design, version, pro };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; vid: string }> }) {
  if (!supabaseConfigured) return unavailable();
  const { id, vid } = await params;
  const { user, design, version } = await ctx(id, vid);
  if (!user) return Response.json({ error: "Sign in first.", code: "auth" }, { status: 401 });
  if (!design || design.owner_id !== user.id || !version) return Response.json({ error: "Not found.", code: "denied" }, { status: 404 });
  return Response.json({ version });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; vid: string }> }) {
  if (!supabaseConfigured) return unavailable();
  const { id, vid } = await params;
  const { sb, user, design, version, pro } = await ctx(id, vid);
  if (!user) return Response.json({ error: "Sign in first.", code: "auth" }, { status: 401 });
  if (!design || design.owner_id !== user.id || !version) return Response.json({ error: "Not found.", code: "denied" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "restore") return Response.json({ error: "Unknown action." }, { status: 400 });

  // 1. safety checkpoint of where the design is NOW (forced — never lose the pre-restore state)
  await captureVersion(sb, { designId: id, ownerId: user.id, graph: design.graph, pcb: design.pcb ?? undefined, pro, kind: "manual", label: "before restore" });
  // 2. the restore itself: a new version whose PARENT is the restored one
  const r = await captureVersion(sb, { designId: id, ownerId: user.id, graph: version.graph, pcb: version.pcb ?? undefined, pro, kind: "restore", label: version.label ? `restore of “${version.label}”` : undefined, parentId: version.id });
  // 3. the design row follows
  const { error } = await sb.from("designs").update({ graph: version.graph, ...(version.pcb !== undefined ? { pcb: version.pcb } : {}) }).eq("id", id);
  if (error) return Response.json({ error: "Could not restore." }, { status: 500 });
  return Response.json({ ok: true, id: r.id, graph: version.graph });
}
