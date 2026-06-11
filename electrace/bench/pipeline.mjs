// Engine pipeline benchmark: synthetic designs at increasing scale, timing each stage.
// Blocks mirror real ones: 4 terminals + an internal schematic with 3 parts (what the
// internal-inspection rules iterate over).
import { resolve } from "../dist/resolve.js";
import { lint } from "../dist/lint.js";
import { flatten } from "../dist/flatten.js";
import { annotatePower } from "../dist/power.js";

const mkBlock = (n) => ({
  id: `@b/blk${n}`, name: `Blk${n}`, version: "1",
  terminals: [
    { id: "vin", role: "in", type: "power", v: { max: 16, unit: "V" }, i: { max: 0.05, unit: "A" } },
    { id: "gnd", role: "in", type: "gnd" },
    { id: "out", role: "out", type: "signal", v: { follows: "vin" } },
    { id: "sig", role: "in", type: "signal", v: { max: 16, unit: "V" }, i: { max: 0.01, unit: "A" } },
  ],
  schematic: {
    parts: [
      { ref: "C1", type: "cap", value: "100nF" },
      { ref: "R1", type: "res", value: "10k" },
      { ref: "U1", type: "ic", part: "generic" },
    ],
    nets: [
      { name: "VIN", connect: ["C1.1", "R1.1", "U1.1", "@vin"] },
      { name: "GND", connect: ["C1.2", "U1.2", "@gnd"] },
      { name: "OUT", connect: ["U1.3", "@out"] },
      { name: "SIG", connect: ["R1.2", "U1.4", "@sig"] },
    ],
  },
});
const SRC = {
  id: "@b/src", name: "Src", version: "1",
  terminals: [
    { id: "vout", role: "out", type: "power", v: { min: 9, max: 12, unit: "V" }, i: { max: 3, unit: "A" } },
    { id: "gnd", role: "out", type: "gnd" },
  ],
  schematic: { parts: [], nets: [] },
};

function mkDesign(n) {
  const blocks = new Map([["@b/src@1", SRC]]);
  const design = { id: "d", name: "d", blocks: [{ ref: "S1", block: "@b/src@1" }], connections: [], connectors: [{ ref: "J1", connector: "usb-c" }] };
  for (let k = 0; k < n; k++) {
    const b = mkBlock(k); blocks.set(`${b.id}@1`, b);
    const ref = `B${k}`;
    design.blocks.push({ ref, block: `${b.id}@1` });
    design.connections.push({ from: "S1.vout", to: `${ref}.vin` }, { from: "S1.gnd", to: `${ref}.gnd` });
    if (k > 0) design.connections.push({ from: `B${k - 1}.out`, to: `${ref}.sig` }); // signal chain
  }
  return { design, blocks };
}

const time = (fn, reps = 5) => { fn(); const t0 = performance.now(); for (let i = 0; i < reps; i++) fn(); return (performance.now() - t0) / reps; };
console.log("blocks | resolve | lint | flatten | power | TOTAL (ms, avg of 5 after warmup)");
for (const n of [10, 50, 150, 400]) {
  const { design, blocks } = mkDesign(n);
  let rd;
  const tR = time(() => { rd = resolve(design, blocks); });
  const tL = time(() => lint(rd));
  const tF = time(() => flatten(rd));
  const tP = time(() => annotatePower(rd));
  console.log(`${String(n).padStart(6)} | ${tR.toFixed(1).padStart(7)} | ${tL.toFixed(1).padStart(4)} | ${tF.toFixed(1).padStart(7)} | ${tP.toFixed(1).padStart(5)} | ${(tR + tL + tF + tP).toFixed(1)}`);
}
