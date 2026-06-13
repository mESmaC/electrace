# Video pipeline — queue, ideas, and the long-form plan

Created 2026-06-12 (Cameron's rapid-fire session). Shorts ship on the retention architecture
(payoff ~75%, CTA inside median watch); every video pairs with a block page.

## In the can
- TL431 teardown — rendered, awaiting a slot (deep-technical lane).

## Shorts queue (next up)
1. **LED color sensor** — "Every LED is secretly a light sensor — and it only sees its own
   color." Block + glossary already live (led-color-sensor / photovoltaic-mode); the short
   demos the Mims timing trick. Bonus open: the editor's LED-glow feature as the B-roll
   ("Electrace renders brightness from the math — now run the junction backwards").
2. **RF field detector** — "Your ADC is secretly a radio." HONEST framing: a bare ADC can't
   sample 2.4 GHz (Nyquist says no) — but one Schottky + one cap in front of it (the
   crystal-radio envelope detector) turns any ADC pin into a field-strength meter: phone
   transmits, number jumps. Build the `rf-field-detector` block first (antenna stub →
   Schottky → RC → ADC pin), same loop as the color sensor.
3. Boost converter / charge pump / ULN2003 — existing breakdown-lane candidates (ROADMAP).

## Long-form #1: "Every component is secretly a sensor"
The channel's first long-form (feeds the 4k-watch-hours YPP route; Shorts views count
separately). One shoot → chapters that each also cut into a Short. Chapter list:
1. LED → light & color (the block exists; strongest opener)
2. Diode/BJT junction → thermometer (the −2 mV/°C silicon truth; how every MCU temp sensor works)
3. Capacitor pad → touch & humidity (capacitive sensing IS this)
4. Inductor/coil → metal detector (oscillator detuning)
5. Speaker → microphone (it's the same transducer; demo both ways)
6. Motor → generator/tachometer (back-EMF as speed sensor)
7. Piezo buzzer → knock sensor (reverse piezoelectricity)
8. ADC pin + Schottky → RF field meter (chapter = short #2 above)
9. Wire → antenna (the 50 Hz hum demo; why floating pins read garbage)
Close: "sensing isn't a part you buy — it's physics you already own." Every chapter ends on
its Electrace block page; the video doubles as a library tour.

## Long-form #2: "Your circuit is haunted" (Cameron's deep-cuts dump, 2026-06-12)
Ordinary parts breaking the rules — the spookier sibling of long-form #1. Best-first:
1. **Soakage (dielectric absorption)** — discharge a cap, watch it recharge ITSELF. The
   spookiest bench demo in electronics; why big caps ship with shorting straps and why
   sample-and-holds hate electrolytics/X7R. STRONG standalone Short too.
2. **Negistor oscillator** — avalanche an NPN's B-E junction (~8 V): negative resistance,
   one-transistor LED blinker from a 2N3904. Twist: it's also a white-noise source, and it
   permanently degrades hFE — the oscillator that scars its transistor. Short-worthy.
3. **Singing capacitors** — class-2 MLCCs are piezoelectric: they sing under ripple AND
   work as accidental microphones (board flex injects noise). Audible demo = great hook.
   (Cousin note: triboelectric coax noise; low-noise cable exists for this reason.)
4. **Every solder joint is a thermocouple** — µV/°C Seebeck at every dissimilar junction;
   why precision layouts obsess over thermal symmetry. (Also fits long-form #1 ch. list.)
5. **Incandescent bulb = self-regulating resistor** — 10× cold-to-hot tungsten PTC; the
   HP200A amplitude trick; the dim-bulb tester every PSU repair bench still uses. Practical
   lane: "the $2 tool that saves your power supply."
6. **The rusty bolt effect** — corroded junctions rectify RF (passive intermod from
   "nothing"); same physics as the WWII foxhole razor-blade radio. History-hook gold.
7. **Neon bulbs: dark effect + relaxation oscillators + neon ring counters** (memory made
   of lamps!). 8. **Silicon glows in avalanche** (emission microscopy finds chip defects by
   the light). 9. **ENF mains-hum forensics** — grid frequency as a timestamp watermark in
   every recording; broad-appeal standalone. 10. Honorables: floating CMOS gate as an
   electroscope (detect a comb across the room — fits long-form #1), optocoupler CTR as a
   consumable, TECs run backwards as generators (sensor long-form ch. candidate).

**"Piezoelectrics might be magic"** (Cameron) — the piezo super-cut: a BBQ igniter makes
~15 kV from a thumb press (no battery anywhere), the same crystal IS the buzzer, the knock
sensor, the singing MLCC, the microphone, and the resonator keeping every quartz watch on
time. One effect, five disguises — could be a Short ("this clicker makes 15,000 volts") or
the bridge chapter linking long-form #1 (sensors) and #2 (haunted).

Glossary candidates from this list: dielectric-absorption, thermal-emf, microphonics,
negative-resistance. Add when the videos near.

## Standing notes
- Tags: both hashtag + keyword sets ship with every metadata block (since #9).
- Fixture names must never leak the test (bench lesson — applies to demo designs too).
- Engine tie-in rule: a video's circuit becomes a block FIRST, so the description has a page
  to link and the page gets the embed back.
