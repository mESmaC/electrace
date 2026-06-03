# Bridge Rectifier

Turns an **AC input into DC** using four diodes in the classic bridge arrangement, then
smooths it with a bulk capacitor. Both half-cycles of the AC waveform are routed the same way
through the load, so you get full-wave rectification (not just half).

- **D1–D4** — the bridge. On each half-cycle two diodes conduct: one steers the live phase up
  to **V+**, the other returns the opposite phase to **ground**. Swap which two each half-cycle
  and the output polarity stays fixed.
- **C1** — the reservoir cap. The bridge output is bumpy (it pulses at twice the line
  frequency); C1 holds the voltage up between peaks. Bigger C → less ripple.

**Exposes:** `ac1` / `ac2` (the AC input, either way round) and `vout` / `gnd` (smoothed DC).

> Each diode drops ~0.7 V, and two are always in the path — so `Vout ≈ Vac_peak − 1.4 V`.
> The cap is polarized: V+ must stay positive or it fails.
