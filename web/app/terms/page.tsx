import Link from "next/link";

export const metadata = { title: "Terms — Electrace", description: "The terms for using Electrace during early access." };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-lg font-bold text-text">{title}</h2>
    <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-dim">{children}</div>
  </section>
);

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-7 py-12">
      <Link href="/" className="text-sm text-faint hover:text-dim">← Back</Link>
      <header className="mt-5 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Terms of use</h1>
        <p className="mt-1 text-faint">Electrace is in early access. By using it you agree to the following. These terms will be firmed up before general availability.</p>
      </header>

      <Section title="Early-access software">
        <p>Electrace is provided <strong>as-is</strong>, without warranties of any kind. Features may change, break, or disappear, and stored data may be lost. Don&apos;t rely on it as your only copy of important work — export anything you care about.</p>
      </Section>

      <Section title="Checks are structural, not a simulation">
        <p>Electrace&apos;s live checks catch structural mistakes — type errors, open nets, undriven rails, over-current, and the like. They are <strong>not</strong> a simulation: no SPICE, no transient or thermal analysis, no guarantee a design works. A clean result means &quot;structurally sane,&quot; not &quot;validated.&quot; You are responsible for verifying any design — with a simulator and a real review — before building or manufacturing it.</p>
      </Section>

      <Section title="Your content is yours">
        <p>You keep all rights to the designs and blocks you create. You grant us only what&apos;s technically necessary to run the service — for example, processing your design to power the assistant and the checks while you use them. We don&apos;t claim ownership of your work and don&apos;t use it to train models.</p>
      </Section>

      <Section title="Acceptable use">
        <p>Don&apos;t use Electrace to break the law, to attack or overload the service, or to design anything intended to cause harm. We may suspend access that threatens the service or other users.</p>
      </Section>

      <Section title="Limitation of liability">
        <p>To the maximum extent permitted by law, Electrace and US Nylon are not liable for any damages arising from your use of the product, including any loss of data or any consequences of a design you produced with it.</p>
      </Section>

      <Section title="Changes">
        <p>We may update these terms as the product matures; continued use after a change means you accept it. Questions? <a href="mailto:hello@electrace.net" className="text-link hover:underline">hello@electrace.net</a>.</p>
      </Section>
    </main>
  );
}
