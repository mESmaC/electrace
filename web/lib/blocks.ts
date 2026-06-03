import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Block, Design } from "@electrace/core";

// The seed corpus lives in the core package (sibling folder).
const BLOCKS_DIR = join(process.cwd(), "..", "electrace", "blocks");
const EXAMPLES_DIR = join(process.cwd(), "..", "electrace", "examples");

/** Load an example design by name (e.g. "buck-supply"). */
export function loadDesign(name: string): Design {
  return JSON.parse(readFileSync(join(EXAMPLES_DIR, `${name}.design.json`), "utf8")) as Design;
}

/** All seed blocks keyed by "id@version" — ready for analyze(). */
export function blockLibrary(): Record<string, Block> {
  return Object.fromEntries(listBlocks().map((b) => [`${b.block.id}@${b.block.version}`, b.block]));
}

export interface LoadedBlock {
  slug: string;
  block: Block;
  explain: string;
}

export function listBlocks(): LoadedBlock[] {
  return readdirSync(BLOCKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadBlock(d.name))
    .sort((a, b) => a.block.name.localeCompare(b.block.name));
}

export function loadBlock(slug: string): LoadedBlock {
  const dir = join(BLOCKS_DIR, slug);
  const block = parseYaml(readFileSync(join(dir, "block.yaml"), "utf8")) as Block;
  let explain = "";
  try {
    explain = readFileSync(join(dir, "explain.md"), "utf8");
  } catch {
    /* explain.md is optional */
  }
  return { slug, block, explain };
}

/** Format a declared spec/terminal value (number | string | Range) for display. */
export function fmtSpec(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const r = v as { value?: number; min?: number; max?: number; unit?: string };
    const u = r.unit ? ` ${r.unit}` : "";
    if (r.value != null) return `${r.value}${u}`;
    if (r.min != null || r.max != null) return `${r.min ?? "?"}–${r.max ?? "?"}${u}`;
  }
  return "";
}
