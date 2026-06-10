# Boost Converter

Makes a **higher** voltage from a lower one — 12 V from a 3–5 V supply — by storing energy
in an inductor and releasing it above the input. The buck's mirror image.

Each switching cycle has two beats:

1. **Charge:** U1 pulls the `SW` node to ground. Current ramps up through **L1** from the
   input — the inductor is being "wound up."
2. **Release:** U1 lets go. An inductor's current can't stop instantly, so the `SW` node
   voltage *flies up* until something conducts — that something is **D1**, dumping the
   energy into **Cout** at 12 V.

- **R1 / R2** — the feedback divider. U1 adjusts its switching to hold
  `Vout = Vref × (1 + R1/R2)` → `0.975 V × (1 + 113k/10k) ≈ 12 V`.
- **D1** is a Schottky — it switches fast and drops ~0.3 V instead of 0.7, which matters
  when it carries the full output current thousands of times a millisecond.
- **Cin** matters more than intuition says: a boost draws its big pulsed current from the
  *input* side.

**The number that surprises everyone:** power in ≈ power out, so the *input* current is
bigger than the output current by the boost ratio. 12 V × 0.8 A out ≈ 10 W → at 3 V in,
that's **~4 A from the source**. Size the input path for it.

**Exposes:** `vin` (2.7–5.5 V), `vout` (+12 V, 0.8 A), `gnd`.

> ⚠ A boost has no off switch on its output: even with U1 disabled, the path
> `vin → L1 → D1 → vout` conducts. Your "off" output sits at Vin − 0.3 V. If the load must
> be truly disconnectable, put a switch in front.
