import type { ReactNode } from "react";
import { SchematicPreview } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg2)", padding: 24, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ maxWidth: 560 }}>{children}</div>
    </div>
  );
}

// Real authored layout from the @electrace/bridge-rectifier block (electrace/blocks/bridge-rectifier).
const layout = {
  symbols: [
    { id: "P_ac1", type: "port", ref: "ac1", x: 90, y: 170, rot: 180 },
    { id: "D1", type: "diode", ref: "D1", x: 195, y: 101, rot: 270 },
    { id: "D2", type: "diode", ref: "D2", x: 355, y: 101, rot: 270 },
    { id: "D3", type: "diode", ref: "D3", x: 195, y: 231, rot: 270 },
    { id: "D4", type: "diode", ref: "D4", x: 355, y: 231, rot: 270 },
    { id: "P_ac2", type: "port", ref: "ac2", x: 430, y: 170, rot: 0 },
    { id: "C1", type: "cap-pol", ref: "C1", value: "470µF", x: 438, y: 96, rot: 90 },
    { id: "P_vout", type: "port", ref: "vout", x: 560, y: 70, rot: 0 },
    { id: "P_gnd", type: "port", ref: "gnd", x: 470, y: 270, rot: 0 },
  ],
  wires: [
    { from: "D1.2", to: "D2.2" }, { from: "D2.2", to: "C1.1" }, { from: "C1.1", to: "P_vout.1" },
    { from: "D3.1", to: "D4.1" }, { from: "D4.1", to: "P_gnd.1" }, { from: "C1.2", to: "P_gnd.1" },
    { from: "D1.1", to: "D3.2" }, { from: "P_ac1.1", to: "D3.2" },
    { from: "D2.1", to: "D4.2" }, { from: "P_ac2.1", to: "D4.2" },
  ],
};

/** A read-only schematic thumbnail — the bridge rectifier's four diodes + smoothing cap, wires
 *  colored by net health, drawn from the block's authored layout. */
export const BridgeRectifier = () => (
  <Frame>
    <SchematicPreview blockId="bridge-rectifier" layout={layout} height="fit" />
  </Frame>
);
