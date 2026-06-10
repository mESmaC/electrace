# Reverse-Polarity Protection

One transistor that makes "I plugged the battery in backwards" a non-event instead of a
dead board — without the ~0.6 V (and the heat) a series diode would cost you.

The trick is a P-channel MOSFET **used backwards from how you'd expect**, with the input on
its **drain**:

1. **Power-up (correct polarity):** current can't flow through the channel yet (it's off),
   but the FET's built-in **body diode** points the right way — the output rises to about
   Vin − 0.6 V.
2. **The channel takes over:** the source is now near Vin and the gate is held at ground by
   **R1**, so Vgs ≈ −Vin — far past the turn-on threshold. The channel switches fully on and
   *shorts out its own body diode*. Drop across the block: just Rds(on) × I, millivolts.
3. **Reversed input:** the body diode points the wrong way (blocked), and the source never
   rises so Vgs stays ≈ 0 (channel off). Nothing conducts. Your board never knows.

**D1** (12 V zener) clamps the gate-source voltage on higher-voltage rails — gate oxide
typically dies at ±20 V, and without the clamp a 24 V input would apply all 24 V across it.

**Exposes:** `vin` (3–24 V), `vout` (same rail, protected, up to 5 A), `gnd`.

> ⚠ The one wiring mistake that ruins it: input on the **source** instead of the drain.
> It appears to work on the bench — until someone actually reverses the supply and the body
> diode conducts the wrong way. Drain in, source out, gate to ground.
