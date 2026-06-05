// User-defined blocks, stored client-side (no backend yet). They live in localStorage and are
// merged into the design editor's palette alongside the build-time library blocks. A user block's
// internal schematic is drawn in the block editor like any other (saved under electrace:blocksch:<id>).
import type { Block, Terminal } from "@electrace/core";

const KEY = "electrace:userblocks";

/** All user blocks keyed by "id@version" (same shape as the library map). */
export function getUserBlocks(): Record<string, Block> {
  if (typeof window === "undefined") return {};
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Block[];
    return Object.fromEntries(arr.filter((b) => b && b.id).map((b) => [`${b.id}@${b.version}`, b]));
  } catch { return {}; }
}

function writeAll(map: Record<string, Block>): void {
  try { localStorage.setItem(KEY, JSON.stringify(Object.values(map))); } catch { /* ignore */ }
}

export function saveUserBlock(b: Block): void {
  const map = getUserBlocks();
  map[`${b.id}@${b.version}`] = b;
  writeAll(map);
}

export function deleteUserBlock(key: string): void {
  const map = getUserBlocks();
  const b = map[key];
  delete map[key];
  writeAll(map);
  if (b) { try { localStorage.removeItem(`electrace:blocksch:${b.id}`); } catch { /* ignore */ } } // drop its schematic draft too
}

export const isUserBlock = (key: string): boolean => key.startsWith("@user/");

/** Build a fresh user block from the create form, with a unique slugged id. */
export function makeUserBlock(input: { name: string; glyph?: string; category?: string; terminals: Terminal[] }): Block {
  const base = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "block";
  const taken = new Set(Object.values(getUserBlocks()).map((b) => b.id));
  let slug = base, n = 2;
  while (taken.has(`@user/${slug}`)) slug = `${base}-${n++}`;
  return {
    id: `@user/${slug}`,
    name: input.name.trim() || "Custom block",
    version: "1.0.0",
    category: input.category?.trim() || "custom",
    glyph: input.glyph?.trim() || "▦",
    terminals: input.terminals,
  };
}
