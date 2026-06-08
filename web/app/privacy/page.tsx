import Link from "next/link";

export const metadata = { title: "Privacy — Electrace", description: "What Electrace collects (almost nothing) and where your data lives." };

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
        <p className="mt-1 text-faint">Electrace is still in active development. This reflects how the product works today; it will be updated as the product grows.</p>
      </header>

      <Section title="The short version">
        <p>Electrace collects almost nothing. There are no accounts yet, no cookies, no analytics scripts, and no advertising. Your designs and blocks live in your own browser.</p>
      </Section>

      <Section title="Where your work lives">
        <p>Designs, blocks, and editor preferences are stored locally on your device. They never leave your machine unless you explicitly export them or use the assistant (below). Clearing your browser storage deletes them.</p>
      </Section>

      <Section title="The assistant (Sparky)">
        <p>When you send a message to the assistant, that message and a snapshot of your current design are sent to our servers and a third-party AI provider to generate a reply. We don&apos;t use your designs to train models, and we don&apos;t retain them beyond what&apos;s needed to serve the request. If you never open the assistant, none of your design data is transmitted anywhere.</p>
      </Section>

      <Section title="Optional local telemetry">
        <p>The editor has an opt-in &quot;capture&quot; toggle (off by default) that records anonymized editor events to help you understand your own usage. These events stay in your browser — they are never transmitted to us — and you can inspect, export, or clear them at any time.</p>
      </Section>

      <Section title="When accounts arrive">
        <p>Cloud accounts and saved projects are planned. When they ship, this page will be updated to describe exactly what is stored on our servers, and you&apos;ll be able to choose what stays private.</p>
      </Section>

      <Section title="Contact">
        <p>Questions? <a href="mailto:hello@electrace.net" className="text-link hover:underline">hello@electrace.net</a>.</p>
      </Section>
    </main>
  );
}
