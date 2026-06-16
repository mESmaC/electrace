// The signed-in user's plan/entitlements, for gating UI (whether to show Sparky, the free-preview
// allowance, or an upgrade prompt). The server reads the session — the browser never sees the
// allowlist. The real enforcement is in /api/assistant; this endpoint only drives presentation.
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { planForEmail, sparkyBudgetUsd } from "@/lib/entitlements";

export async function GET() {
  if (!supabaseConfigured) return Response.json({ plan: "pro", pro: true, email: null, sparky: { allowed: true, plan: "pro", budget: 0, spent: 0 } }); // local/dev: no gate
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  let plan = planForEmail(user?.email); // interim allowlist override (until billing)
  if (plan !== "pro" && user) {
    // users.plan is the eventual truth — billing flips it; fails soft if the table isn't there yet
    const { data } = await sb.from("users").select("plan").eq("id", user.id).maybeSingle();
    if (data?.plan === "pro") plan = "pro";
  }
  const pro = plan === "pro";

  // Sparky entitlement: pro OR any signed-in user (free preview). Report the month-to-date spend vs the
  // plan's budget so the UI can show how much free preview is left (and switch the bubble from a hard
  // upsell wall to "you have free Sparky" for signed-in non-pro users).
  let sparky: { allowed: boolean; plan: string; budget: number; spent: number } | null = null;
  if (user) {
    const budget = sparkyBudgetUsd(pro ? "pro" : "hobby");
    let spent = 0;
    if (budget > 0) {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { data: rows } = await sb.from("sparky_usage").select("cost_usd").gte("created_at", monthStart.toISOString());
      spent = (rows ?? []).reduce((a, r) => a + Number(r.cost_usd ?? 0), 0);
    }
    sparky = { allowed: budget === 0 || spent < budget, plan: pro ? "pro" : "hobby", budget, spent };
  }
  return Response.json({ plan, pro, email: user?.email ?? null, sparky });
}
