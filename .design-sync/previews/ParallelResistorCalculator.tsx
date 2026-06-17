import type { ReactNode } from "react";
import { ParallelResistorCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Resistors in parallel/series — combined value from a list of parts, plus a reverse solver for a target. */
export const Default = () => (
  <Frame>
    <ParallelResistorCalculator />
  </Frame>
);
