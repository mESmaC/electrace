# Voltage Reference (TL431)

A voltage you can actually trust. Supplies wobble, regulators drift a percent or two —
but an ADC reading, a battery cutoff, a current limit all need a number that *stays put*.
This block makes 2.495 V that holds to a fraction of a percent across temperature and
input swing, for about ten cents.

- **U1 — the TL431**, the most-shipped "secret" IC in electronics (it's inside nearly
  every phone charger, closing the feedback loop). Think of it as an **adjustable,
  precise zener**: inside is a 2.495 V bandgap reference, an error amplifier, and a
  shunt transistor. The error amp compares the `ref` pin against the internal bandgap
  and pulls the cathode down exactly as hard as needed to make them match.
- **R1 — the bias.** A shunt reference regulates by *eating current*: R1 feeds the node
  from VIN, the load takes what it needs, and U1 swallows the rest. No spare current to
  swallow (R1 too large) and regulation quietly stops.
- With `ref` tied straight to the cathode, the node parks at the bandgap voltage
  itself: **2.495 V**. Add a divider between cathode and `ref` and the same part makes
  any voltage from 2.5 to 36 V — that's the "adjustable" in adjustable zener, and
  exactly how it runs inside those chargers.

**Exposes:** `vin` (4–15 V, anything reasonably above 2.5 V), `vref` (2.495 V, precise),
`gnd`.

> ⚠ A reference is not a regulator — it makes a precise *voltage*, not *power*. Load it
> with milliamps-not-tens and buffer it with an op-amp follower if something hungry needs
> it. And mind the capacitance trap in the limits: some caps make this part sing.
