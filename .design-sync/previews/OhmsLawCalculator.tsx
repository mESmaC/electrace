import type { ReactNode } from "react";
import { OhmsLawCalculator } from "@electrace/ui";

// Render on the Electrace Mid surface (the product default) so the calculator's panels,
// tokens and fonts read exactly as they do in the app.
function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Ohm's-law solver — pick what to solve for; power and Joule's-law energy update live. */
export const Default = () => (
  <Frame>
    <OhmsLawCalculator />
  </Frame>
);
