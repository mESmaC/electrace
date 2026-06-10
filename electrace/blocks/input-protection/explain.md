# Input Protection (fuse + TVS)

Three cheap parts between your supply and everything you care about. Each handles a
different kind of bad day, and the first two are designed to work **as a pair**.

- **F1 (fuse)** — handles *too much current*: a short somewhere downstream, a failed part.
  It's the sacrificial element — a 10-cent part that opens so the board survives. Size it
  ~1.5× your true maximum draw.
- **D1 (TVS)** — handles *too much voltage*, on two timescales. Nanosecond spikes (cable
  transients, ESD, inductive kicks) get clamped at ~26.7 V before anything downstream
  notices. And a *sustained* over-voltage — wrong wall adapter — makes the TVS conduct hard,
  which **deliberately blows the fuse**. That's the trick: the TVS converts an over-voltage
  fault into the over-current fault the fuse knows how to handle. Crowbar protection, two
  parts, no smarts.
- **FB1 (ferrite bead)** — handles *noise*: RF riding in on the supply leads becomes a tiny
  amount of heat in the bead instead of hash on your rail. It's a resistor that only exists
  at high frequency.

The order matters: fuse first (so the TVS's crowbar current flows *through* it), clamp
second, bead last.

**Exposes:** `vin` (5–24 V), `vout` (same rail, protected, 2 A), `gnd`.

> ⚠ A TVS is not a regulator: it does nothing below its 24 V standoff and clamps hard above
> it. Pick the TVS standoff just above your real supply (24 V TVS for a 24 V rail, SMBJ5.0A
> for 5 V) — a mismatched one either leaks all day or protects nothing.
