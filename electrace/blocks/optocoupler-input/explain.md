# Optocoupler Input

Reads a signal from a world you don't trust — a 24 V industrial sensor, another machine's
output, anything on long wires — with **no electrical connection at all** between that world
and your microcontroller. The only thing that crosses the barrier is light.

- **U1 — the optocoupler.** Inside the package: an LED and a phototransistor facing each
  other across a gap. Signal current lights the LED; the light turns on the transistor;
  the transistor pulls your output low. Kilovolts of isolation, two cents of silicon, and
  the two sides can disagree about ground by hundreds of volts without anyone noticing.
- **R1** sets the LED current — (Vin − 1.2 V)/2.2k ≈ 5–10 mA across a 12–24 V input. The
  datasheet's *current transfer ratio* (CTR) says how much collector current you get per
  LED milliamp; everything downstream depends on feeding the LED properly.
- **D1** sits anti-parallel across the LED because opto LEDs die at about **6 V reverse**
  — and field wiring *will* get connected backwards eventually. One diode makes that a
  non-event.
- **R2** pulls the output high from *your* supply, on *your* side of the barrier. Signal
  present → output LOW. Yes, it's inverted; see the gotchas.

**Exposes:** `in+`/`in−` (the isolated, dirty side — 5–24 V), `vcc`/`out`/`gnd` (your
clean side; `out` is active-low).

> ⚠ Isolation is only as good as the *layout*: the barrier is meaningless if a copper
> pour sneaks under the package or the two sides share a trace somewhere else. Keep the
> creepage gap clear — the chip drew the line; the board has to respect it.
