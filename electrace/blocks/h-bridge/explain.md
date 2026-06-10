# H-Bridge Motor Driver

A motor spins the way current flows through it. To *reverse* a motor you must reverse the
current — and you can't do that with one switch. The H-bridge is the four-switch answer:
the motor hangs in the middle of an "H," and turning on a **diagonal pair** routes current
left-to-right or right-to-left through it.

- `IN1` high → one diagonal conducts → current flows OUT1 → motor → OUT2. Forward.
- `IN2` high → the other diagonal → current flows OUT2 → motor → OUT1. Reverse.
- Both low → motor coasts. Both high → both motor terminals tied together → **brake**
  (the spinning motor generates into a short and stops fast).
- PWM an input instead of holding it → speed control.

Inside U1, each side of the H is a totem-pole pair (a P-FET above an N-FET below, the same
structure as a CMOS logic gate, just enormous), plus logic that guarantees the deadly
combination — both switches of one side on at once, shorting the supply — can never happen.

- **C1** — motors take their current in violent gulps, especially reversing. The reservoir
  cap answers those gulps locally so the supply rail doesn't dip and reset your MCU (the
  most common "my robot reboots when it turns" bug).

**Exposes:** `vm` (motor supply), `in1`/`in2` (direction/PWM from GPIOs), `out1`/`out2`
(the motor), `gnd`.

> ⚠ Size for **stall current**, not running current — stall is 5–10× higher and happens at
> every start. A motor that runs at 200 mA but stalls at 1.6 A is over this block's limit;
> the checks flag it when the motor block declares its stall draw.
