import { DiscreteModal } from "@electrace/ui";
import { DISCRETE_LIBRARY } from "@electrace/core";

/** "Break into discrete" — a real entry from @electrace/core's DISCRETE_LIBRARY (the 3.3V LDO drawn
 *  as a zener reference + NPN pass element): the rendered schematic, the how-it-works note, and the
 *  parts table. */
export const Ldo3v3 = () => (
  <div data-theme="mid" style={{ background: "var(--color-bg2)" }}>
    <DiscreteModal eq={DISCRETE_LIBRARY["ldo-3v3"]} partRef="U1" onClose={() => {}} />
  </div>
);
