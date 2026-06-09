// Open the Stripe customer portal (manage / cancel / change card) for the signed-in subscriber.
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function POST(req: Request) {
  const s = stripe();
  if (!s || !supabaseConfigured) return Response.json({ error: "Billing isn't available yet.", code: "unavailable" }, { status: 503 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first.", code: "auth" }, { status: 401 });

  const { data: row } = await sb.from("users").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!row?.stripe_customer_id) return Response.json({ error: "No subscription on this account yet.", code: "none" }, { status: 404 });

  try {
    const session = await s.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${new URL(req.url).origin}/settings`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[billing] portal:", e);
    return Response.json({ error: "Could not open the billing portal." }, { status: 502 });
  }
}
