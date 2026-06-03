import { test } from "node:test";
import assert from "node:assert/strict";
import { drcCheck, type DrcInput } from "../src/drc.js";

const base: DrcInput = { traces: [], pads: [], vias: [], comps: [], unrouted: [], clearance: 0.2 };

test("unrouted links surface as errors", () => {
  const v = drcCheck({ ...base, unrouted: [{ net: "VCC", from: { x: 0, y: 0 }, to: { x: 4, y: 0 } }] });
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "unrouted");
  assert.deepEqual(v[0].where, { x: 2, y: 0 }); // midpoint, for the marker
});

test("a clean two-trace layout has no violations", () => {
  const v = drcCheck({
    ...base,
    traces: [
      { id: "a", net: "N1", layer: "top", width: 0.25, path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] },
      { id: "b", net: "N2", layer: "top", width: 0.25, path: [{ x: 0, y: 3 }, { x: 5, y: 3 }] }, // 3mm apart
    ],
  });
  assert.equal(v.length, 0);
});

test("trace through a different-net pad is a short", () => {
  const v = drcCheck({
    ...base,
    traces: [{ id: "a", net: "SIG", layer: "top", width: 0.25, path: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
    pads: [{ key: "U1.3", net: "GND", x: 5, y: 0, w: 1, h: 1 }],
  });
  assert.equal(v.filter((x) => x.kind === "short").length, 1);
  assert.match(v[0].msg, /SIG shorts to GND/);
});

test("a pad on the trace's own net is not a short", () => {
  const v = drcCheck({
    ...base,
    traces: [{ id: "a", net: "SIG", layer: "top", width: 0.25, path: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
    pads: [{ key: "U1.3", net: "SIG", x: 5, y: 0, w: 1, h: 1 }],
  });
  assert.equal(v.length, 0);
});

test("two close different-net traces violate clearance", () => {
  const v = drcCheck({
    ...base,
    clearance: 0.2,
    traces: [
      { id: "a", net: "N1", layer: "top", width: 0.25, path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] },
      { id: "b", net: "N2", layer: "top", width: 0.25, path: [{ x: 0, y: 0.3 }, { x: 5, y: 0.3 }] }, // gap 0.3 - 0.25 = 0.05 < 0.2
    ],
  });
  assert.equal(v.filter((x) => x.kind === "clearance").length, 1);
});

test("clearance is ignored across layers", () => {
  const v = drcCheck({
    ...base,
    traces: [
      { id: "a", net: "N1", layer: "top", width: 0.25, path: [{ x: 0, y: 0 }, { x: 5, y: 0 }] },
      { id: "b", net: "N2", layer: "bottom", width: 0.25, path: [{ x: 0, y: 0.05 }, { x: 5, y: 0.05 }] },
    ],
  });
  assert.equal(v.length, 0);
});

test("crossing different-net traces on the same layer collide (distance 0)", () => {
  const v = drcCheck({
    ...base,
    traces: [
      { id: "a", net: "N1", layer: "top", width: 0.25, path: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
      { id: "b", net: "N2", layer: "top", width: 0.25, path: [{ x: 0, y: 5 }, { x: 5, y: 0 }] },
    ],
  });
  assert.equal(v.filter((x) => x.kind === "clearance").length, 1);
});

test("overlapping components warn", () => {
  const v = drcCheck({
    ...base,
    comps: [
      { ref: "R1", x: 0, y: 0, w: 2, h: 1, rot: 0 },
      { ref: "R2", x: 1, y: 0, w: 2, h: 1, rot: 0 }, // overlaps R1 in x
    ],
  });
  const o = v.filter((x) => x.kind === "overlap");
  assert.equal(o.length, 1);
  assert.equal(o[0].severity, "warn");
});

const rect = (w: number, h: number) => ({ outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });

test("copper outside the board outline is an off-board error", () => {
  const v = drcCheck({
    ...base,
    board: rect(10, 10),
    pads: [{ key: "U1.1", net: "N", x: 5, y: 5, w: 1, h: 1 }, { key: "U1.2", net: "N", x: 12, y: 5, w: 1, h: 1 }],
  });
  const off = v.filter((x) => x.kind === "offboard");
  assert.equal(off.length, 1);
  assert.match(off[0].msg, /U1\.2 is off the board/);
});

test("an L-shaped (non-convex) outline excludes the notch", () => {
  // an 'L': full 10×10 minus the top-right 5×5 quadrant
  const L = { outline: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
  const v = drcCheck({
    ...base,
    board: L,
    pads: [{ key: "A.1", net: "N", x: 2, y: 2, w: 1, h: 1 }, { key: "A.2", net: "N", x: 8, y: 2, w: 1, h: 1 }], // 2nd is in the notch
  });
  const off = v.filter((x) => x.kind === "offboard");
  assert.equal(off.length, 1);
  assert.match(off[0].msg, /A\.2 is off the board/);
});

test("a component past the board edge warns", () => {
  const v = drcCheck({
    ...base,
    board: rect(10, 10),
    comps: [{ ref: "J1", x: 9.5, y: 5, w: 3, h: 2, rot: 0 }], // right edge at 11 > 10
  });
  const off = v.filter((x) => x.kind === "offboard");
  assert.equal(off.length, 1);
  assert.equal(off[0].severity, "warn");
});

test("no board → no off-board checks", () => {
  const v = drcCheck({ ...base, pads: [{ key: "U1.1", net: "N", x: 999, y: 999, w: 1, h: 1 }] });
  assert.equal(v.length, 0);
});

test("output is deterministic / order-stable", () => {
  const inp: DrcInput = {
    ...base,
    unrouted: [{ net: "A", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, { net: "B", from: { x: 2, y: 0 }, to: { x: 3, y: 0 } }],
  };
  assert.deepEqual(drcCheck(inp), drcCheck(inp));
});
