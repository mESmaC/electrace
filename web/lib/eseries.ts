// E-series standard values + formatting for the calculator pages.
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
const E12 = E24.filter((_, i) => i % 2 === 0);

/** Nearest standard value at or above `v` ("up" — safe default for LED resistors), below, or closest. */
export function nearestE(v: number, series: "E12" | "E24" = "E24", mode: "closest" | "up" = "closest"): number {
  if (!isFinite(v) || v <= 0) return NaN;
  const vals = series === "E12" ? E12 : E24;
  const exp = Math.floor(Math.log10(v));
  const cands: number[] = [];
  for (const e of [exp - 1, exp, exp + 1]) for (const m of vals) cands.push(m * 10 ** e);
  const pool = mode === "up" ? cands.filter((c) => c >= v - 1e-9) : cands;
  return pool.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), pool[0]);
}

export function fmtOhms(v: number): string {
  if (!isFinite(v)) return "—";
  if (v >= 1e6) return `${+(v / 1e6).toFixed(2)} MΩ`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(2)} kΩ`;
  return `${+v.toFixed(1)} Ω`;
}
export function fmtCap(pF: number): string {
  if (!isFinite(pF)) return "—";
  if (pF >= 1e6) return `${+(pF / 1e6).toFixed(2)} µF`;
  if (pF >= 1e3) return `${+(pF / 1e3).toFixed(2)} nF`;
  return `${+pF.toFixed(1)} pF`;
}
