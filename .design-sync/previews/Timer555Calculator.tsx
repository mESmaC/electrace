import type { ReactNode } from "react";
import { Timer555Calculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** 555 astable timer — frequency, duty cycle and high/low times from R1, R2 and C. */
export const Default = () => (
  <Frame>
    <Timer555Calculator />
  </Frame>
);
