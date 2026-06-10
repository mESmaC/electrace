# MOSFET Switch (low-side)

THE answer to "how do I control a 12 V thing from a 3.3 V pin." The GPIO moves the gate;
the FET does the heavy lifting; the load sits between your supply and `sw`.

- **Q1** — a **logic-level** N-channel MOSFET on the load's *low side* (between load and
  ground). Gate high → channel on → current flows. The gate draws essentially zero steady
  current, which is the whole magic: microamps of GPIO effort controlling amps of load.
- **R1 (100 Ω)** — the gate isn't free to *switch*: it's a small capacitor, and charging it
  instantly rings. The series resistor rounds that edge off.
- **R2 (100 k)** — during reset/boot your GPIO floats. Without the pulldown the gate drifts,
  and a drifting gate means a half-on FET warming itself across your load. This resistor
  makes "undefined" mean "off."

Why low-side? It's the simple, robust topology: the FET's source sits at ground, so your
3.3 V gate drive is measured against 0 V — full enhancement, no level-shifting tricks. The
tradeoff: the load's "ground" terminal isn't true ground while off. When that matters
(shared-ground sensors), you need the high-side version.

**Exposes:** `ctrl` (GPIO), `sw` (connect the load's LOW side here; load's high side goes
to its supply), `gnd`.

> ⚠ The two classic failures: a non-logic-level FET (half-on at 3.3 V → cooks at load
> current), and an inductive load with no flyback diode (turn-off kick avalanches the FET).
> The checks flag the second when the load declares itself inductive.
