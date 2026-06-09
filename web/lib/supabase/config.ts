// Supabase is the backend (auth + Postgres). Until the project is provisioned and these env vars are set,
// `supabaseConfigured` is false and the app falls back to the local profile — so nothing breaks locally.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase renamed the "anon" key to the "publishable" key — accept either name (both refer to the
// same safe-to-expose public client key). Both refs are static so Next can inline them at build time.
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
