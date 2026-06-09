// The signed-in user's plan/entitlements, for gating UI (e.g. whether to show Sparky or an upgrade
// prompt). The server reads the session — the browser never sees the allowlist. The real enforcement
// is in /api/assistant; this endpoint only drives presentation.
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail } from "@/lib/entitlements";

export async function GET() {
  if (!supabaseConfigured) return Response.json({ plan: "pro", pro: true, email: null }); // local/dev: no gate
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  const plan = planForEmail(user?.email);
  return Response.json({ plan, pro: plan === "pro", email: user?.email ?? null });
}
