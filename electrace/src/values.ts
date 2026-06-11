// Component-value math for the schematic linter: parse EE value strings, combine them, and format
// the result back. Pure + unit-tested — the analysis surfaces these numbers, so they must be right.

/** Parse a resistance/value string to a base-unit number (ohms, farads, …), or null if unparseable.
 *  Handles plain ("330", "4.7k", "1M"), RKM/"R-notation" ("4k7" = 4.7k, "1R5" = 1.5, "2M2" = 2.2M),
 *  and a trailing unit/Ω. Multiplier case matters: M = mega, m = milli. */
export function parseValue(raw: string | number | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null; // YAML can hand us bare numbers
  const s = raw.trim().replace(/(ohms?|Ω|F|farads?|H|henr(y|ies))\s*$/i, "").trim();
  if (!s) return null;
  // <digits> <multiplier letter> <digits>  — the letter may be the decimal point (R-notation)
  const m = s.match(/^(\d*\.?\d*)\s*([pnuµμmkKMgGrR])?\s*(\d*)$/);
  if (!m) return null;
  const [, head, suf, tail] = m;
  const MULT: Record<string, number> = {
    p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, μ: 1e-6, m: 1e-3,
    r: 1, R: 1, k: 1e3, K: 1e3, M: 1e6, g: 1e9, G: 1e9,
  };
  const mult = suf ? MULT[suf] ?? 1 : 1;
  const num = tail ? parseFloat(`${head || "0"}.${tail}`) : parseFloat(head); // "4k7" → 4.7
  if (!Number.isFinite(num)) return null;
  return num * mult;
}

/** Equivalent resistance of resistors in parallel: 1/Req = Σ 1/Ri. (Also: capacitors in series.) */
export function parallelResistance(ohms: number[]): number {
  const valid = ohms.filter((r) => r > 0);
  if (!valid.length) return NaN;
  return 1 / valid.reduce((sum, r) => sum + 1 / r, 0);
}

/** Sum (series resistors / parallel capacitors). */
export function seriesSum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Format a base-unit number back to an EE string, e.g. 4700 → "4.7k", 1_500_000 → "1.5M", 0.5 → "500m". */
export function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const sig = (n: number) => {
    const r = Number(n.toPrecision(3));
    return String(r);
  };
  if (a === 0) return "0";
  if (a >= 1e9) return `${sign}${sig(a / 1e9)}G`;
  if (a >= 1e6) return `${sign}${sig(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}${sig(a / 1e3)}k`;
  if (a >= 1) return `${sign}${sig(a)}`;
  if (a >= 1e-3) return `${sign}${sig(a * 1e3)}m`;
  if (a >= 1e-6) return `${sign}${sig(a * 1e6)}µ`;
  if (a >= 1e-9) return `${sign}${sig(a * 1e9)}n`;
  return `${sign}${sig(a * 1e12)}p`;
}
