import type { ReactNode } from "react";
import { NetlistView } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 16, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      {/* NetlistView fills its container (ReactFlow + fitView) — give it an explicit box. */}
      <div style={{ height: 360, width: "100%", borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)" }}>
        {children}
      </div>
    </div>
  );
}

// A small 3.3V LDO supply: parts + named nets (members are pin refs like "U1.OUT", or "@vin"
// for a boundary terminal). NetlistView auto-lays-out left→right with dagre.
const parts = [
  { ref: "U1", type: "regulator", value: "AMS1117-3.3" },
  { ref: "C1", type: "capacitor", value: "10µF" },
  { ref: "C2", type: "capacitor", value: "22µF" },
  { ref: "R1", type: "resistor", value: "1k" },
  { ref: "D1", type: "led", value: "green" },
];
const nets = [
  { name: "VIN", members: ["@vin", "U1.IN", "C1.1"] },
  { name: "3V3", members: ["U1.OUT", "C2.1", "R1.1"] },
  { name: "GND", members: ["@gnd", "U1.GND", "C1.2", "C2.2", "D1.2"] },
  { name: "LED", members: ["R1.2", "D1.1"] },
];

/** The netlist as a force-laid-out graph: parts, named nets (rounded), and boundary terminals (⏚). */
export const LdoSupply = () => (
  <Frame>
    <NetlistView parts={parts} nets={nets} />
  </Frame>
);
