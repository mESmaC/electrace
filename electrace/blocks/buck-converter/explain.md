# Buck Converter

Steps a higher DC input (9–18 V) down to a steady **5 V at up to 3 A**, efficiently. Unlike a
linear regulator (which burns the extra voltage as heat), a buck switches the input through an
inductor, so ~85 % of the input power reaches the load.

- **U1** — the switching controller. Compares the feedback voltage to an internal reference
  and switches `SW` to hold the output at 5 V.
- **L1** — the inductor, storing and releasing energy each cycle. This is the mechanism that
  makes a buck efficient.
- **Cin / Cout** — input bulk + output smoothing/stability.
- **R1 / R2** — the feedback divider. The ratio sets the output voltage:
  `Vout = Vref × (1 + R1/R2)` → `0.8 V × (1 + 39k/10k) ≈ 5 V`.

**Exposes:** `vin` (9–18 V), `vout` (+5 V, 3 A), and grounds.

> ⚠ Cin is rated 25 V — keep the input below ~20 V or it's the first thing to let go.
