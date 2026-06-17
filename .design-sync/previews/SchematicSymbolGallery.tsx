import type { ReactNode } from "react";
import { SchematicSymbolGallery } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

/** The full Electrace schematic-symbol library, grouped (Passive, Diode, Transistor, Integrated,
 *  Source, Power, Electromechanical, Connector) — ANSI/IEEE standard. */
export const Library = () => (
  <Frame>
    <SchematicSymbolGallery standard="ansi" />
  </Frame>
);
