import type { ReactNode } from "react";
import { AcMotorCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** AC induction motor — synchronous speed, slip, torque and efficiency. */
export const Default = () => (
  <Frame>
    <AcMotorCalculator />
  </Frame>
);
