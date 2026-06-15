# Dielectric Soakage — the capacitor that recharges itself

Charge a big capacitor. Short it dead with a wire — voltmeter reads zero. Now take the
wire off and wait. The voltage **climbs back on its own**, from nothing, with nothing
connected. It looks like the capacitor is generating energy out of thin air.

It isn't. It's **dielectric absorption** — soakage — and it's one of the most uncanny things
on an electronics bench.

## What's really happening

A capacitor's dielectric isn't a single, perfect insulator. Under voltage, its molecules
polarize — and some of them are *slow*. The bulk of the charge sits on the plates and
responds instantly. But a fraction soaks **into** the dielectric, into dipole states that
take seconds to minutes to line up and just as long to relax.

When you short the cap, you drain the fast charge on the plates in an instant — voltmeter
reads zero. But the slow, soaked-in charge is still there. With the short removed, it leaks
back out of the dielectric and onto the plates, and the voltage reappears. A big electrolytic
can recover several percent of its original voltage this way.

Model it as a fast capacitance in parallel with a ladder of slow R-C states (dielectric
relaxation). The recovered voltage is real stored energy that the quick discharge never
reached — not a measurement glitch.

## Why it matters

- **It can bite you.** This is why big capacitors ship with a **shorting strap**, and why a
  "discharged" microwave-oven or power-supply bulk cap can recover to a dangerous voltage
  minutes after you thought it was safe. Short HV caps through a resistor and leave the strap
  on.
- **It corrupts precision analog.** Sample-and-hold circuits and integrators avoid
  electrolytics and high-K ceramics (X5R/X7R) for exactly this reason: the soaked charge
  bleeds back and leaves a "memory" of the previous value on the held node. Film
  (polypropylene) and C0G/NP0 ceramics have almost none of it — which is why precision
  designs pay for them.

The effect is strongest in electrolytic, tantalum, and high-K ceramic caps; nearly absent in
film and C0G. The bigger and more "electrolytic" the capacitor, the spookier the demo.
