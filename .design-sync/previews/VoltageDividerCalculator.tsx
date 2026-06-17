import type { ReactNode } from "react";
import { VoltageDividerCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Resistive divider — Vout, output impedance and current, plus a reverse E24 solver for a target ratio. */
export const Default = () => (
  <Frame>
    <VoltageDividerCalculator />
  </Frame>
);
