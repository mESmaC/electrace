import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Privacy — Electrace",
  description: "What Electrace stores, where it lives, and what never leaves your browser.",
  alternates: { canonical: `${SITE}/privacy` },
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-lg font-bold text-text">{title}</h2>
    <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-dim">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-7 py-12">
      <Link href="/" className="text-sm text-faint hover:text-dim">← Back</Link>
      <header className="mt-5 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Privacy</h1>
        <p className="mt-1 text-faint">Last updated June 2026. Plain language on purpose — this describes how the product actually works today.</p>
      </header>

      <Section title="The short version">
        <p>We store what&apos;s needed to run your account and sync your work, and nothing more. We don&apos;t sell data, we don&apos;t run advertising, and we don&apos;t use your designs to train AI models. Anything marked local-only genuinely never leaves your browser.</p>
      </Section>

      <Section title="Your account">
        <p>When you sign up (email/password or Google/GitHub sign-in) we store your <strong>email address</strong>, <strong>display name</strong>, and your <strong>plan</strong> (Hobby or Pro). Authentication uses essential session cookies — the kind that keep you signed in. We set no advertising or cross-site tracking cookies.</p>
      </Section>

      <Section title="Your designs and blocks">
        <p>When you&apos;re signed in, your <strong>designs</strong> (schematic and board layout), <strong>custom blocks</strong>, <strong>block edits</strong>, and <strong>editor settings</strong> are stored on our servers so they follow you across devices. Your browser keeps a local copy as a fast offline cache.</p>
        <p>Each design has a visibility you control: <strong>private</strong> (only you — enforced at the database level), <strong>unlisted</strong> (anyone with the link), or <strong>public</strong> (discoverable, like a public repository). New designs default to unlisted.</p>
        <p>Deleting a design in the app deletes it from our servers. To delete your whole account and its data, email us (below) — self-serve deletion is coming.</p>
      </Section>

      <Section title="The assistant (Sparky)">
        <p>When you send the assistant a message, that message and a snapshot of your current design are processed by our servers and a <strong>third-party AI provider</strong> to generate the reply. We don&apos;t use your designs to train models, and our provider agreements don&apos;t permit training on this data either. If you never use the assistant, your design data is never sent to any AI provider.</p>
      </Section>

      <Section title="Payments">
        <p>Subscriptions are processed by <strong>Stripe</strong>. Your card details go directly to Stripe — we never see or store card numbers. We store your plan and a Stripe customer reference so your subscription controls your account.</p>
      </Section>

      <Section title="Parts links">
        <p>The bill-of-materials view links to electronic component distributors so you can buy the parts in a design. Some of these may be affiliate links that earn us a commission at no extra cost to you. No personal data is shared with distributors when we build those links — and links never influence which parts a block recommends.</p>
      </Section>

      <Section title="Analytics">
        <p>We use privacy-respecting, aggregate analytics (page views and web performance) to understand what&apos;s used and what&apos;s slow. No advertising identifiers, no cross-site tracking.</p>
      </Section>

      <Section title="Bug reports and the local capture buffer">
        <p>The editor keeps a short rolling log of anonymized editor events (actions, not content) <strong>on your device only</strong> — think of it like a game recorder&apos;s replay buffer. It is transmitted in exactly one case: you press <strong>Report a bug</strong> and confirm a dialog that lists everything being attached — the event log, optionally a snapshot of the current design, and your browser version. You can view the exact data before sending, and nothing is ever sent without that confirmation.</p>
      </Section>

      <Section title="Contact">
        <p>Questions, data requests, or deletions: <a href="mailto:contact@usnylon.com" className="text-link hover:underline">contact@usnylon.com</a>.</p>
      </Section>
    </main>
  );
}
