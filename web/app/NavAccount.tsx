"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useProfile, signOut } from "@/lib/auth";

/** Nav account control: Log in / Sign up when signed out; an avatar dropdown (with Log out) when signed in. */
export default function NavAccount() {
  const { profile, mounted } = useProfile();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!mounted) return <div className="h-7 w-[60px]" />; // reserve space, avoid a hydration flash

  if (!profile) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm text-dim hover:text-text">Log in</Link>
        <Link href="/signup" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-hi">Sign up</Link>
      </div>
    );
  }

  const initials = profile.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "YOU";
  const logout = () => { signOut(); setOpen(false); router.push("/"); };
  const item = "block w-full px-3 py-2 text-left text-[13px] text-text transition hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} title={profile.name} aria-label="Account"
        className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent to-[#7c6cff] text-[11px] font-bold text-white ring-offset-1 transition hover:ring-2 hover:ring-accent/40">
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-xl border border-border-strong bg-surface py-1.5 shadow-2xl">
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-[13px] font-semibold">{profile.name}</div>
            <div className="truncate text-[11px] text-faint">{profile.email || "Signed in on this device"}</div>
          </div>
          <Link href="/projects" onClick={() => setOpen(false)} className={item}>Your designs</Link>
          <Link href="/settings" onClick={() => setOpen(false)} className={item}>Settings</Link>
          <div className="my-1 h-px bg-border" />
          <button onClick={logout} className={`${item} text-[#e2837e]`}>Log out</button>
        </div>
      )}
    </div>
  );
}
