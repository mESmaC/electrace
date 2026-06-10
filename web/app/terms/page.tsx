import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Terms — Electrace",
  description: "The terms for using Electrace.",
  alternates: { canonical: `${SITE}/terms` },
};

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
        <p className="mt-1 text-faint">Last updated June 2026. By using Electrace you agree to the following.</p>
      </header>

      <Section title="Your account">
        <p>You&apos;re responsible for your account and for keeping its credentials safe. One person per account. We may suspend accounts that threaten the service or other users.</p>
      </Section>

      <Section title="Plans, billing, and cancellation">
        <p>The <strong>Hobby</strong> plan is free and includes the full understand-loop with up to 10 designs. <strong>Pro</strong> is a paid subscription (monthly or annual) that renews automatically until cancelled. You can cancel any time from the billing portal in Settings — your Pro features run to the end of the paid period, and your designs are never deleted when a subscription ends (private ones simply can&apos;t stay private beyond the plan that allows them; we&apos;ll never silently publish them — they just can&apos;t be edited as private without Pro).</p>
        <p>Payments are processed by Stripe. If a price ever changes, existing subscribers get notice before any renewal at the new price. Billing problem? Email us — we&apos;re reasonable.</p>
      </Section>

      <Section title="Checks are structural, not a simulation">
        <p>Electrace&apos;s live checks catch structural mistakes — open nets, undriven rails, over-voltage, current budgets, polarity, and the like — computed deterministically from values <em>you</em> declare. They are <strong>not</strong> a simulation: no SPICE, no transient or thermal analysis, and no guarantee a design works or is safe. A clean result means &quot;structurally sane,&quot; not &quot;validated.&quot; <strong>You are responsible for verifying any design — with simulation, calculation, and real review — before building, manufacturing, or relying on it.</strong> Never use Electrace as the sole verification for anything safety-relevant.</p>
      </Section>

      <Section title="The assistant is advisory">
        <p>Sparky builds and explains designs using AI. Its output can be wrong. The deterministic checks remain the source of truth for the numbers, and the responsibility for any design remains yours.</p>
      </Section>

      <Section title="Your content is yours">
        <p>You keep all rights to the designs and blocks you create. You grant us only what&apos;s technically necessary to run the service — storing your work, processing it for the checks and the assistant, and rendering it where you&apos;ve chosen to share it. We don&apos;t use your work to train models.</p>
        <p>If you set a design to <strong>public</strong> or <strong>unlisted</strong>, you&apos;re granting viewers the ability to see it and to <strong>open a copy</strong> into their own workspace. Don&apos;t share what you don&apos;t want copied — or keep it private (Pro).</p>
      </Section>

      <Section title="Parts links">
        <p>BOM links to component distributors may be affiliate links that earn us a commission at no cost to you. They never influence which parts a block recommends.</p>
      </Section>

      <Section title="Acceptable use">
        <p>Don&apos;t break the law, attack or overload the service, abuse the AI assistant (it has fair-use limits), or use Electrace to design things intended to harm people.</p>
      </Section>

      <Section title="Early-access software">
        <p>Electrace is provided <strong>as-is</strong>, without warranties of any kind. It is in active development: features may change and occasional bugs are a fact of life. Your work syncs to your account, but exporting anything you deeply care about is always wise.</p>
      </Section>

      <Section title="Limitation of liability">
        <p>To the maximum extent permitted by law, Electrace and US Nylon are not liable for damages arising from use of the product — including loss of data, lost profits, or any consequence of a design produced with it. Our total liability is limited to the amount you paid us in the twelve months before the claim.</p>
      </Section>

      <Section title="Changes">
        <p>We may update these terms as the product matures; material changes will be noted here with a new date, and continued use after a change means you accept it. Questions? <a href="mailto:contact@usnylon.com" className="text-link hover:underline">contact@usnylon.com</a>.</p>
      </Section>
    </main>
  );
}
