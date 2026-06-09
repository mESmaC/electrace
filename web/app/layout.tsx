import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import ServerSync from "./ServerSync";
import ThemeToggle from "./ThemeToggle";
import SiteBackdrop from "./SiteBackdrop";
import { DialogHost } from "./ui/dialog";
import { ContextMenuHost } from "./ui/contextMenu";
import NavAccount from "./NavAccount";
import { Logo } from "./Logo";

// Set the theme + accent before first paint so there's no flash on load. Theme defaults to Mid.
const NO_FLASH = `try{var d=document.documentElement;var t=localStorage.getItem('electrace:theme');d.setAttribute('data-theme',(t==='light'||t==='dark'||t==='mid')?t:'mid');var a=localStorage.getItem('electrace:accent');if(a){d.style.setProperty('--color-accent',a);d.style.setProperty('--color-accent-hi',a);}}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL("https://electrace.net"),
  title: "Electrace — see inside every circuit",
  description: "The electrical engineer's IDE — block-based schematics that explain themselves, with live deterministic checks and no SPICE.",
  applicationName: "Electrace",
  keywords: ["schematic", "EDA", "PCB", "electrical engineering", "circuit design", "block-based", "BOM"],
  openGraph: {
    type: "website",
    siteName: "Electrace",
    url: "/",
    title: "Electrace — see inside every circuit",
    description: "The electrical engineer's IDE — block-based schematics that explain themselves, with live deterministic checks and no SPICE.",
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
        <SiteBackdrop />
        <ServerSync />
        <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
          <div className="flex h-14 items-center gap-6 px-7 lg:px-9">
            <Link href="/" aria-label="Electrace home"><Logo className="text-[17px]" /></Link>
            <Link href="/projects" className="text-sm text-dim hover:text-text">Projects</Link>
            <Link href="/blocks" className="text-sm text-dim hover:text-text">Blocks</Link>
            <Link href="/pricing" className="text-sm text-dim hover:text-text">Pricing</Link>
            <Link href="/help" className="text-sm text-dim hover:text-text">Help</Link>
            <div className="ml-auto flex items-center gap-4">
              <ThemeToggle />
              <NavAccount />
            </div>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
        <DialogHost />
        <ContextMenuHost />
        <Analytics />
      </body>
    </html>
  );
}
