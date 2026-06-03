// Loads the seed blocks + the sample design, validates against the schema,
// then runs the core (resolve → lint → BOM) and prints the result.
// Run with: npm run demo
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import Ajv from "ajv";
import { analyze, flatten, toKicadNetlist } from "../src/index.js";
import type { Block, Design } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const ajv = new Ajv({ allErrors: true, strict: false });
const validateBlock = ajv.compile(JSON.parse(read("schema/block.schema.json")));
const validateDesign = ajv.compile(JSON.parse(read("schema/design.schema.json")));

// ── load + validate the seed blocks ────────────────────────────────────────
const blocks = new Map<string, Block>();
const blockDirs = readdirSync(join(root, "blocks"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const dir of blockDirs) {
  const block = parseYaml(read(`blocks/${dir}/block.yaml`)) as Block;
  if (!validateBlock(block)) {
    console.warn(`⚠  ${dir}/block.yaml failed schema validation:`, validateBlock.errors);
  }
  blocks.set(`${block.id}@${block.version}`, block);
  console.log(`  loaded ${block.id}@${block.version}  (${block.name})`);
}

// ── load + validate the design ──────────────────────────────────────────────
const design = JSON.parse(read("examples/buck-supply.design.json")) as Design;
if (!validateDesign(design)) {
  console.warn("⚠  design failed schema validation:", validateDesign.errors);
}

// ── analyze ──────────────────────────────────────────────────────────────────
const { resolved, power, findings, bom } = analyze(design, blocks);

const ICON: Record<string, string> = {
  error: "✕", warn: "▲", recommendation: "💡", info: "ℹ", unknown: "○",
};

console.log(`\n── Design: ${design.name} (${design.visibility}) ──`);
console.log(`${resolved.instances.length} blocks · ${resolved.nets.length} nets\n`);

console.log("Nets:");
for (const n of resolved.nets) {
  const v = n.voltage?.value ?? (n.voltage?.max != null ? `${n.voltage.min ?? "?"}–${n.voltage.max}` : "");
  console.log(`  ${n.id.padEnd(8)} ${n.type.padEnd(7)} ${v ? v + " V" : ""}${n.open ? "   (open)" : ""}`);
}

const tp = Object.entries(power.transforms);
if (tp.length) {
  console.log("\nPower (propagated backward through regulators):");
  for (const [ref, p] of tp)
    console.log(`  ${ref}: ${p.iOut} A × ${p.vOut} V = ${p.pOut} W out → ${p.pIn} W in → draws ~${p.iIn} A from ${p.vIn} V`);
}

console.log(`\nLint — ${findings.length} finding(s):`);
if (findings.length === 0) console.log("  (clean)");
for (const f of findings) {
  console.log(`  ${ICON[f.severity] ?? "•"} [${f.severity}] ${f.message}`);
  if (f.derivation) console.log(`      ${f.derivation}`);
}

const flat = flatten(resolved);
console.log(`\nFlat schematic — ${flat.parts.length} parts, ${flat.nets.length} nets:`);
for (const net of flat.nets) console.log(`  ${net.name.padEnd(14)} ${net.pins.join(", ")}`);

console.log(`\nBOM — ${bom.length} line(s):`);
for (const r of bom) {
  console.log(`  ${String(r.qty).padStart(2)}× ${(r.value ?? r.part ?? r.type).padEnd(12)} ${r.type.padEnd(10)} ${r.refs.join(", ")}`);
}

const net = toKicadNetlist(flat, { source: `${design.id}.design.json`, date: new Date().toISOString() });
writeFileSync(join(root, "examples/buck-supply.net"), net);
console.log(`\nKiCad netlist — wrote examples/buck-supply.net (${net.split("\n").length} lines). First lines:`);
console.log(net.split("\n").slice(0, 16).map((l) => "  " + l).join("\n"));
console.log();
