import type { ReactNode } from "react";
import { FilterDesignerCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Butterworth Sallen-Key filter designer — per-stage component values for a target order and cutoff. */
export const Default = () => (
  <Frame>
    <FilterDesignerCalculator />
  </Frame>
);
