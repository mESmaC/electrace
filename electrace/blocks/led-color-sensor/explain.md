# LED Color Sensor (three LEDs, zero sensor ICs)

Every LED is secretly a photodiode — and a *wavelength-selective* one. Reverse-biased,
light striking the junction generates a tiny photocurrent, and each LED responds most
strongly to light at or just below its own emission color: photons with less energy than
the bandgap simply can't excite it. Red sees red. Green sees green. Blue sees blue.
Three LEDs = a real (if humble) color fingerprint, for pennies.

- **D1/D2/D3 — the channels.** Ordinary clear-lens LEDs, mounted *backwards* on purpose:
  anodes to ground, cathodes toward the sense pins, so driving a pin HIGH reverse-biases
  the junction. The lens that focuses light *out* in normal use focuses it *in* here.
- **R1/R2/R3 — 100 Ω of insurance.** The sensing trick needs no resistance at all — these
  exist so a firmware mistake (driving the pin low while the LED conducts) costs nothing.
- **No ADC, no amplifier — time is the measurement.** The Mims technique: charge the
  junction's few-tens-of-picofarads reverse capacitance through the pin, flip the pin to
  input, and count how long the stored charge takes to leak away through photocurrent.
  Bright light: microseconds to milliseconds. Darkness: whole seconds. A GPIO and a timer
  do the whole job.
- **Honest limits.** This is a *fingerprint*, not a colorimeter: decay times vary between
  LED batches (calibrate on a white reference), ambient light adds to every channel
  (difference an illuminated and a dark reading), and the spectral bands are broad. For
  sorting red/green/blue objects it's surprisingly dependable; for paint-matching, buy
  the sensor IC.

The checks see exactly what's real here: at DC the LEDs sit reverse-biased and dark — the
engine honestly shows no current and no glow, because the action is all in the timing
firmware on the other side of the sense pins.
