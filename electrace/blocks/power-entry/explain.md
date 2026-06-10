# Power Entry

Takes a DC barrel-jack input (9–18 V) and protects everything downstream before handing off
a clean `VBUS` rail and ground.

- **Q1** — a P-channel MOSFET for reverse-polarity protection. Unlike a series diode it
  drops almost no voltage, so you don't waste headroom or generate heat. The input goes to
  the **drain**: at power-up the body diode conducts, the source rises, and with the gate at
  ground the channel turns fully on (Vgs ≈ −Vin) — shorting out the diode drop. Plug the
  supply in backwards and both the body diode and the channel block.
- **D1** — a TVS diode that clamps input spikes (plug transients, inductive kicks) before
  they reach the regulator.
- **C1** — bulk capacitance to hold the rail up through fast current demands.

**Exposes:** `vout` (VBUS, 9–18 V, up to 2 A) and `gnd`.

> ⚠ The TVS clamps around 33 V — sustained input above ~30 V will cook it. Keep the supply
> within the rated range.
