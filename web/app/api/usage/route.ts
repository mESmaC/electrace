// Product-usage telemetry sink. Same posture as /api/client-error + /api/feedback: service-role
// insert into an RLS-locked table, size-capped, throttled, and it NEVER errors back at the client
// (telemetry must never break or retry-loop the app). Records anonymous feature events tagged with
// the user's plan — the audience/feature signal. The plan is resolved SERVER-side (not trusted from
// the client). No design contents are accepted; meta is small structured extras only.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";

let recent: number[] = []; // per-instance burst guard — 120/min absorbs a busy session, caps abuse

type InEvent = { event?: string; url?: string; session?: string; meta?: unknown };

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 16_000) return Response.json({ ok: true, stored: false });
  const now = Date.now();
  recent = recent.filter((t) => now - t < 60_000);
  if (recent.length >= 120) return Response.json({ ok: true, stored: false }); // shed silently

  const body = (await req.json().catch(() => null)) as { events?: InEvent[] } | null;
  const events = (body?.events ?? []).slice(0, 50).filter((e) => typeof e?.event === "string" && e.event.trim());
  if (!events.length) return Response.json({ ok: true, stored: false });
  if (!supabaseConfigured) return Response.json({ ok: true, stored: false });

  // plan + email resolved server-side so the audience tag is trustworthy
  let email: string | null = null, plan = "anon";
  try {
    const sb = await supabaseServer();
    const user = (await sb.auth.getUser()).data.user;
    if (user) {
      email = user.email ?? null;
      plan = planForEmail(email); // allowlist → pro
      if (plan !== "pro") {
        const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
        plan = data?.plan === "pro" ? "pro" : "hobby";
      }
    }
  } catch { /* anonymous usage is still usage */ }

  const admin = supabaseAdmin();
  if (!admin) return Response.json({ ok: true, stored: false });
  const rows = events.map((e) => ({
    event: String(e.event).slice(0, 64),
    plan,
    session: (e.session ?? "").toString().slice(0, 32) || null,
    url: (e.url ?? "").toString().slice(0, 300) || null,
    email,
    meta: e.meta && typeof e.meta === "object" ? e.meta : null,
  }));
  const { error } = await admin.from("usage_events").insert(rows);
  if (error) return Response.json({ ok: true, stored: false }); // never give the client a reason to retry
  recent.push(now);
  return Response.json({ ok: true });
}
