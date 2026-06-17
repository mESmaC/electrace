import type { ReactNode } from "react";
import { CrystalLoadCapacitorCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Crystal load capacitors — load caps and nearest standard value from CL and stray capacitance. */
export const Default = () => (
  <Frame>
    <CrystalLoadCapacitorCalculator />
  </Frame>
);
