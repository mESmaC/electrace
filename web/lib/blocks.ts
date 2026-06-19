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

/** All seed blocks keyed by "id@version" — ready for analyze(). Includes hidden/staging blocks so a
 *  design or Short that references one still RESOLVES; only the PUBLIC listing (listBlocks) hides them. */
export function blockLibrary(): Record<string, Block> {
  return Object.fromEntries(allLoadedBlocks().map((b) => [`${b.block.id}@${b.block.version}`, b.block]));
}

export interface LoadedBlock {
  slug: string;
  block: Block;
  explain: string;
}

function allLoadedBlocks(): LoadedBlock[] {
  return readdirSync(BLOCKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadBlock(d.name))
    .sort((a, b) => a.block.name.localeCompare(b.block.name));
}

/** The PUBLIC block list — the /blocks grid, sitemap, and SEO surface. Excludes any block marked
 *  `hidden: true` in its block.yaml (staging/demo blocks built for a Short, not a library part), so
 *  they don't read as half-finished or get indexed as thin content. */
export function listBlocks(): LoadedBlock[] {
  return allLoadedBlocks().filter((b) => !(b.block as { hidden?: boolean }).hidden);
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
