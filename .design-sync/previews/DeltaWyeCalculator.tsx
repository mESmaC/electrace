import type { ReactNode } from "react";
import { DeltaWyeCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Delta to Wye (Δ to Y) resistor-network conversion, both directions. */
export const Default = () => (
  <Frame>
    <DeltaWyeCalculator />
  </Frame>
);
