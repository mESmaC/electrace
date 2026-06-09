"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { emailSignUp, emailSignIn, oauthSignIn } from "@/lib/auth";
import { Logo } from "@/app/Logo";

/** Sign-in / sign-up UI. Uses Supabase Auth when configured (email + OAuth); falls back to a local
 *  profile (handled in lib/auth) until the project is provisioned. */
export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const afterAuth = () => {
    const onboarded = (() => { try { return !!localStorage.getItem("electrace:onboarded"); } catch { return false; } })();
    router.push(signup && !onboarded ? "/welcome" : "/projects");
  };
  const onEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const res = signup ? await emailSignUp(name, email, password) : await emailSignIn(email, password);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    if (signup && "session" in res && res.session === false) { setInfo("Check your email to confirm your account, then log in."); return; }
    if (!signup) { try { localStorage.setItem("electrace:onboarded", "1"); } catch { /* ignore */ } }
    afterAuth();
  };
  const onOAuth = async (provider: "github" | "google") => {
    setBusy(true); setError(null);
    const res = await oauthSignIn(provider); // on success the browser redirects to the provider, then /auth/callback
    if (res.error) { setError(res.error); setBusy(false); }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* form side */}
      <div className="flex flex-col px-10 py-8">
        <div className="flex items-center">
          <Link href="/" aria-label="Electrace home"><Logo className="text-[17px]" /></Link>
          <span className="ml-auto text-[13.5px] text-faint">{signup ? <>Have an account? <Link href="/login" className="font-semibold text-accent">Log in</Link></> : <>New here? <Link href="/signup" className="font-semibold text-accent">Create an account</Link></>}</span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[380px]">
            <h1 className="text-[27px] font-extrabold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
            <p className="mb-6 mt-1 text-[14.5px] text-dim">{signup ? "Start understanding your circuits." : "Log in to your designs."}</p>

            <div className="mb-5 flex flex-col gap-2.5">
              <button onClick={() => onOAuth("github")} disabled={busy} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface py-2.5 font-semibold hover:border-accent hover:bg-surface-2 disabled:opacity-60">
                <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                Continue with GitHub
              </button>
              <button onClick={() => onOAuth("google")} disabled={busy} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface py-2.5 font-semibold hover:border-accent hover:bg-surface-2 disabled:opacity-60">
                <span className="bg-gradient-to-br from-[#ea4335] via-[#fbbc05] to-[#4285f4] bg-clip-text text-[16px] font-extrabold text-transparent">G</span> Continue with Google
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-[12px] text-faint before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or continue with email</div>

            <form onSubmit={onEmail}>
              {signup && (
                <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Cameron Emery" className="w-full bg-transparent py-3 text-[14.5px] text-text outline-none placeholder:text-faint" /></Field>
              )}
              <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@email.com" className="w-full bg-transparent py-3 text-[14.5px] text-text outline-none placeholder:text-faint" /></Field>
              <Field label="Password" right={!signup ? <span className="text-[12px] font-semibold text-accent">Forgot?</span> : undefined}>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} required minLength={6} placeholder="••••••••" className="w-full bg-transparent py-3 text-[14.5px] text-text outline-none placeholder:text-faint" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="text-faint" title="Show password">👁</button>
              </Field>
              {!signup && <label className="mb-5 mt-1 flex items-center gap-2 text-[13px] text-dim"><input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--color-accent)]" /> Remember me</label>}
              {error && <div className="mb-3 rounded-lg border border-[#e2837e]/45 bg-[#e2554b]/10 px-3 py-2 text-[12.5px] text-[#e2837e]">{error}</div>}
              {info && <div className="mb-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] text-accent">{info}</div>}
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-accent py-3 font-semibold text-white shadow-lg shadow-accent/30 hover:bg-accent-hi disabled:opacity-60">{busy ? "Just a sec…" : signup ? "Create account" : "Log in"}</button>
              {signup && <p className="mt-4 text-center text-[12px] text-faint">By creating an account you agree to our <Link href="/terms" className="text-dim underline hover:text-text">Terms</Link> and <Link href="/privacy" className="text-dim underline hover:text-text">Privacy Policy</Link>.</p>}
            </form>
          </div>
        </div>
      </div>

      {/* showcase side */}
      <div className="relative hidden flex-col justify-center overflow-hidden border-l border-border p-16 md:flex"
        style={{ background: "radial-gradient(700px 420px at 70% 10%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent), var(--color-bg2)" }}>
        <div className="relative max-w-[440px]">
          <h2 className="text-[40px] font-extrabold leading-[1.05] tracking-tight">See inside<br />every circuit.<span className="ml-1 inline-block h-8 w-2 translate-y-1 rounded-[1px] bg-accent align-middle" /></h2>
          <p className="mt-4 max-w-[380px] text-[16px] text-dim">The schematic IDE where every block explains itself — and catches what doesn&apos;t add up.</p>
          <ul className="mt-7 flex flex-col gap-3.5 text-[15px] text-dim">
            <li className="flex gap-3"><span className="font-bold text-green">✓</span> Blocks that explain themselves — discrete or IC.</li>
            <li className="flex gap-3"><span className="font-bold text-green">✓</span> Linting on your numbers, no simulation to set up.</li>
            <li className="flex gap-3"><span className="font-bold text-green">✓</span> Net-to-net wiring — nothing forgotten.</li>
          </ul>
          <div className="mt-10 w-[240px] rounded-2xl border border-border-strong bg-surface-2 shadow-2xl">
            <div className="flex items-center gap-2.5 px-3 pb-2 pt-3"><span className="grid h-[26px] w-[26px] place-items-center rounded-lg border border-[#3fd0e6]/40 bg-[#3fd0e6]/15 text-[13px] text-[#3fd0e6]">⇄</span><span className="flex-1 text-[12.5px] font-semibold">Buck Regulator</span><span className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold uppercase text-faint">IC</span></div>
            <div className="px-3 pb-2 font-mono text-[11px] text-dim">9–18 V → 5 V · 3 A</div>
            <div className="mx-2.5 mb-2.5 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px]"><span className="text-accent">✦</span><span className="text-green">●</span>Plenty of headroom — 9 W of 15 W</div>
          </div>
        </div>
        <div className="absolute bottom-7 left-16 text-[13px] text-faint">Built by US Nylon</div>
      </div>
    </div>
  );
}

function Field({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between"><label className="text-[12.5px] font-semibold text-dim">{label}</label>{right}</div>
      <div className="flex items-center rounded-xl border border-border-strong bg-surface px-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15">{children}</div>
    </div>
  );
}
