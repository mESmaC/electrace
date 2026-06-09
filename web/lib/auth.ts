// Auth abstraction. When Supabase is provisioned (env vars set), this is real Supabase Auth — email +
// OAuth, cookie session refreshed by middleware. Until then it falls back to a local profile so the app
// keeps working. Call sites use the same API either way (useProfile / signOut / the email+oauth actions).
"use client";
import { useEffect, useState } from "react";
import { supabaseConfigured } from "./supabase/config";
import { supabaseBrowser } from "./supabase/client";

export interface Profile { name: string; email: string }
export const isSupabaseAuth = supabaseConfigured;

const KEY = "electrace:profile";
const EVT = "electrace:auth";
const broadcast = () => { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } };

type SbUser = { email?: string | null; user_metadata?: { name?: string } } | null | undefined;
const toProfile = (u: SbUser): Profile | null =>
  u ? { name: u.user_metadata?.name || u.email?.split("@")[0] || "You", email: u.email ?? "" } : null;

// ── local-profile fallback (used only while Supabase is unconfigured) ─────────────────────────
function getLocalProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Profile) : null; } catch { return null; }
}
/** Local-only: write the profile (used by the email fallback when Supabase isn't configured). */
export function signIn(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify({ name: p.name.trim() || "You", email: p.email.trim() })); } catch { /* ignore */ }
  broadcast();
}
/** Sync local check — only meaningful for the local fallback. Account pages gate via RequireAuth instead. */
export function getProfile(): Profile | null { return getLocalProfile(); }
export function isLoggedIn(): boolean { return !!getLocalProfile(); }

export function updateProfile(patch: Partial<Profile>): void {
  if (supabaseConfigured) { void supabaseBrowser().auth.updateUser({ data: { name: patch.name } }); broadcast(); return; }
  signIn({ ...(getLocalProfile() ?? { name: "You", email: "" }), ...patch });
}
export async function signOut(): Promise<void> {
  if (supabaseConfigured) { try { await supabaseBrowser().auth.signOut(); } catch { /* ignore */ } }
  else { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
  broadcast();
}

// ── auth actions (Supabase when configured, local profile otherwise) ──────────────────────────
export async function emailSignUp(name: string, email: string, password: string): Promise<{ error?: string; session?: boolean }> {
  if (!supabaseConfigured) { signIn({ name, email }); return { session: true }; }
  const { data, error } = await supabaseBrowser().auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${location.origin}/auth/callback` } });
  return error ? { error: error.message } : { session: !!data.session }; // session null ⇒ email confirmation required
}
export async function emailSignIn(email: string, password: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) { signIn({ name: "", email }); return {}; }
  const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}
export async function oauthSignIn(provider: "github" | "google"): Promise<{ error?: string }> {
  if (!supabaseConfigured) { signIn({ name: "You", email: "" }); return {}; }
  const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } });
  return error ? { error: error.message } : {};
}

/** Email a password-recovery link; the link lands on /auth/callback → /reset-password with a session. */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Password reset isn't available in local mode." };
  const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
  return error ? { error: error.message } : {};
}

/** Set a new password (requires a session — normally the one the recovery link just created). */
export async function updatePassword(password: string): Promise<{ error?: string }> {
  if (!supabaseConfigured) return { error: "Password reset isn't available in local mode." };
  const { error } = await supabaseBrowser().auth.updateUser({ password });
  return error ? { error: error.message } : {};
}

/** Subscribe to the current user. `mounted` flips true only once auth state is known (so guards don't
 *  redirect before the session resolves). Works for both Supabase and the local fallback. */
export function useProfile(): { profile: Profile | null; mounted: boolean } {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!supabaseConfigured) {
      const sync = () => setProfile(getLocalProfile());
      sync(); setMounted(true);
      const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) sync(); };
      window.addEventListener(EVT, sync);
      window.addEventListener("storage", onStorage);
      return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", onStorage); };
    }
    const sb = supabaseBrowser();
    let alive = true;
    sb.auth.getUser().then(({ data }) => { if (alive) { setProfile(toProfile(data.user)); setMounted(true); } });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (alive) { setProfile(toProfile(session?.user)); setMounted(true); } });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return { profile, mounted };
}
