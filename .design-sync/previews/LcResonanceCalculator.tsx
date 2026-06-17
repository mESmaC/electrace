import type { ReactNode } from "react";
import { LcResonanceCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** LC resonance — resonant frequency and reactances from L and C, with a series/parallel combo panel. */
export const Default = () => (
  <Frame>
    <LcResonanceCalculator />
  </Frame>
);
