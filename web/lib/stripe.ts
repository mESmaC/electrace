// Server-only Stripe client. Null until STRIPE_SECRET_KEY is set, so every billing route can
// degrade to a clean 503 instead of crashing — same pattern as supabaseConfigured.
import Stripe from "stripe";

export const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  if (!stripeConfigured) return null;
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!));
}

/** The subscription price ids (created in the Stripe dashboard, pasted into env). */
export const PRICES = {
  month: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  year: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
} as const;
