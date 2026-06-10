# Comparator (with hysteresis)

Turns a slow, analog, possibly-noisy voltage into a clean digital yes/no — without the
chattering that a bare comparator produces at the threshold.

- **U1** — the comparator: output low when `in−` is above `in+`, released (pulled high by
  R4) otherwise. **R1/R2** park the reference at VCC/2.
- **R4** — not optional: LM393-class outputs are **open-collector**. They can pull low and
  nothing else. The number-one comparator "bug" is a missing pull-up.
- **R3 + Rin — the hysteresis**, and the actual point of this block. When the output
  flips, R3 nudges `in+` slightly in the output's favour, so the trip point *moves away*
  from the signal that just crossed it. A noisy input now has to genuinely reverse by the
  hysteresis width (~1% of VCC here) to flip back — one crossing, one edge. This is a
  Schmitt trigger, built from parts you can point at.

Without Rin there is nothing for R3 to push against — the source would hold `in+` rigid
and the feedback would do nothing. That's why the input resistor is part of the trick.

**Exposes:** `vcc`, `in` (analog), `out` (clean digital, active-low sense), `gnd`.

> ⚠ A comparator is not an op-amp, even though the symbol looks the same: op-amps are
> built to be *linear* with feedback and are often slow/unstable as comparators; comparators
> are built to *slam*. The classic swap-them mistake works on the bench and oscillates in
> the field.
