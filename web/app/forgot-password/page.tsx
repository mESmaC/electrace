"use client";
// Request a password-recovery email. The link in the email returns through /auth/callback
// (which exchanges the code for a session) and lands on /reset-password.
import { useState } from "react";
import Link from "next/link";
import { Logo } from "../Logo";
import { requestPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (res.error) setError(res.error);
    else setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col px-10 py-8">
      <div className="flex items-center">
        <Link href="/" aria-label="Electrace home"><Logo className="text-[17px]" /></Link>
        <span className="ml-auto text-[13.5px] text-faint">Remembered it? <Link href="/login" className="font-semibold text-accent">Log in</Link></span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[27px] font-extrabold tracking-tight">Reset your password</h1>
          <p className="mb-6 mt-1 text-[14.5px] text-dim">We&apos;ll email you a link to set a new one.</p>
          {sent ? (
            <p className="rounded-xl border border-border-strong bg-surface px-4 py-3 text-[14px] text-text">
              If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way. Check your inbox (and spam).
            </p>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="mb-4">
                <div className="mb-1.5"><label className="text-[12.5px] font-semibold text-dim">Email</label></div>
                <div className="flex items-center rounded-xl border border-border-strong bg-surface px-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@email.com"
                    className="w-full bg-transparent py-3 text-[14.5px] text-text outline-none placeholder:text-faint" />
                </div>
              </div>
              {error && <p className="mb-3 text-[13px] text-[#f87171]">{error}</p>}
              <button type="submit" disabled={busy}
                className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
