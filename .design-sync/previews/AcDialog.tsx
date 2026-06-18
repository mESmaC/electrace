import { AcDialog } from "@electrace/ui";
import { resolve, type Block, type Design, type Terminal } from "@electrace/core";

// A real RC low-pass run through @electrace/core's actual resolver + AC engine (not a mock curve):
// R 10k in series, C 100nF to ground → −3 dB ≈ 159 Hz. frequencyResponse() drives vin with 1V AC
// and reads vout, exactly as it does for a user's own design.
const RC: Block = {
  id: "@demo/rc-lowpass",
  name: "RC Low-pass",
  version: "1.0.0",
  terminals: [
    { id: "vin", role: "in", type: "signal" },
    { id: "vout", role: "out", type: "signal" },
    { id: "gnd", role: "in", type: "gnd" },
  ] as Terminal[],
  schematic: {
    parts: [
      { ref: "R1", type: "res", value: "10k", footprint: "R0603" },
      { ref: "C1", type: "cap", value: "100nF", footprint: "C0603" },
    ],
    nets: [
      { name: "VIN", connect: ["R1.1", "@vin"] },
      { name: "VOUT", connect: ["R1.2", "C1.1", "@vout"] },
      { name: "GND", connect: ["C1.2", "@gnd"] },
    ],
  },
};
const design: Design = {
  id: "rc-demo",
  name: "RC low-pass",
  blocks: [{ ref: "F1", block: "@demo/rc-lowpass@1.0.0" }],
  connections: [],
};
const rd = resolve(design, new Map([["@demo/rc-lowpass@1.0.0", RC]]));

/** The Bode dialog over a real resolved RC low-pass — magnitude/phase, the −3 dB corner marked,
 *  and the solver's honesty notes. Computed by the actual @electrace/core AC engine. */
export const RcLowpass = () => (
  <div data-theme="mid" style={{ background: "var(--color-bg2)" }}>
    <AcDialog rd={rd} onClose={() => {}} />
  </div>
);
