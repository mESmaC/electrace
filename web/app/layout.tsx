import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import ServerSync from "./ServerSync";

export const metadata: Metadata = {
  title: "Electrace — see inside every circuit",
  description: "The electrical engineer's IDE — blocks that explain themselves.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServerSync />
        <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-7">
            <Link href="/" className="font-mono font-bold text-[17px]">
              Electrace<span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-[1px] bg-accent" />
            </Link>
            <Link href="/projects" className="text-sm text-dim hover:text-text">Projects</Link>
            <Link href="/blocks" className="text-sm text-dim hover:text-text">Blocks</Link>
          </div>
        </nav>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
