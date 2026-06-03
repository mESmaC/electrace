# LED Indicator

The simplest useful block: an **LED with a current-limiting resistor**. Drive `vin` high and
the LED lights. The resistor is not optional — an LED is a diode, so without it the current is
limited only by the supply and the LED burns out.

- **R1** — sets the brightness/current. Sized from the supply and the LED's forward voltage:
  `I = (Vin − Vf) / R`. With 5 V in, a 2 V green LED, and 330 Ω → about 9 mA.
- **D1** — the LED. Anode toward the resistor, cathode to ground.

**Exposes:** `vin` (the drive, 3–5.5 V) and `gnd`.

> Change R to change brightness: smaller R = more current = brighter (until you exceed the
> LED's rating). The declared 15 mA cap on `vin` keeps it in safe territory.
