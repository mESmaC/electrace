import type { ReactNode } from "react";
import { SchematicSymbol } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {children}
    </div>
  );
}

const cell = { display: "grid", placeItems: "center", gap: 6, padding: "14px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", minWidth: 92 } as const;
const Box = ({ type, standard = "ansi" as const }: { type: string; standard?: "ansi" | "iec" }) => (
  <div style={cell}>
    <SchematicSymbol type={type} standard={standard} size={64} />
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-faint)" }}>{type}</span>
  </div>
);

/** A spread of common symbols from the library. Body strokes follow the text token; leads are the blue accent. */
export const CommonSymbols = () => (
  <Frame>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {["resistor", "capacitor", "inductor", "diode", "led", "npn", "opamp", "ground", "battery"].map((t) => (
        <Box key={t} type={t} />
      ))}
    </div>
  </Frame>
);

/** Active devices & sources — transistors, IC/op-amp/regulator, battery, transformer, relay, motor. */
export const ActiveAndSources = () => (
  <Frame>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {["npn", "pnp", "nmos", "ic", "opamp", "regulator", "battery", "transformer", "relay", "motor"].map((t) => (
        <Box key={t} type={t} />
      ))}
    </div>
  </Frame>
);

/** The same parts drawn in both supported standards — ANSI/IEEE (US) vs IEC 60617 (international). */
export const AnsiVsIec = () => (
  <Frame>
    <div style={{ display: "flex", gap: 28 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 10 }}>ANSI</div>
        <div style={{ display: "flex", gap: 12 }}>{["resistor", "inductor"].map((t) => <Box key={t} type={t} standard="ansi" />)}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 10 }}>IEC</div>
        <div style={{ display: "flex", gap: 12 }}>{["resistor", "inductor"].map((t) => <Box key={t} type={t} standard="iec" />)}</div>
      </div>
    </div>
  </Frame>
);
