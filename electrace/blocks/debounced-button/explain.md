# Debounced Button

A button doesn't close once — it **chatters**. The contacts physically bounce, making and
breaking dozens of times in the first millisecond. To your code that looks like a user
pressing the button twenty times. This block makes one press read as one press.

- **R1 (10 k)** — pulls the line to VCC: released = HIGH, defined, no floating input.
- **SW1** — shorts the line to ground when pressed. Active-low is the convention because
  pulling *down* through a switch is the oldest, most noise-robust trick in logic design.
- **C1 (100 n)** — the actual debouncer. The capacitor can't change voltage instantly, so
  the chatter becomes one smooth glide: on press it discharges through the switch fast but
  monotonically; the bounces just interrupt a slide that never reverses enough to re-cross
  the logic threshold. One press, one edge.

The time constant R1×C1 ≈ 1 ms swallows typical tact-switch bounce. The hidden bonus: C1
discharging through the switch also makes the contacts arc a tiny bit *less* than a bare
GPIO wiring would — gentle on both sides.

**Exposes:** `vcc`, `out` (HIGH = released, LOW = pressed), `gnd`.

> ⚠ Disable your pin's internal pull-up when using this block — two pull-ups in parallel
> shift the RC timing and waste current. And if your firmware ALSO debounces (most
> frameworks do), pick one place for the job, not two fighting timers.
