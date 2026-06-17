import type { ReactNode } from "react";
import { Logo } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 28, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** The horizontal app-header lockup: mark + monospace "Electrace" wordmark + code caret.
 *  Sizes to the font-size set via className; the mark scales with the text. */
export const Wordmark = () => (
  <Frame>
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Logo className="text-[26px]" />
      <Logo className="text-[18px]" />
    </div>
  </Frame>
);
