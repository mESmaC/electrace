// Local "session": until the cloud backend lands, being signed in just means a local profile exists
// (electrace:profile). Sign-in/out write that key and broadcast electrace:auth so the nav + guards update.
import { useEffect, useState } from "react";

export interface Profile { name: string; email: string }

const KEY = "electrace:profile";
const EVT = "electrace:auth";

export function getProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Profile) : null; } catch { return null; }
}
export function isLoggedIn(): boolean { return !!getProfile(); }

const broadcast = () => { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } };

export function signIn(p: Profile): void {
  try { localStorage.setItem(KEY, JSON.stringify({ name: p.name.trim() || "You", email: p.email.trim() })); } catch { /* ignore */ }
  broadcast();
}
/** Merge a patch into the current profile (creating one if needed). */
export function updateProfile(patch: Partial<Profile>): void {
  signIn({ ...(getProfile() ?? { name: "You", email: "" }), ...patch });
}
export function signOut(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  broadcast();
}

/** Subscribe to the local profile; `mounted` flips true after first client render (avoids hydration flash). */
export function useProfile(): { profile: Profile | null; mounted: boolean } {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const sync = () => setProfile(getProfile());
    setMounted(true); sync();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) sync(); };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", onStorage); };
  }, []);
  return { profile, mounted };
}
