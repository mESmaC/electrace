import { test } from "node:test";
import assert from "node:assert/strict";
import { toKicadPcb, type KicadPcbInput } from "../src/export-kicad-pcb.js";

const sample: KicadPcbInput = {
  comps: [
    { ref: "R1", value: "330", footprint: "0603", x: 5, y: 5, rot: 0, pads: [
      { num: "1", net: "VIN", x: -0.8, y: 0, w: 0.9, h: 0.95, round: 0.25 },
      { num: "2", net: "A", x: 0.8, y: 0, w: 0.9, h: 0.95, round: 0.25 },
    ] },
    { ref: "D1", value: "1N4007", footprint: "DO-41", x: 12, y: 5, rot: 90, pads: [
      { num: "1", net: "A", x: -2.5, y: 0, w: 1.6, h: 1.6, drill: 0.9 },
      { num: "2", net: "GND", x: 2.5, y: 0, w: 1.6, h: 1.6, drill: 0.9 },
    ] },
  ],
  traces: [{ net: "A", layer: "F.Cu", width: 0.25, path: [{ x: 5.8, y: 5 }, { x: 8, y: 5 }, { x: 9.5, y: 5 }] }],
  vias: [{ net: "A", x: 8, y: 5, r: 0.5, drill: 0.4 }],
  board: { outline: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }] },
};

// balanced-parens check (ignores parens inside quoted strings)
function balanced(s: string): boolean {
  let depth = 0, inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    else if (!inStr && ch === "(") depth++;
    else if (!inStr && ch === ")") { depth--; if (depth < 0) return false; }
  }
  return depth === 0 && !inStr;
}

test("emits a well-formed, paren-balanced kicad_pcb", () => {
  const s = toKicadPcb(sample);
  assert.ok(s.startsWith("(kicad_pcb"));
  assert.ok(balanced(s));
  assert.match(s, /\(version 20221018\)/);
});

test("declares every net exactly once, with net 0 first", () => {
  const s = toKicadPcb(sample);
  const decls = [...s.matchAll(/^  \(net (\d+) "([^"]*)"\)$/gm)].map((m) => [Number(m[1]), m[2]] as const);
  assert.deepEqual(decls[0], [0, ""]);
  const names = decls.map((d) => d[1]);
  assert.deepEqual([...names].sort(), ["", "A", "GND", "VIN"]); // 4 distinct nets
  assert.equal(new Set(decls.map((d) => d[0])).size, decls.length); // codes unique
});

test("through-hole pads get drill + *.Cu, SMD pads do not", () => {
  const s = toKicadPcb(sample);
  assert.match(s, /\(pad "1" thru_hole circle .* \(drill 0\.9\) \(layers "\*\.Cu" "\*\.Mask"\)/);
  assert.match(s, /\(pad "1" smd roundrect .* \(layers "F\.Cu" "F\.Paste" "F\.Mask"\)/);
});

test("a 3-point trace becomes 2 segments; via + edge cuts present", () => {
  const s = toKicadPcb(sample);
  assert.equal((s.match(/\(segment /g) ?? []).length, 2);
  assert.match(s, /\(via \(at 8 5\) \(size 1\) \(drill 0\.4\)/);
  // 4-corner outline → 4 closed Edge.Cuts lines
  const cuts = [...s.matchAll(/\(gr_line .* \(layer "Edge\.Cuts"\)\)/g)];
  assert.equal(cuts.length, 4);
  assert.match(s, /\(gr_line \(start 20 12\) \(end 0 12\)/); // a wrap-around edge
});

test("fillet radius turns corners into arc tracks", () => {
  const inp: KicadPcbInput = {
    comps: [], vias: [], board: { outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
    traces: [{ net: "N", layer: "F.Cu", width: 0.25, path: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] }],
    fillet: 1,
  };
  const s = toKicadPcb(inp);
  // one 90° corner → 2 straight runs + 1 arc
  assert.equal((s.match(/\(segment /g) ?? []).length, 2);
  assert.equal((s.match(/\(arc /g) ?? []).length, 1);
  // tangent points: incoming cut to (4,0), outgoing cut to (5,1)
  assert.match(s, /\(arc \(start 4 0\) \(mid 4\.7\d* 0\.29\d*\) \(end 5 1\)/);
});

test("fillet 0 (default) keeps plain segments — no arcs", () => {
  const s = toKicadPcb(sample);
  assert.equal((s.match(/\(arc /g) ?? []).length, 0);
});

test("rotation is emitted only when nonzero", () => {
  const s = toKicadPcb(sample);
  assert.match(s, /\(at 12 5 90\)/);  // D1
  assert.match(s, /\(at 5 5\)/);       // R1, no rot token
});

test("deterministic across runs", () => {
  assert.equal(toKicadPcb(sample), toKicadPcb(sample));
});
