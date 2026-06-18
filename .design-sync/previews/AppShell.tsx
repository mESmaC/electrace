import { AppShell, OhmsLawCalculator } from "@electrace/ui";

/** The full Electrace page frame — sticky nav (logo, sections, theme, account) over an ambient
 *  backdrop, a real calculator page as the content, and the footer. The whole on-brand chrome. */
export const CalculatorPage = () => (
  <div data-theme="mid" style={{ background: "var(--color-bg)" }}>
    <AppShell>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", fontFamily: "var(--font-sans)" }}>
        <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-text)" }}>Ohm&apos;s law calculator</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: "var(--color-dim)" }}>Solve for resistance, voltage or current — with power and Joule&apos;s-law energy.</p>
        <div style={{ marginTop: 24 }}>
          <OhmsLawCalculator />
        </div>
      </main>
    </AppShell>
  </div>
);
