import type { ReactNode } from "react";
import { SevChip } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 28, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>{children}</div>
    </div>
  );
}

/** The lint-severity badge — color + icon + text (never color alone), one per check severity. */
export const AllSeverities = () => (
  <Frame>
    <SevChip sev="error" />
    <SevChip sev="warn" />
    <SevChip sev="info" />
    <SevChip sev="recommendation" />
    <SevChip sev="unknown" />
  </Frame>
);
