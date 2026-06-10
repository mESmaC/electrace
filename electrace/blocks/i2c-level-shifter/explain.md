# I2C Level Shifter

Lets a 3.3 V brain talk to 5 V parts on the same I2C bus — **in both directions**, with two
tiny MOSFETs (the classic BSS138 circuit from NXP's app note).

I2C makes this possible because nobody ever drives a line *high* — devices only pull lines
**low**, and resistors pull them up. So shifting levels just means: let a LOW cross the
fence, in either direction, and let each side idle at its own voltage.

Per line (SDA shown; SCL is identical):

- **Idle:** nothing pulls. Each side floats up its own pull-up — 3.3 V on the left of Q1,
  5 V on the right. The FET's gate sits at 3.3 V, source at 3.3 V → Vgs = 0 → off. The two
  sides coexist at different voltages, connected but not fighting.
- **Low side pulls low:** Q1's source drops, Vgs rises → the channel turns on and drags the
  5 V side down too.
- **High side pulls low:** Q1's body diode conducts first, dipping the source; that gives
  Vgs, the channel turns on and finishes the job.

A LOW always crosses; a HIGH is each side's own business. That's the entire trick.

**Exposes:** `vlv`/`vhv` (the two supply rails), `sda_lv`/`scl_lv` (3.3 V side),
`sda_hv`/`scl_hv` (5 V side).

> ⚠ Don't stack this onto a bus that already has pull-ups on both sides — total pull-up
> resistance in parallel can get too strong for devices to pull low. Count ALL the pull-ups
> on each segment (many breakout boards sneak their own in).
