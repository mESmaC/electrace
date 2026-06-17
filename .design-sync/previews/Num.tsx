import type { ReactNode } from "react";
import { Num } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 320 }}>{children}</div>
    </div>
  );
}

/** Labeled numeric input with an optional unit suffix — the calculators' field control. */
export const Fields = () => (
  <Frame>
    <Num label="Resistance" value={250} unit="Ω" step={10} onChange={() => {}} />
    <Num label="Supply voltage" value={5} unit="V" onChange={() => {}} />
    <Num label="Capacitance" value={100} unit="nF" onChange={() => {}} />
  </Frame>
);
