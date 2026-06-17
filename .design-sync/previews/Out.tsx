import type { ReactNode } from "react";
import { Out } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>{children}</div>
    </div>
  );
}

/** Result rows — a monospace value against a label. `strong` highlights the solved-for row,
 *  `warn` flags an out-of-spec value, `note` adds the formula or a caution. */
export const States = () => (
  <Frame>
    <Out label="Resistance" value="250 Ω" strong note="R = V / I" />
    <Out label="Voltage" value="5.000 V" note="V = I · R" />
    <Out label="Current" value="20 mA" />
    <Out label="Power dissipated" value="100 mW" warn note="over ¼ W — check the part's rating" />
  </Frame>
);
