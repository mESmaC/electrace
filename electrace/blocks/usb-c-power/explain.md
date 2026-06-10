# USB-C 5V Input

Turns a USB-C receptacle into a clean 5 V rail — including the one thing everyone forgets:
**without the two CC resistors, a USB-C charger gives you nothing.** A USB-C source keeps
VBUS off until it sees a sink advertise itself on the CC pins.

- **R1 / R2** — 5.1 kΩ pulldowns, one per CC pin. This is the entire "handshake" for a 5 V
  device: the resistor tells the source *"I'm a default-power sink — turn VBUS on."* You need
  one on **each** CC pin because the cable can plug in either way; only one is actually used
  per orientation, but you never know which.
- **D1** — a TVS on VBUS. Hot-plugging a cable rings; the clamp eats the spike before your
  regulator sees it.
- **C1** — input bulk capacitance, so a sudden load step doesn't sag the rail through the
  cable's resistance.

How much current you get is the *source's* decision, advertised on CC: a basic port gives
0.5–1.5 A, a 15 W source gives 3 A. The pulldowns can't negotiate more — and that's a
feature: a sink that can't ask for higher voltage can never receive more than 5 V.

**Exposes:** `vbus`, `cc1`, `cc2`, `gnd` (dock these to a USB-C receptacle) and `vout`
(+5 V, up to 3 A).

> ⚠ If your board mysteriously won't power from a C-to-C cable but works from A-to-C,
> it's missing CC pulldowns — A-to-C cables hardwire VBUS, C-to-C sources wait for the
> handshake. This block is the fix.
