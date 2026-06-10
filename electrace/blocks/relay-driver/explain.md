# Relay Driver

A GPIO can't drive a relay coil — 30–150 mA is 10× what a pin can source, and the coil
bites back when you turn it off. One transistor and one diode fix both problems.

- **Q1** — an NPN switch on the coil's low side. The GPIO supplies a few milliamps of base
  current; the transistor sinks the full coil current. Wire the coil between `vcc` and
  `coil`.
- **R1 (1 k)** — sets the base current: (3.3 V − 0.7 V) / 1 k ≈ 2.6 mA. The rule of thumb
  is base ≈ collector ÷ 10 for solid saturation — 2.6 mA comfortably saturates a 100 mA
  coil load.
- **D1 — the famous flyback diode, and the reason this block exists.** A coil is an
  inductor: its current *cannot stop instantly*. Open Q1 without D1 and the coil voltage
  flies up — hundreds of volts — until something breaks down, usually Q1. D1 sits reversed
  across the coil doing nothing… until turn-off, when it gives that current a quiet loop to
  decay through.

**Exposes:** `ctrl` (GPIO), `vcc` (coil supply — also the flyback return), `coil` (the
coil's low side), `gnd`.

> ⚠ The relay's *contact* side is a separate world — this block drives the coil only.
> Switching mains on the contacts is its own safety problem (creepage, isolation, fusing)
> that no driver circuit solves for you.
