// Transport-agnostic tool handlers for the Electrace context server.
// Each export is a plain async function over the project (the blocks dir + the core engine),
// so they can be smoke-tested directly with node and wired into MCP (server.mjs) unchanged.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  SYMBOL_CATALOG, PACKAGES, validateBlock, deriveBlockSchematic,
  blockContext, blockBrief, designContext,
} from "../electrace/dist/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BLOCKS_DIR = path.join(HERE, "..", "electrace", "blocks");
const EXAMPLES_DIR = path.join(HERE, "..", "electrace", "examples");

const readBlock = (slug) => {
  const dir = path.join(BLOCKS_DIR, slug);
  const block = YAML.parse(fs.readFileSync(path.join(dir, "block.yaml"), "utf8"));
  let explain = "";
  try { explain = fs.readFileSync(path.join(dir, "explain.md"), "utf8"); } catch { /* optional */ }
  return { slug, block, explain };
};

const allBlocks = () =>
  fs.readdirSync(BLOCKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => readBlock(d.name));

/** Library of blocks keyed "id@version" — for analyze/designContext. */
const blockLibrary = () => new Map(allBlocks().map(({ block }) => [`${block.id}@${block.version}`, block]));

// ── tools ───────────────────────────────────────────────────────────────────

export function listBlocks() {
  return allBlocks().map(({ slug, block }) => ({ slug, ...blockBrief(block) }));
}

export function getCatalog() {
  return { symbols: SYMBOL_CATALOG, packages: PACKAGES };
}

export function getBlock({ id }) {
  const found = allBlocks().find(({ slug, block }) => block.id === id || slug === id || `${block.id}@${block.version}` === id);
  if (!found) throw new Error(`No block "${id}". Try one of: ${allBlocks().map((b) => b.block.id).join(", ")}`);
  return blockContext(found.block, found.explain);
}

/** Validate a block manifest (YAML or object). Derives the schematic from its layout first
 *  so the checks see the connectivity that will actually be analysed. */
export function validateBlockManifest({ manifest }) {
  const block = typeof manifest === "string" ? YAML.parse(manifest) : manifest;
  if (block.layout && !block.schematic) block.schematic = deriveBlockSchematic(block.layout);
  const issues = validateBlock(block);
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}

/** Analyze a design (an example name, or a full design object/JSON) against the block library. */
export function analyzeDesign({ design }) {
  let d = design;
  if (typeof design === "string") {
    if (design.trim().startsWith("{")) d = JSON.parse(design);
    else d = JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR, `${design}.design.json`), "utf8"));
  }
  return designContext(d, blockLibrary());
}

/** Author (or overwrite) a block on disk — but only if it validates with no errors. */
export function authorBlock({ slug, manifest, explain }) {
  const block = typeof manifest === "string" ? YAML.parse(manifest) : manifest;
  if (block.layout && !block.schematic) block.schematic = deriveBlockSchematic(block.layout);
  const issues = validateBlock(block);
  if (issues.some((i) => i.severity === "error")) {
    return { written: false, issues, message: "Not written — fix the errors first." };
  }
  const dir = path.join(BLOCKS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "block.yaml"), typeof manifest === "string" ? manifest : YAML.stringify(manifest));
  if (explain) fs.writeFileSync(path.join(dir, "explain.md"), explain);
  return { written: true, path: path.relative(path.join(HERE, ".."), dir), issues };
}
