// Parse a KiCad footprint (.kicad_mod, an S-expression) into our Footprint land-pattern model, so users
// can import real, datasheet-accurate footprints (single files or whole .pretty libraries) instead of the
// generated approximations. Handles `(footprint …)` and the legacy `(module …)`, SMD + through-hole pads,
// and rect/roundrect/circle/oval/trapezoid shapes. Non-pad geometry (silk/courtyard/3d) is ignored.
import type { Footprint, LandPad } from "./footprints.js";

type SNode = string | SNode[];

/** Tokenize an S-expression: parens, quoted strings (quotes stripped), and bare atoms. */
function tokenize(s: string): string[] {
  const toks: string[] = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "(" || c === ")") { toks.push(c); i++; }
    else if (c === '"') {
      let j = i + 1, str = "";
      while (j < s.length && s[j] !== '"') { if (s[j] === "\\") { str += s[j + 1] ?? ""; j += 2; } else { str += s[j]; j++; } }
      toks.push(str); i = j + 1;
    } else if (/\s/.test(c)) i++;
    else { let j = i; while (j < s.length && !/[\s()"]/.test(s[j])) j++; toks.push(s.slice(i, j)); i = j; }
  }
  return toks;
}

function parseSexpr(text: string): SNode | null {
  const toks = tokenize(text);
  let i = 0;
  const node = (): SNode => {
    if (toks[i] === "(") {
      i++;
      const list: SNode[] = [];
      while (i < toks.length && toks[i] !== ")") list.push(node());
      i++; // consume ")"
      return list;
    }
    return toks[i++];
  };
  // skip to the first list (some files start with a comment-ish header or whitespace)
  while (i < toks.length && toks[i] !== "(") i++;
  return i < toks.length ? node() : null;
}

const head = (n: SNode): string | null => (Array.isArray(n) && typeof n[0] === "string" ? n[0] : null);
const sub = (n: SNode[], h: string): SNode[] | null => (n.find((c) => Array.isArray(c) && c[0] === h) as SNode[] | undefined) ?? null;
const num = (v: SNode | undefined): number => { const x = parseFloat(String(v)); return Number.isFinite(x) ? x : 0; };

export interface ParsedFootprint { name: string; footprint: Footprint }

/** Parse a single .kicad_mod string. Returns null if it isn't a recognizable footprint. */
export function parseKicadFootprint(text: string): ParsedFootprint | null {
  const root = parseSexpr(text);
  if (!Array.isArray(root)) return null;
  const kind0 = head(root);
  if (kind0 !== "footprint" && kind0 !== "module") return null;
  const name = (typeof root[1] === "string" ? root[1] : "footprint") || "footprint";

  const pads: LandPad[] = [];
  let anyTht = false;
  for (const c of root) {
    if (head(c) !== "pad") continue;
    const p = c as SNode[];
    const padNum = String(p[1] ?? "");
    const type = String(p[2] ?? "");        // smd | thru_hole | np_thru_hole | connect
    const shape = String(p[3] ?? "rect");   // rect | roundrect | circle | oval | trapezoid | custom
    const at = sub(p, "at"), size = sub(p, "size"), drill = sub(p, "drill"), rr = sub(p, "roundrect_rratio");
    if (!at || !size) continue;
    const rot = ((num(at[3]) % 360) + 360) % 360;
    let w = num(size[1]), h = num(size[2] ?? size[1]);
    if (rot === 90 || rot === 270) [w, h] = [h, w]; // rotated rectangular pad ≈ swapped extents
    const tht = type.includes("thru");
    anyTht = anyTht || tht;
    const round = shape === "circle" || shape === "oval" ? 0.5 : shape === "roundrect" ? (rr ? num(rr[1]) : 0.25) : undefined;
    const drillD = tht && drill ? num(String(drill[1]) === "oval" ? drill[2] : drill[1]) : undefined;
    pads.push({ num: padNum, x: num(at[1]), y: num(at[2]), w, h, ...(round != null ? { round } : {}), ...(drillD ? { drill: drillD } : {}) });
  }
  if (!pads.length) return null;

  // re-centre on the pad bounding box (our generated footprints are centred on the origin too), then size
  const xs = pads.flatMap((p) => [p.x - p.w / 2, p.x + p.w / 2]);
  const ys = pads.flatMap((p) => [p.y - p.h / 2, p.y + p.h / 2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  for (const p of pads) { p.x = +(p.x - cx).toFixed(4); p.y = +(p.y - cy).toFixed(4); }

  const id = name.replace(/[^\w.-]+/g, "_");
  return { name, footprint: { id, kind: anyTht ? "tht" : "smd", pads, w: +(maxX - minX + 1).toFixed(3), h: +(maxY - minY + 1).toFixed(3) } };
}
