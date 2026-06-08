"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProfile } from "@/lib/auth";

/** Gate for application routes: renders children only when there's a local session, else redirects to
 *  /login. Marketing/library/help pages stay public; wrap only the actual app (editor, onboarding, …). */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { profile, mounted } = useProfile();
  const router = useRouter();
  useEffect(() => { if (mounted && !profile) router.replace("/login"); }, [mounted, profile, router]);
  if (!mounted || !profile) return null; // nothing until we know there's a session (logged-out users are mid-redirect)
  return <>{children}</>;
}
