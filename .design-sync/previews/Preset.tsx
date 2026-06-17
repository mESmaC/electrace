import type { ReactNode } from "react";
import { Preset } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );
}

/** Small selectable preset chips — the "solve for" / mode toggles across the calculators. */
export const Chips = () => (
  <Frame>
    <Preset label="Resistance" active onClick={() => {}} />
    <Preset label="Voltage" onClick={() => {}} />
    <Preset label="Current" onClick={() => {}} />
    <Preset label="Power" onClick={() => {}} />
  </Frame>
);
