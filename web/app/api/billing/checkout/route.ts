// Start a Pro subscription: creates a Stripe Checkout session for the signed-in user and returns
// its URL. client_reference_id carries the Supabase user id so the webhook can flip users.plan
// without guessing by email.
import { stripe, PRICES } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function POST(req: Request) {
  const s = stripe();
  if (!s || !supabaseConfigured) return Response.json({ error: "Billing isn't available yet.", code: "unavailable" }, { status: 503 });

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to upgrade.", code: "auth" }, { status: 401 });

  const { interval } = (await req.json().catch(() => ({}))) as { interval?: "month" | "year" };
  const price = PRICES[interval === "year" ? "year" : "month"];
  if (!price) return Response.json({ error: "Billing isn't available yet.", code: "unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  // reuse the Stripe customer if they've checked out before (keeps one customer per user)
  const { data: row } = await sb.from("users").select("stripe_customer_id").eq("id", user.id).maybeSingle();

  try {
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      ...(row?.stripe_customer_id ? { customer: row.stripe_customer_id } : { customer_email: user.email }),
      allow_promotion_codes: true,
      success_url: `${origin}/settings?billing=success`,
      cancel_url: `${origin}/pricing?billing=cancelled`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[billing] checkout:", e);
    return Response.json({ error: "Could not start checkout — try again in a moment." }, { status: 502 });
  }
}
