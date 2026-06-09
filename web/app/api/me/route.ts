// The signed-in user's plan/entitlements, for gating UI (e.g. whether to show Sparky or an upgrade
// prompt). The server reads the session — the browser never sees the allowlist. The real enforcement
// is in /api/assistant; this endpoint only drives presentation.
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";

export async function GET() {
  if (!supabaseConfigured) return Response.json({ plan: "pro", pro: true, email: null }); // local/dev: no gate
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  let plan = planForEmail(user?.email); // interim allowlist override (until billing)
  if (plan !== "pro" && user) {
    // users.plan is the eventual truth — billing flips it; fails soft if the table isn't there yet
    const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
    if (data?.plan === "pro") plan = "pro";
  }
  return Response.json({ plan, pro: plan === "pro", email: user?.email ?? null });
}
