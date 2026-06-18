import type { ReactNode } from "react";
import { FootprintPreview } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>{children}</div>
    </div>
  );
}

// Real land patterns (mm). SMD pads draw in the accent; through-hole (DO-41) in amber with the drill.
const footprints = [
  { id: "R0603", kind: "smd", w: 2.6, h: 1.5, pads: [
    { num: "1", x: -0.75, y: 0, w: 0.9, h: 0.95, round: 0.2 },
    { num: "2", x: 0.75, y: 0, w: 0.9, h: 0.95, round: 0.2 },
  ] },
  { id: "SOT-23", kind: "smd", w: 3.0, h: 3.0, pads: [
    { num: "1", x: -1.0, y: -0.95, w: 0.7, h: 0.8, round: 0.2 },
    { num: "2", x: -1.0, y: 0.95, w: 0.7, h: 0.8, round: 0.2 },
    { num: "3", x: 1.0, y: 0, w: 0.7, h: 0.8, round: 0.2 },
  ] },
  { id: "SOIC-8", kind: "smd", w: 6.0, h: 5.2, pads: [-1.905, -0.635, 0.635, 1.905].flatMap((y, i) => [
    { num: String(i + 1), x: -2.7, y, w: 1.5, h: 0.5, round: 0.15 },
    { num: String(8 - i), x: 2.7, y, w: 1.5, h: 0.5, round: 0.15 },
  ]) },
  { id: "DO-41 (THT)", kind: "tht", w: 12, h: 3, pads: [
    { num: "1", x: -5, y: 0, w: 1.8, h: 1.8, round: 1, drill: 0.9 },
    { num: "2", x: 5, y: 0, w: 1.8, h: 1.8, round: 1, drill: 0.9 },
  ] },
];

/** PCB land patterns drawn to scale — SMD pads in the accent, through-hole pads in amber with drills. */
export const LandPatterns = () => (
  <Frame>
    {footprints.map((f) => (
      <div key={f.id} style={{ display: "grid", placeItems: "center", gap: 8, padding: 12, borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", minWidth: 110 }}>
        <div style={{ display: "grid", placeItems: "center", height: 96, width: 96, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
          <FootprintPreview footprint={f as never} size={88} />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-faint)" }}>{f.id}</span>
      </div>
    ))}
  </Frame>
);
