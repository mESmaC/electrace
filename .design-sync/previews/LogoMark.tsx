import type { ReactNode } from "react";
import { LogoMark } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 32, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** The Electrace brand mark alone: an open "C" ring (text token) with a resistor trace and
 *  net terminals (blue accent) through it. Needs a themed surface so the ring reads. */
export const Mark = () => (
  <Frame>
    {/* h-[1.4em] (the app's own sizing class) scales the mark to the wrapper font-size. */}
    <div style={{ fontSize: 96 }}>
      <LogoMark className="h-[1.4em] w-auto" />
    </div>
  </Frame>
);
