# Op-Amp Amplifier (non-inverting)

Makes a small signal bigger — ×11 here — without loading down whatever produced it.
This is *the* op-amp circuit: two resistors turn a wildly imprecise amplifier into a
precise one.

- **U1** — the op-amp. It does exactly one thing: drives its output up or down until
  its two inputs match. It has enormous gain (≈10⁶) and terrible precision — and
  neither matters, because of the feedback.
- **R1 + R2 — the gain.** They divide the output by 11 and show that to `in−`. For
  the inputs to match, the output must sit at **11× the input**. Gain = 1 + R1/R2,
  set by a resistor *ratio* — which is why 1% resistors give you a 1% amplifier from
  an op-amp whose own gain varies 10:1 between parts.
- The input goes to `in+` directly, so the source sees almost no load
  (gigaohms) — this circuit amplifies *and* buffers.

Want a different gain? Change the ratio. Short R1 and delete R2 and you get the
**voltage follower** — gain of exactly 1, used purely for its high input impedance.

**Exposes:** `vcc`, `in`, `out` (= 11 × in, within the rails), `gnd`.

> ⚠ The output lives between the rails — no further. Gain 11 on a 5 V supply means any
> input past ~0.45 V flat-tops. And on a single supply the output can't go below ground
> either: a signal that swings negative shows up half-missing until you bias it to
> mid-rail. Both look like "broken amplifier"; both are the supply, not the part.
