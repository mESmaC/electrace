// Exercise every tool handler directly (no MCP transport) — a quick correctness check.
import * as t from "./tools.mjs";

console.log("list_blocks:", t.listBlocks().map((b) => b.id).join(", "));
console.log("catalog symbols:", Object.keys(t.getCatalog().symbols).length, "| packages:", t.getCatalog().packages.length);

const led = t.getBlock({ id: "@electrace/led-indicator" });
console.log("get_block led:", led.summary, "| nets:", led.nets?.map((n) => n.name).join(","));

const bad = t.validateBlockManifest({
  manifest: {
    id: "@t/x", name: "X", version: "1.0.0",
    terminals: [{ id: "a", role: "in", type: "signal" }, { id: "gnd", role: "in", type: "gnd" }],
    layout: { symbols: [{ id: "R1", type: "resistor", ref: "R1", x: 0, y: 0 }, { id: "Pa", type: "port", ref: "a", x: 0, y: 0 }], wires: [{ from: "R1.9", to: "Pa.1" }] },
  },
});
console.log("validate (bad):", bad.ok, "→", bad.issues.map((i) => `${i.severity}:${i.code}`).join(", "));

const analysis = t.analyzeDesign({ design: "buck-supply" });
console.log("analyze buck-supply:", analysis.instances.length, "instances,", analysis.checks.length, "checks,", analysis.bom.length, "bom rows");
console.log("\n--- all handlers ran ---");
