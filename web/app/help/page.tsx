import Link from "next/link";
import BackToEditor from "./BackToEditor";
import { marked } from "marked";
import { FEATURES_MD, changelogMarkdown } from "@/lib/electrace-info";

export const metadata = { title: "Help & Changelog — Electrace" };

export default async function HelpPage() {
  const features = await marked.parse(FEATURES_MD, { gfm: true });
  const changelog = await marked.parse(changelogMarkdown(), { gfm: true });

  return (
    <main className="mx-auto max-w-5xl px-7 py-10">
      <div className="flex items-center gap-4 text-sm">
        <BackToEditor />
        <a href="#changelog" className="ml-auto text-faint hover:text-dim">What&apos;s new ↓</a>
      </div>

      <header className="mt-5 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Help</h1>
        <p className="mt-1 text-dim">How Electrace works, and what&apos;s changed lately. Stuck on something? Ask Sparky ✨ in the editor.</p>
      </header>

      <article className="prose-block mt-8 max-w-3xl" dangerouslySetInnerHTML={{ __html: features }} />

      <section id="changelog" className="mt-14 scroll-mt-6 border-t border-border pt-10">
        <article className="prose-block max-w-3xl" dangerouslySetInnerHTML={{ __html: changelog }} />
      </section>
    </main>
  );
}
