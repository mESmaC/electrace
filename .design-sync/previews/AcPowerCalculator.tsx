import type { ReactNode } from "react";
import { AcPowerCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** AC power — real/apparent/reactive power, power-factor correction and efficiency. */
export const Default = () => (
  <Frame>
    <AcPowerCalculator />
  </Frame>
);
