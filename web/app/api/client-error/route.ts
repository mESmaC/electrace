// Client error sink — uncaught exceptions reported by ErrorMonitor. Same posture as
// /api/feedback: service-role insert into an RLS-locked table, size-capped, throttled.
// The client already dedupes per session; this throttle is the backstop against loops.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

let recent: number[] = []; // per-instance: 20/min absorbs a bad release without drowning the table

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 24_000) {
    return Response.json({ error: "too large" }, { status: 413 });
  }
  const now = Date.now();
  recent = recent.filter((t) => now - t < 60_000);
  if (recent.length >= 20) return Response.json({ ok: true, stored: false }); // shed silently, never error-loop

  const body = (await req.json().catch(() => null)) as
    { message?: string; stack?: string; url?: string; meta?: unknown } | null;
  const message = (body?.message ?? "").toString().trim().slice(0, 600);
  if (!message) return Response.json({ error: "no message" }, { status: 400 });
  if (!supabaseConfigured) return Response.json({ ok: true, stored: false });

  let email: string | null = null;
  try {
    const sb = await supabaseServer();
    email = (await sb.auth.getUser()).data.user?.email ?? null;
  } catch { /* anonymous errors are still errors */ }

  const admin = supabaseAdmin();
  if (!admin) return Response.json({ ok: true, stored: false });
  const { error } = await admin.from("client_errors").insert({
    message,
    stack: (body?.stack ?? "").toString().slice(0, 4000) || null,
    url: (body?.url ?? "").toString().slice(0, 300) || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
    email,
    meta: body?.meta ?? null,
  });
  if (error) return Response.json({ ok: true, stored: false }); // never give the client a reason to retry
  recent.push(now);
  return Response.json({ ok: true });
}
