import type { ReactNode } from "react";
import { OpAmpGainCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Op-amp gain — non-inverting and inverting gain (and dB) from the feedback resistors, with a reverse solver. */
export const Default = () => (
  <Frame>
    <OpAmpGainCalculator />
  </Frame>
);
