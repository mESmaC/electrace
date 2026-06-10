# LED Current Sink

LEDs are current-mode creatures: their brightness tracks current, and their forward
voltage is a moving target (it shifts with temperature and part lot). A series resistor
*approximates* a current; this two-transistor circuit *regulates* one — same brightness at
3 V or 24 V, summer or winter.

How the feedback works (wire the LED string between supply and `sink`):

1. Current through the string flows Q1 → **R2**, the sense resistor.
2. R2's voltage grows with the current. At **~0.6 V** it switches **Q2** on.
3. Q2's collector then *steals Q1's base drive* — throttling Q1 until the current settles
   exactly where R2 reads 0.6 V.

That's the whole regulator: `I ≈ 0.6 V / R2`. Want 20 mA? R2 = 33 Ω. 350 mA power LED?
R2 = 1.8 Ω (watch its wattage: I²R).

This is also your first taste of how every linear current regulator works inside — a sense
element, a reference (here Q2's own Vbe), and a pass element being throttled. The LM317 in
current mode is this exact idea with better manners.

**Exposes:** `vin` (bias feed for the base), `sink` (LED string's cathode end), `gnd`.

> ⚠ The headroom rule: whatever voltage your LED string doesn't drop, **Q1 drops as heat**.
> Match the string voltage to the supply so Q1 keeps only 1–2 V. The checks compare
> declared voltages and flag the dissipation when you give them the numbers.
