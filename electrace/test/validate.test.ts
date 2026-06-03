import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBlock } from "../src/validate.js";
import type { Block } from "../src/types.js";

const base = (over: Partial<Block> = {}): Block => ({
  id: "@t/x", name: "X", version: "1.0.0",
  terminals: [{ id: "vin", role: "in", type: "power" }, { id: "gnd", role: "in", type: "gnd" }],
  ...over,
});

const codes = (b: Block) => validateBlock(b).map((i) => i.code).sort();

test("a clean, fully-wired block has no issues", () => {
  const b = base({
    layout: {
      symbols: [
        { id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 },
        { id: "R1", type: "resistor", ref: "R1", x: 0, y: 0 },
        { id: "P_gnd", type: "port", ref: "gnd", x: 0, y: 0 },
      ],
      wires: [{ from: "P_vin.1", to: "R1.1" }, { from: "R1.2", to: "P_gnd.1" }],
    },
  });
  assert.deepEqual(validateBlock(b), []);
});

test("missing manifest fields are errors", () => {
  const issues = validateBlock({ id: "", name: "", version: "", terminals: [] } as unknown as Block);
  assert.ok(issues.some((i) => i.code === "block/no-id"));
  assert.ok(issues.some((i) => i.code === "block/no-terminals"));
});

test("a wire to a nonexistent pin is a located error", () => {
  const b = base({
    layout: {
      symbols: [{ id: "R1", type: "resistor", ref: "R1", x: 0, y: 0 }, { id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 }, { id: "P_gnd", type: "port", ref: "gnd", x: 0, y: 0 }],
      wires: [{ from: "P_vin.1", to: "R1.5" }, { from: "R1.2", to: "P_gnd.1" }],
    },
  });
  const bad = validateBlock(b).find((i) => i.code === "wire/unknown-pin");
  assert.ok(bad, "flags the bad pin");
  assert.equal(bad!.at, "R1.5");
  assert.match(bad!.message, /has pins 1\/2/);
});

test("a wire to an unplaced symbol is an error", () => {
  const b = base({ layout: { symbols: [{ id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 }], wires: [{ from: "P_vin.1", to: "R9.1" }] } });
  assert.ok(codes(b).includes("wire/unknown-symbol"));
});

test("a port naming an undeclared terminal warns", () => {
  const b = base({ layout: { symbols: [{ id: "P_x", type: "port", ref: "nope", x: 0, y: 0 }], wires: [] } });
  assert.ok(codes(b).includes("port/unknown-terminal"));
});

test("an unconnected terminal warns", () => {
  const b = base({
    layout: {
      symbols: [{ id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 }, { id: "R1", type: "resistor", ref: "R1", x: 0, y: 0 }, { id: "P_gnd", type: "port", ref: "gnd", x: 0, y: 0 }],
      wires: [{ from: "P_vin.1", to: "R1.1" }], // gnd never wired
    },
  });
  const w = validateBlock(b).find((i) => i.code === "terminal/unconnected");
  assert.equal(w!.at, "gnd");
});

test("a part shorted across itself is an error", () => {
  const b = base({
    layout: {
      symbols: [{ id: "R1", type: "resistor", ref: "R1", x: 0, y: 0 }, { id: "P_vin", type: "port", ref: "vin", x: 0, y: 0 }, { id: "P_gnd", type: "port", ref: "gnd", x: 0, y: 0 }],
      wires: [{ from: "R1.1", to: "R1.2" }, { from: "R1.1", to: "P_vin.1" }, { from: "R1.2", to: "P_gnd.1" }],
    },
  });
  assert.ok(codes(b).includes("net/short"));
});
