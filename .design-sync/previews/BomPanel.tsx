import type { ReactNode } from "react";
import { BomPanel } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ maxWidth: 460 }}>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-faint">Bill of materials</div>
        {children}
      </div>
    </div>
  );
}

// Real parts from the @electrace/bridge-rectifier block.
const rows = [
  { qty: 4, type: "diode", part: "1N4007", footprint: "DO-41", refs: ["D1", "D2", "D3", "D4"] },
  { qty: 1, type: "cap", value: "470µF", footprint: "radial-8mm", polarized: true, refs: ["C1"] },
  { qty: 2, type: "header", value: "2-pin", footprint: "2.54mm", refs: ["J1", "J2"] },
];

/** The buyable BOM — quantity, value/part, refs, and a Digi-Key "buy" link per line, with CSV +
 *  cart actions and the affiliate disclosure. Rendered free (CSV is the Pro gate). */
export const BridgeRectifierBom = () => (
  <Frame>
    <BomPanel designName="Bridge Rectifier" pro={false} rows={rows} />
  </Frame>
);
