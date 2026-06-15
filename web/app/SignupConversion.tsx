"use client";
// Fires the Google Ads signup conversion (lib/gtag → trackSignup) exactly once when a NEW account
// is created, across every auth path: email (immediate or after confirmation), Google, and GitHub.
//
// Why a created_at check instead of a dedicated signup event: this Supabase version reports every
// fresh login (email, OAuth, email-confirm via /auth/callback) as a single SIGNED_IN event — there's
// no distinct "new account" event to key on. Comparing user.created_at to "just now" reliably
// identifies a brand-new account regardless of provider. A localStorage guard makes it idempotent so
// a refresh or a second tab can't double-count the conversion.
import { useEffect } from "react";
import { supabaseConfigured } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/client";
import { trackSignup } from "@/lib/gtag";

const FIRED_KEY = "electrace:signup_conversion_fired";
const NEW_WINDOW_MS = 60_000; // created within the last minute ⇒ this auth event IS the signup

export default function SignupConversion() {
  useEffect(() => {
    if (!supabaseConfigured) return; // local-profile fallback has no real signups
    const sb = supabaseBrowser();

    const maybeFire = (user: { id: string; created_at?: string; app_metadata?: { provider?: string } } | null | undefined) => {
      if (!user?.created_at) return;
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      if (ageMs < 0 || ageMs > NEW_WINDOW_MS) return; // not a fresh account → a returning sign-in
      try {
        const fired = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]") as string[];
        if (fired.includes(user.id)) return; // already counted this account
        fired.push(user.id);
        localStorage.setItem(FIRED_KEY, JSON.stringify(fired.slice(-20)));
      } catch { /* if storage is unavailable, fire anyway — better to slightly over- than under-count */ }
      trackSignup(user.app_metadata?.provider ?? "email");
    };

    // catch a signup that completed before this listener mounted (the /auth/callback redirect case)
    sb.auth.getUser().then(({ data }) => maybeFire(data.user));
    // this Supabase version reports every fresh login (email/OAuth/confirm) as SIGNED_IN; the
    // created_at window inside maybeFire is what separates a brand-new account from a return visit.
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") maybeFire(session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return null;
}
