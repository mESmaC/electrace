"use client";
// Set a new password. Reached from the recovery email via /auth/callback, which has already
// exchanged the code for a session — so updateUser just works. Without a session (someone typed
// the URL), Supabase returns an error and we point them at /forgot-password.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "../Logo";
import { updatePassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true); setError(null);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) setError(`${res.error} — if your link expired, request a new one from the forgot-password page.`);
    else router.push("/projects");
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <div className="mb-4">
      <div className="mb-1.5"><label className="text-[12.5px] font-semibold text-dim">{label}</label></div>
      <div className="flex items-center rounded-xl border border-border-strong bg-surface px-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15">
        <input value={value} onChange={(e) => set(e.target.value)} type="password" required minLength={6} placeholder="••••••••"
          className="w-full bg-transparent py-3 text-[14.5px] text-text outline-none placeholder:text-faint" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col px-10 py-8">
      <div className="flex items-center">
        <Link href="/" aria-label="Electrace home"><Logo className="text-[17px]" /></Link>
        <span className="ml-auto text-[13.5px] text-faint">Need a link? <Link href="/forgot-password" className="font-semibold text-accent">Forgot password</Link></span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[27px] font-extrabold tracking-tight">Choose a new password</h1>
          <p className="mb-6 mt-1 text-[14.5px] text-dim">You&apos;re signed in from your reset link — set the new password below.</p>
          <form onSubmit={onSubmit}>
            {field("New password", password, setPassword)}
            {field("Confirm password", confirm, setConfirm)}
            {error && <p className="mb-3 text-[13px] text-[#f87171]">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
