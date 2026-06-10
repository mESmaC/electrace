# Temperature Sensing (NTC divider)

Turns temperature into a voltage an ADC can read — with a sensor that costs two cents.
This is how the vast majority of products measure temperature: battery packs, 3D printer
hotends, coffee machines.

- **TH1 — the NTC thermistor.** A resistor that *loses* resistance as it warms (Negative
  Temperature Coefficient) — 10 kΩ at 25 °C, roughly halving every ~20 °C. That curve is
  steep and predictable, which is why a two-cent part beats many "real" sensor ICs on
  sensitivity.
- **R1 — the fixed half of the divider.** Out = VCC · R1/(R1 + TH1) — wait, check the
  wiring: the NTC is on the *bottom*, so the output **rises with temperature**, which is
  the intuitive direction. R1 is chosen equal to the NTC's 25 °C value so room temperature
  sits at mid-rail — right where the divider's slope (and your resolution) is best.
- **C1** — gives the ADC's sampling capacitor a stiff source and quietly averages the
  noise a long sensor wire picks up.

Converting the reading: resistance → temperature uses the **B equation** (B = 3950 here)
or, for real accuracy, the Steinhart–Hart fit. Every firmware ecosystem has a lookup-table
generator for exactly this divider.

**Exposes:** `vcc` (use the ADC's reference rail — see the ratiometric note), `out` (to
an ADC pin), `gnd`.

> ⚠ The sensor heats itself with its own measuring current, then dutifully reports its own
> warmth. Keep divider current well under a milliamp — the limits note has the numbers.
