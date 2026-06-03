# LDO Regulator

A **low-dropout linear regulator** that holds the output at a fixed **3.3 V**. Unlike a buck,
it doesn't switch — it acts like a smart variable resistor, burning the excess voltage as
heat. That makes it quiet and cheap, but inefficient when the input is much higher than the
output.

- **U1** — the regulator. Senses its own output and adjusts the pass element to keep 3.3 V.
- **Cin / Cout** — required decoupling. Cout in particular sets the control-loop stability;
  most LDOs specify a minimum value and ESR range.

**Exposes:** `vin` (4.5–12 V), `vout` (3.3 V, up to 0.5 A), and `gnd`.

> Efficiency ≈ Vout / Vin — so at 12 V in, only ~28 % of the power reaches the load and the
> rest is heat: `P_heat ≈ (Vin − Vout) × Iout`. Great for low currents from a near rail,
> wasteful for big steps — reach for the buck instead.
