// Stripe → Electrace: the single place users.plan gets flipped. Signature-verified, and the only
// route that uses the service-role client (there's no user session in a webhook — Stripe is the
// caller). Idempotent by design: every handler SETS state from the event rather than toggling.
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const s = stripe();
  const admin = supabaseAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !admin || !secret) return Response.json({ error: "unconfigured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const uid = session.client_reference_id;
        const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (uid && session.mode === "subscription") {
          await admin.from("users").update({ plan: "pro", ...(customer ? { stripe_customer_id: customer } : {}) }).eq("id", uid);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        // active/trialing (and past_due, grace period) keep pro; anything else drops to free
        const pro = ["active", "trialing", "past_due"].includes(sub.status) && event.type !== "customer.subscription.deleted";
        await admin.from("users").update({ plan: pro ? "pro" : "free" }).eq("stripe_customer_id", customer);
        break;
      }
      default:
        break; // unhandled event types are acknowledged, not errors
    }
  } catch (e) {
    console.error("[billing] webhook handler:", event.type, e);
    return Response.json({ error: "handler failed" }, { status: 500 }); // 500 → Stripe retries
  }
  return Response.json({ received: true });
}
