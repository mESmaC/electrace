import type { ReactNode } from "react";
import { RcFilterCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** First-order RC filter — cutoff frequency from R and C, plus a reverse solver for a target cutoff. */
export const Default = () => (
  <Frame>
    <RcFilterCalculator />
  </Frame>
);
