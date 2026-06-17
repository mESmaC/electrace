import type { ReactNode } from "react";
import { LedResistorCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Series resistor for an LED — supply, forward voltage and current give the resistor, nearest E-series value and power. */
export const Default = () => (
  <Frame>
    <LedResistorCalculator />
  </Frame>
);
