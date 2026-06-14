# RF Field Detector — your ADC is secretly a radio

An ADC can't sample 2.4 GHz. Nyquist forbids it: to digitize a wave you must sample at
least twice its frequency, and no microcontroller pin runs at 5 billion samples a second.
So how does a one-dollar circuit let an ordinary ADC pin *feel* the Wi-Fi in the room?

It doesn't sample the RF. It measures its **envelope** — how much RF energy is present —
and hands that to the ADC as a slow DC level. This is the oldest trick in radio: the
**crystal-radio envelope detector**.

## How it works

1. **The antenna** is just a wire. Hold it near any transmitter — a phone, a router, a
   walkie-talkie — and a few millivolts of RF couple onto it. It isn't tuned; it picks up
   whatever's loudest nearby.
2. **The Schottky diode** rectifies that RF. A Schottky's low forward drop and fast
   recovery let it follow gigahertz signals where an ordinary silicon diode simply can't
   keep up — it chops the wave so only the positive half gets through.
3. **The RC (C1 + R1)** smooths those rectified pulses into a steady DC level. The capacitor
   holds each peak; the resistor bleeds it so the level falls when the field weakens. What
   comes out tracks the **strength** of the RF, not its content.
4. **The ADC pin** reads that DC level. Phone transmits → the number jumps. Walk away → it
   falls. You built a field-strength meter out of four passives.

## The honest part

This measures **how much** RF is here, not **what's being said**. There's no tuning, no
station selection, no demodulation of data — just power. That's the honest scope of an
envelope detector: a cheap, wideband "is something transmitting near me?" sensor, the same
core that sat inside foxhole radios and every AM crystal set. To turn field strength into a
clean reading, bias the diode just below conduction with a high-value resistor so even tiny
signals push it into rectifying, and pick a true detector Schottky (a zero-bias part like an
HSMS-285x) when you want to feel weak fields.

The lesson generalizes: an ADC that can't possibly sample a signal can still measure a
*property* of it, if you do the hard part in hardware first. The diode is doing the
down-conversion the silicon never could.
