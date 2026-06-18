// AppShell — the Electrace page frame, composed from the real components exactly as web/app/layout.tsx
// assembles them: ambient backdrop + sticky top nav (logo, section links, theme toggle, account) +
// content slot + footer. Gives the design agent a ready, on-brand page chrome to drop content into.
import type { ReactNode } from "react";
import { Logo } from "@/app/Logo";
import ThemeToggle from "@/app/ThemeToggle";
import NavAccount from "@/app/NavAccount";
import Footer from "@/app/Footer";
import SiteBackdrop from "@/app/SiteBackdrop";

const NAV: [string, string][] = [
  ["Projects", "/projects"],
  ["Blocks", "/blocks"],
  ["Calculators", "/calculators"],
  ["Docs", "/docs/checks"],
  ["Pricing", "/pricing"],
  ["Help", "/help"],
];

/** The Electrace app frame: ambient backdrop, sticky top nav, your content, footer. Wrap a page's
 *  body in it to get the real chrome. Set `data-theme` on an ancestor to switch Mid/Dark/Light. */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    // bg-bg + text-text on the root so content sits on the real page surface (the app's <body> sets
    // these); without it, content renders on transparent and only the faint backdrop shows through.
    <div className="flex min-h-full flex-col bg-bg text-text">
      <SiteBackdrop />
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4 sm:gap-6 sm:px-7 lg:px-9">
          <a href="/" aria-label="Electrace home" className="shrink-0"><Logo className="text-[17px]" /></a>
          <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto sm:gap-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="shrink-0 text-sm text-dim hover:text-text">{label}</a>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden sm:block"><ThemeToggle /></div>
            <NavAccount />
          </div>
        </div>
      </nav>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
