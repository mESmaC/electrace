# RC Low-Pass Filter

A **resistor and capacitor** that pass low frequencies and roll off high ones — the workhorse
of signal conditioning: debouncing, anti-aliasing, smoothing a PWM into a voltage, or just
cleaning noise off a line.

- **R1** — in series with the signal.
- **C1** — to ground. At high frequencies the cap looks like a short, so it pulls the fast
  wiggles down to ground; at low frequencies it looks open and the signal passes.

**Exposes:** `in`, `out`, and `gnd`.

> Cutoff is `fc = 1 / (2π·R·C)`. With 1 kΩ and 100 nF → about **1.6 kHz**: content below it
> passes, content above is attenuated 20 dB/decade. Change R or C to move the corner.
