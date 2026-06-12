import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/site";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import ServerSync from "./ServerSync";
import ErrorMonitor from "./ErrorMonitor";
import ThemeToggle from "./ThemeToggle";
import SiteBackdrop from "./SiteBackdrop";
import { DialogHost } from "./ui/dialog";
import { ContextMenuHost } from "./ui/contextMenu";
import NavAccount from "./NavAccount";
import Footer from "./Footer";
import { Logo } from "./Logo";

// Self-hosted via next/font — replaces the render-blocking Google Fonts @import that gated
// first paint behind a third-party CSS+font chain (the mobile FCP offender).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });
const jbMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mono", display: "swap" });

// Set the theme + accent before first paint so there's no flash on load. Theme defaults to Mid.
const NO_FLASH = `try{var d=document.documentElement;var t=localStorage.getItem('electrace:theme');d.setAttribute('data-theme',(t==='light'||t==='dark'||t==='mid')?t:'mid');var a=localStorage.getItem('electrace:accent');if(a){d.style.setProperty('--color-accent',a);d.style.setProperty('--color-accent-hi',a);}}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Electrace — see inside every circuit",
  description: "Free online circuit & PCB design tool where every block explains itself — live electrical checks, automatic BOM, KiCad export. No SPICE, no install.",
  applicationName: "Electrace",
  keywords: ["schematic editor", "circuit design online", "PCB design tool", "EDA", "electrical engineering", "block-based design", "BOM generator", "KiCad export", "learn electronics", "circuit checker"],
  openGraph: {
    type: "website",
    siteName: "Electrace",
    url: "/",
    title: "Electrace — see inside every circuit",
    description: "Free online circuit & PCB design tool where every block explains itself — live electrical checks, automatic BOM, KiCad export. No SPICE, no install.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Electrace — see inside every circuit",
    description: "The electrical engineer's IDE — block-based schematics that explain themselves.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${jbMono.variable}`} data-theme="mid" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: NO_FLASH }} /></head>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${SITE}#org`, name: "Electrace", url: SITE, logo: `${SITE}/icon.svg`, sameAs: ["https://www.youtube.com/@electrace-net"] },
            { "@type": "WebSite", "@id": `${SITE}#site`, name: "Electrace", url: SITE, publisher: { "@id": `${SITE}#org` } },
          ],
        }) }} />
        <SiteBackdrop />
        <ErrorMonitor />
        <ServerSync />
        <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4 sm:gap-6 sm:px-7 lg:px-9">
            <Link href="/" aria-label="Electrace home" className="shrink-0"><Logo className="text-[17px]" /></Link>
            {/* the link row scrolls on narrow screens (scrollbar hidden) so nothing is unreachable */}
            <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto sm:gap-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href="/projects" className="shrink-0 text-sm text-dim hover:text-text">Projects</Link>
              <Link href="/blocks" className="shrink-0 text-sm text-dim hover:text-text">Blocks</Link>
              <Link href="/calculators" className="shrink-0 text-sm text-dim hover:text-text">Calculators</Link>
              <Link href="/docs/checks" className="shrink-0 text-sm text-dim hover:text-text">Docs</Link>
              <Link href="/pricing" className="shrink-0 text-sm text-dim hover:text-text">Pricing</Link>
              <Link href="/help" className="shrink-0 text-sm text-dim hover:text-text">Help</Link>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden sm:block"><ThemeToggle /></div>
              <NavAccount />
            </div>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
        <Footer />
        <DialogHost />
        <ContextMenuHost />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
