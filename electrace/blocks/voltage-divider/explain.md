# Voltage Divider

Two resistors that turn a big voltage into a smaller, *proportional* one. The most-used
two-component circuit in electronics — and the one whose two failure modes bite everyone
exactly once.

The whole idea: the same current flows through both resistors, so the voltage splits in
proportion to the resistances:

`Vout = Vin × R2 / (R1 + R2)`

Equal resistors → exactly half. 12 V battery into a 3.3 V ADC? `R1 = 27k, R2 = 10k` gives
you 3.24 V at full charge.

What it's for: **measuring** things (battery monitors, sensor scaling, feedback pins on
regulators) and **biasing** things. What it's *not* for: power. It can only deliver
microamps before the ratio collapses.

The two gotchas, both about the same number — the **output impedance** `R1∥R2`:

1. **Loading.** Anything you connect to `vout` is electrically *part of* the divider.
   A 10 k load on this 5 k-output divider shifts the ratio from 0.50 to 0.40 — your reading
   is just wrong. Keep loads ≥10× the output impedance, or buffer with an op-amp follower.
2. **The current never stops.** `Vin²/(R1+R2)` flows 24/7 — the silent battery drain in
   "why does my project die in a week" designs. Scale the resistors up (100 k–1 M) for
   battery monitors; just know that high-impedance dividers are slower and noisier into
   ADC pins.

**Exposes:** `vin`, `vout` (= vin × ratio), `gnd`.

> ⚠ An ADC input is not a perfect voltmeter — most want to be driven from under ~10 kΩ.
> A 1 MΩ battery-saver divider straight into an ADC reads low and jumps around; add a small
> capacitor on `vout` or a buffer.
