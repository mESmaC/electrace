import type { ReactNode } from "react";
import { CurrentDividerCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** Current divider — branch currents, parallel resistance and the pair voltage. */
export const Default = () => (
  <Frame>
    <CurrentDividerCalculator />
  </Frame>
);
