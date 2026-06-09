// Spec-search: "18 V → 5 V at 3 A" → the blocks that can do it, with the WHY of every match
// spelled out. This is the vendor-neutral WEBENCH answer (registry.md §Discovery) — it matches on
// DECLARED specs only (no inference), and every verdict carries the declared numbers it came from,
// so a result is checkable, never magic. Powers /blocks search, the palette filter, and Sparky's
// find_blocks tool.
import type { Block, Range } from "./types.js";

export interface SpecQuery {
  vin?: number;   // the supply you HAVE (V)
  vout?: number;  // the rail you WANT (V)
  iout?: number;  // the current you need (A)
  text: string[]; // leftover words → name/category match
}

export interface SpecMatch {
  block: Block;
  score: number;
  /** Plain-language, per-criterion verdicts built from the block's declared numbers —
   *  e.g. "input 18 V ✓ (takes 9–18 V)", "output 5 V ✓", "3 A ✓ (rated 3 A — no headroom)". */
  why: string[];
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const asRange = (v: Range | number | string | undefined): Range | undefined =>
  typeof v === "number" ? { value: v } : v && typeof v === "object" ? v : undefined;
const fmtR = (r: Range): string =>
  r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ""}`
  : `${r.min ?? "?"}–${r.max ?? "?"}${r.unit ? ` ${r.unit}` : ""}`;

/** Parse a free-text spec query. Understands "18V → 5V at 3A", "12 to 3.3 v", "5v 2a buck",
 *  "9-18V in, 5V out". Numbers with V before an arrow/"to" are the input; after, the output;
 *  a lone voltage is the output you want; amps are the load current. Unrecognized words become
 *  text terms (matched against block names/categories). */
export function parseSpecQuery(q: string): SpecQuery {
  const out: SpecQuery = { text: [] };
  let s = q.toLowerCase().replace(/(\d)\s*(v|a|ma|amps?|volts?)\b/g, "$1$2"); // glue units to their number

  // amps anywhere: "at 3a" / "3a" / "500ma" → iout
  s = s.replace(/(?:at|@)?\s*(\d+(?:\.\d+)?)(ma|a|amps?)\b/g, (_, n, u) => {
    out.iout = parseFloat(n) * (u === "ma" ? 0.001 : 1);
    return " ";
  });

  // "X → Y" / "X to Y" / "X in Y out" voltage pair (either side may carry a v suffix or a range "9-18")
  const V = String.raw`(\d+(?:\.\d+)?)(?:v|volts?)?`;
  const pair = s.match(new RegExp(String.raw`(?:${V}\s*(?:-|–)\s*)?${V}\s*(?:→|->|to)\s*${V}`));
  if (pair) {
    out.vin = parseFloat(pair[2]); // upper input bound when a range was given, else the single value
    out.vout = parseFloat(pair[3]);
    s = s.replace(pair[0], " ");
  } else {
    const inM = s.match(new RegExp(String.raw`${V}(?:v|volts?)?\s*(?:in|input|supply|from)\b`));
    const outM = s.match(new RegExp(String.raw`${V}(?:v|volts?)?\s*(?:out|output|rail)\b`));
    if (inM) { out.vin = parseFloat(inM[1]); s = s.replace(inM[0], " "); }
    if (outM) { out.vout = parseFloat(outM[1]); s = s.replace(outM[0], " "); }
    if (!inM && !outM) {
      const lone = s.match(/(\d+(?:\.\d+)?)v\b/);
      if (lone) { out.vout = parseFloat(lone[1]); s = s.replace(lone[0], " "); } // a lone voltage = the rail you want
    }
  }

  out.text = s.split(/[^a-z0-9.+]+/).filter((w) => w && !/^\d/.test(w));
  return out;
}

/** Match blocks against a spec query, best first. Matching is on DECLARED spec fields only:
 *  vin must sit inside the block's declared input range, vout must equal the declared output
 *  (±5%), iout must not exceed the declared max. A missing declaration can't pass silently —
 *  it's reported as "not declared" (lint.md principle 4) and costs score. */
export function findBlocks(blocks: Block[], query: SpecQuery): SpecMatch[] {
  const out: SpecMatch[] = [];
  for (const b of blocks) {
    const why: string[] = [];
    let score = 0, hard = false; // hard = a criterion the block definitively fails

    const vin = asRange(b.spec?.vin), vout = asRange(b.spec?.vout), iout = asRange(b.spec?.iout_max);

    if (query.vin != null) {
      if (vin) {
        const lo = vin.min ?? vin.value, hi = vin.max ?? vin.value;
        if (lo != null && hi != null && query.vin >= lo && query.vin <= hi) { score += 3; why.push(`input ${query.vin} V ✓ (takes ${fmtR(vin)})`); }
        else { hard = true; why.push(`input ${query.vin} V ✗ (takes ${fmtR(vin)})`); }
      } else why.push(`input range not declared — can't check ${query.vin} V`);
    }
    if (query.vout != null) {
      const v = num(vout?.value);
      if (v != null) {
        if (Math.abs(v - query.vout) <= query.vout * 0.05) { score += 3; why.push(`output ${v} V ✓`); }
        else { hard = true; why.push(`output is ${v} V, not ${query.vout} V ✗`); }
      } else why.push(`output not declared — can't check ${query.vout} V`);
    }
    if (query.iout != null) {
      const cap = num(iout?.value) ?? num(iout?.max);
      if (cap != null) {
        if (cap >= query.iout) {
          score += 2;
          const head = cap - query.iout;
          why.push(`${query.iout} A ✓ (rated ${cap} A${head <= cap * 0.15 ? " — thin headroom" : ""})`);
        } else { hard = true; why.push(`needs ${query.iout} A but rated ${cap} A ✗`); }
      } else why.push(`max current not declared — can't check ${query.iout} A`);
    }
    for (const t of query.text) {
      const hay = `${b.name} ${b.category ?? ""} ${b.id} ${b.topology ?? ""}`.toLowerCase();
      if (hay.includes(t)) { score += 1; why.push(`matches "${t}"`); }
    }

    if (hard || score <= 0) continue;
    out.push({ block: b, score, why });
  }
  return out.sort((a, b) => b.score - a.score || a.block.name.localeCompare(b.block.name));
}

/** One-call convenience: parse the text and match. */
export function searchBlocks(blocks: Block[], q: string): SpecMatch[] {
  return findBlocks(blocks, parseSpecQuery(q));
}
