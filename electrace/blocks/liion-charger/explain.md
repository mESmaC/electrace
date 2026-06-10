# Li-ion Charger (1 cell)

Charges a single lithium cell safely from 5 V (USB) — running the **CC/CV profile** every
lithium cell requires: **constant current** while the cell is empty, smoothly handing over
to a **constant 4.2 V** as it fills, then tapering off to done.

- **U1 (TP4056-class)** — the whole charge brain. It measures the cell at `BAT` and decides
  which phase you're in. The cell is safe because this loop never lets it see more than
  4.2 V or more than the programmed current.
- **R2** — the one resistor that *sets the charge current*: `Icharge ≈ 1200 / R(PROG)`.
  The 1.2 kΩ here means 1 A. Swap it to match your cell — never charge faster than 1C
  (a 500 mAh cell wants ≤ 500 mA → 2.4 kΩ).
- **R1** — pull-up for `CHRG`, the open-drain status output: low while charging, releases
  when full. Wire it to an LED or a GPIO.
- **TEMP is tied to ground** here, which *disables* battery-temperature monitoring — fine
  for a bench project at room temperature; for anything enclosed or outdoors, wire a 10 k
  NTC against the cell instead.

It's a **linear** charger: simple and quiet, but it burns `(Vin − Vbat) × Icharge` as heat —
about 1 W into an empty cell at 1 A. That's why the chip gets warm; it's supposed to (it
thermally self-limits).

**Exposes:** `vin` (5 V), `batt` (the cell, 4.2 V max), `chrg` (status), `gnd`.

> ⚠ Protected cells only, or add a protection circuit: this block charges correctly but
> does NOT protect against over-discharge or shorts on the battery side. Most bare 18650s
> need that protection; most pouch cells with a small PCB already include it.
