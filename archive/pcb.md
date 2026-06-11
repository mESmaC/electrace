# PCB Editor — bridging from the schematic

_How the schematic world becomes a board. The same deterministic-core pattern: derive a PCB
model from the netlist, then a custom canvas edits it. Builds on [data-model.md](data-model.md)
(`flatten` → global netlist) and mirrors how the schematic editor sits on `deriveBlockSchematic`._

## The pipeline

```
design (blocks + connections)
  → resolve()              stitch design-level nets
  → flatten()              one global netlist: parts + cross-block nets   [existing]
  → pcbProject()           PCB model: components (footprints = pads in mm) + ratsnest   [NEW, core/pcb.ts]
  → PCB editor             place footprints, route copper                  [next]
  → DRC                    clearance / overlap / unrouted checks           [later]
  → export                 Gerber / drill / KiCad PCB                       [later]
```

`pcbProject(design, blocks)` is the bridge, and it's deterministic + tested (`core/pcb.ts`):
- **Components** — one per flattened part (`REG1/Cout`, …), each with a **footprint** = pads in
  millimetres. Pads are generated to match the part's *actual pins* (so the ratsnest is always
  valid): 2-pin parts get an SMD chip footprint sized by code (0402/0603/0805/1206); ≥3-pin parts
  get a dual-row (SOIC-like) layout. Unknown footprint codes pass through.
- **Ratsnest** — the flattened nets, as pad-to-pad links (`PWR1/C1.1` ↔ `REG1/U1.VIN`). Already
  cross-block-stitched by `flatten`.

## Footprint matching — built (`core/footprints.ts`)

Real land patterns in millimetres (≈ IPC-7351 nominal / KiCad), with a resolver that maps a part
to its footprint and its **pins → physical pads**:
- **SMD chips** 0201–1210 (exact pad geometry); **gull-wing dual** SOIC/SOP/SSOP/TSSOP/MSOP and
  **quad** QFP/LQFP/TQFP/QFN generators; **SOT-23/-5/-223**, **SOD-123/SMA**, **HC-49**;
  **through-hole** DIP, 2.54 mm headers, radial electrolytic, DO-41.
- Resolution order: the part's `footprint` code → else inferred from `type` + pin count.
- **Pin→pad:** identity for numbered pins (perfect); known maps for 3-terminal parts (B/C/E,
  G/D/S in SOT-23; IN/OUT/GND in SOT-223) as *sensible defaults*; otherwise pins to pads in order.
  The **land geometry is accurate**; for an unspecified IC the package/pinout is a default —
  authoring a real `footprint` code on the block makes it exact.
- `pcbProject` emits the full physical footprint (THT pads carry a `drill`); the editor renders
  rounded SMD pads and drilled THT pads.

_Future: pull pinouts from the part library so 3-terminal/IC pinouts are exact, not defaults._

## The PCB editor (next phase)

A custom SVG/canvas editor like `BlockSchematic`, but in mm:
- **P1 — placement + ratsnest.** Load `pcbProject`; render a board outline + the footprints
  (pads, ref, courtyard); drag/snap to a mm grid; live ratsnest (thin shortest pad-to-pad lines
  per net) that re-draws as you move parts. Per-net colour, like the schematic.
- **P2 — routing.** Draw copper traces on layers (top/bottom), vias, track width; a route is
  "done" when a ratsnest link is satisfied. Net-aware (only legal connections).
- **P3 — DRC + export.** Clearance/overlap/unrouted checks (deterministic, in core) surfaced in
  the same Problems panel; Gerber/drill + KiCad PCB export (we already do KiCad netlist).

## Persistence

PCB placement is **per-design layout data** (positions/rotations per component ref, routed
tracks) — stored alongside the design (see [storage.md](storage.md), e.g. a `pcb` JSONB on
`designs`). The schematic stays the source of connectivity; the PCB stores geometry. Re-running
`pcbProject` reconciles: new parts appear unplaced, removed parts drop out, the ratsnest follows
the current netlist.

## Status

- ✅ `pcbProject()` bridge in core (components + footprints + ratsnest), tested, verified on the
  buck-supply example (13 components, 7 nets, cross-block stitching correct).
- ⏭ Next: the P1 placement canvas reading `pcbProject`.
