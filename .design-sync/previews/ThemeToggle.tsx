import type { ReactNode } from "react";
import { ThemeToggle } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 28, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** The triple theme selector — Light / Mid / Dark (Mid is the default). Sets <html data-theme>. */
export const Selector = () => (
  <Frame>
    <ThemeToggle />
  </Frame>
);
