import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import ServerSync from "./ServerSync";
import ThemeToggle from "./ThemeToggle";
import SiteBackdrop from "./SiteBackdrop";
import { DialogHost } from "./ui/dialog";
import { ContextMenuHost } from "./ui/contextMenu";
import NavAccount from "./NavAccount";
import Footer from "./Footer";
import { Logo } from "./Logo";

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
    <html lang="en" className="h-full antialiased" data-theme="mid" suppressHydrationWarning>
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
        <ServerSync />
        <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-6 px-7 lg:px-9">
            <Link href="/" aria-label="Electrace home"><Logo className="text-[17px]" /></Link>
            <Link href="/projects" className="text-sm text-dim hover:text-text">Projects</Link>
            <Link href="/blocks" className="text-sm text-dim hover:text-text">Blocks</Link>
            <Link href="/calculators" className="text-sm text-dim hover:text-text">Calculators</Link>
            <Link href="/pricing" className="text-sm text-dim hover:text-text">Pricing</Link>
            <Link href="/help" className="text-sm text-dim hover:text-text">Help</Link>
            <div className="ml-auto flex items-center gap-4">
              <ThemeToggle />
              <NavAccount />
            </div>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
        <Footer />
        {/* TEMPORARY: impact.com media-property ownership verification (partner signup).
            Remove as soon as Impact shows electrace.net as verified — this is tracking JS
            and conflicts with the privacy page's no-cross-site-tracking promise long-term. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7402343-2ded-4704-81e3-c146a1ad71801.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`,
          }}
        />
        <DialogHost />
        <ContextMenuHost />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
