# Crystal + Load Caps

The MCU's heartbeat. A quartz crystal resonates mechanically — like a tuning fork — at
almost exactly one frequency, and the microcontroller's internal inverter amplifies that
resonance into the system clock. Three parts, and two of them are capacitors that look
like they do nothing.

- **Y1** — the crystal. It's cut to resonate at 16 MHz *when it sees a specific
  capacitance* (its rated CL, 12.5 pF here). Quartz is why your UART baud rate and USB
  timing work: tens of parts-per-million accuracy, versus a few *percent* for the MCU's
  internal RC oscillator.
- **C1, C2 — the load caps**, and the part everyone gets wrong. In series as seen by the
  crystal: CL = (18·18)/(18+18) = 9 pF, plus ~3.5 pF of board strays ≈ the rated 12.5 pF.
  Wrong caps don't usually kill the oscillator — they *pull* it off frequency, or leave
  so little margin it fails at temperature extremes. "Works on my bench, dies in the
  field" is the classic symptom.

Why two caps and not one? The crystal plus the MCU's inverter form the actual oscillator
(a Pierce oscillator); the caps complete the feedback network *and* set the load. The MCU
datasheet's "connect a crystal" page is this exact block.

**Exposes:** `xin`/`xout` (to the MCU's OSC pins — order rarely matters for a passive
crystal), `gnd`.

> ⚠ This is the most layout-sensitive square centimetre on the board: crystal millimetres
> from the MCU, caps grounded right at it, no signals routed underneath. The schematic is
> trivial; the placement is the engineering.
