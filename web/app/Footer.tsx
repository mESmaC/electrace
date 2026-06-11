"use client";
// Site-wide footer — the internal-linking spine. Every content page (blocks, calculators, /vs)
// links back to the hubs and the highest-intent explainers, so link equity earned by any deep
// page flows through the site instead of dead-ending. Suppressed on app surfaces (editor,
// dashboard, auth, onboarding, and the shorts render stage), where chrome is just noise.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const APP_PREFIXES = ["/editor", "/projects", "/settings", "/welcome", "/login", "/signup", "/shorts-stage"];

export default function Footer() {
  const path = usePathname();
  if (APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <footer className="border-t border-border px-7 py-10 text-[14px] text-faint">
      <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-7">
        <Logo className="text-[16px] text-text" />
        <div className="flex flex-wrap gap-x-9 gap-y-2">
          <Link href="/#how" className="text-dim hover:text-text">Product</Link>
          <Link href="/pricing" className="text-dim hover:text-text">Pricing</Link>
          <Link href="/help" className="text-dim hover:text-text">Docs</Link>
          <Link href="/blocks" className="text-dim hover:text-text">Blocks</Link>
          <Link href="/calculators" className="text-dim hover:text-text">Calculators</Link>
          <Link href="/vs" className="text-dim hover:text-text">Compare tools</Link>
          <Link href="/blocks/buck-converter" className="text-dim hover:text-text">Buck converter explained</Link>
          <Link href="/blocks/timer-555" className="text-dim hover:text-text">555 timer explained</Link>
          <Link href="/blocks/reverse-polarity-protection" className="text-dim hover:text-text">Reverse-polarity protection</Link>
          <Link href="/blocks/usb-c-power" className="text-dim hover:text-text">USB-C 5V power</Link>
          <Link href="/privacy" className="text-dim hover:text-text">Privacy</Link>
          <Link href="/terms" className="text-dim hover:text-text">Terms</Link>
        </div>
        <span className="flex items-center gap-4">
          <a href="https://www.youtube.com/@electrace-net" target="_blank" rel="noopener" title="Electrace on YouTube" className="flex items-center gap-1.5 text-dim hover:text-text">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z"/></svg>
            YouTube
          </a>
          <span>© 2026 <a href="https://usnylon.com" target="_blank" rel="noopener" className="hover:text-text">US Nylon</a></span>
        </span>
      </div>
    </footer>
  );
}
