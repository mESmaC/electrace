import type { ReactNode } from "react";
import { MotorWindingCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** BLDC motor winding — Kt/Kv, rewind turns and stator/wire sizing. */
export const Default = () => (
  <Frame>
    <MotorWindingCalculator />
  </Frame>
);
