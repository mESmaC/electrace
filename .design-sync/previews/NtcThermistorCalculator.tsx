import type { ReactNode } from "react";
import { NtcThermistorCalculator } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** NTC thermistor divider — resistance, Vout and ADC counts across temperature. */
export const Default = () => (
  <Frame>
    <NtcThermistorCalculator />
  </Frame>
);
