// SERVICE-ROLE Supabase client — bypasses Row-Level Security. Server-only, and used ONLY where
// there is no user session to act as: the Stripe webhook flipping users.plan. Never import this
// from a route that has a signed-in user — those must keep going through supabaseServer() so RLS
// stays the enforcement layer.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const adminConfigured = !!(SUPABASE_URL && SECRET);

let client: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient | null {
  if (!adminConfigured) return null;
  return (client ??= createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } }));
}
