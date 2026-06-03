# MCU + Load

A microcontroller and its peripherals running from a 5 V rail — the thing everything upstream
exists to feed.

- **U1** — the MCU.
- **C1 / C2** — decoupling (a 100 nF close to the pin + a 10 µF bulk).

**Exposes:** `vdd` (5 V, ~1.8 A typ), `gnd`, and a `status` signal output.

> The `status` output is meant to drive an indicator or be read elsewhere — if you leave it
> unconnected, Electrace will remind you so it isn't silently forgotten.
