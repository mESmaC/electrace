# 555 Timer (astable)

The most famous chip in hobby electronics, in its most famous job: a square-wave oscillator
that needs only two resistors and a capacitor to set its rhythm.

The trick inside: the 555 watches **C1**'s voltage and bounces it between two trip points —
**1/3 and 2/3 of VCC** — forever:

1. C1 charges through **Ra + Rb** toward VCC. Output is HIGH.
2. At 2/3·VCC the threshold comparator flips the internal latch: output LOW, and pin 7
   (`DIS`) opens a path to ground.
3. C1 now discharges through **only Rb** into pin 7. At 1/3·VCC the trigger comparator
   flips everything back. Repeat until the heat death of the universe.

`f ≈ 1.44 / ((Ra + 2Rb) · C1)` — and because charge flows through Ra+Rb but discharge only
through Rb, the HIGH half is always longer: `duty = (Ra+Rb)/(Ra+2Rb)`. Want closer to 50%?
Make Rb ≫ Ra.

- **C2** quiets the `CONTROL` pin — that pin is literally a tap on the internal 2/3·VCC
  divider, so supply noise there jitters your frequency.
- `RST` is tied to VCC: a floating reset pin is the classic "my 555 randomly stops" bug.

**Exposes:** `vcc` (4.5–15 V), `out` (square wave, can source/sink a beefy 200 mA), `gnd`.

> ⚠ The trip points scale WITH the supply — that's why the frequency barely cares about
> VCC. But it also means a sagging battery changes the absolute thresholds; on the bipolar
> NE555 expect supply spikes when the output switches (the totem-pole shoots through) —
> bypass VCC well.
