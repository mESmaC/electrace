// Bug reports — the ONLY sink for the local capture buffer, and only via the user's explicit
// confirm in the Report dialog. Inserted with the service-role client into a table with RLS
// enabled and NO public policies: users can write reports through this route, nobody can read
// them through the API. Size-capped and lightly throttled.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

let recent: number[] = []; // per-instance throttle: 5 reports/min is plenty for honest use

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 400_000) {
    return Response.json({ error: "report too large" }, { status: 413 });
  }
  const now = Date.now();
  recent = recent.filter((t) => now - t < 60_000);
  if (recent.length >= 5) return Response.json({ error: "slow down" }, { status: 429 });

  const body = (await req.json().catch(() => null)) as
    { description?: string; events?: unknown; design?: unknown; meta?: unknown } | null;
  const description = (body?.description ?? "").toString().trim().slice(0, 4000);
  if (!description) return Response.json({ error: "say what happened" }, { status: 400 });
  if (!supabaseConfigured) return Response.json({ ok: true, stored: false }); // local dev without a backend

  let email: string | null = null;
  try {
    const sb = await supabaseServer();
    email = (await sb.auth.getUser()).data.user?.email ?? null;
  } catch { /* anonymous reports are fine */ }

  const admin = supabaseAdmin();
  if (!admin) return Response.json({ ok: true, stored: false }); // no service key configured
  const { error } = await admin.from("bug_reports").insert({
    email,
    description,
    events: body?.events ?? null,
    design: body?.design ?? null,
    meta: body?.meta ?? null,
  });
  if (error) return Response.json({ error: "could not store report" }, { status: 500 });
  recent.push(now);
  return Response.json({ ok: true });
}
