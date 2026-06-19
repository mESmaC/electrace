import { rmax } from "./types.js";
import type { ResolvedDesign } from "./types.js";

/** Per-rail budget: source capability vs. consumer draw, current-first (watts as a
 *  rollup). Budgets are PER RAIL — watts aren't fungible across voltage domains. */
export interface RailBudget {
  net: string;
  type: "power" | "rail";
  voltage?: number;     // representative (worst-case) volts
  capacityA?: number;   // the source's declared Iout (the ceiling)
  drawA: number;        // Σ declared sink current
  headroomA?: number;
  usedPct?: number;
  watts?: number;       // drawA × voltage (a rollup, not the check)
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A budget per power/rail net — a presentation of the same numbers the current rules
 *  check. Reuses the resolved graph (incl. propagated regulator input draws). */
export function railBudgets(rd: ResolvedDesign): RailBudget[] {
  return rd.nets
    .filter((n) => n.type === "power" || n.type === "rail")
    .map((n) => {
      // capacity = Σ every source that declares a rating (paralleled supplies add up), not just the first
      const rated = n.sources.map((s) => rmax(s.def.i)).filter((c): c is number => c != null);
      const capacityA = rated.length ? rated.reduce((a, c) => a + c, 0) : undefined;
      const drawA = round(n.sinks.reduce((a, s) => a + (rmax(s.current) ?? 0), 0));
      const voltage = rmax(n.voltage);
      return {
        net: n.id,
        type: n.type as "power" | "rail",
        voltage,
        capacityA,
        drawA,
        headroomA: capacityA != null ? round(capacityA - drawA) : undefined,
        usedPct: capacityA ? Math.round((drawA / capacityA) * 100) : undefined,
        watts: voltage != null ? round(drawA * voltage) : undefined,
      };
    });
}
