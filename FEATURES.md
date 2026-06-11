# Electrace — internal feature inventory

Cameron's reference, not public copy. Verified against the code at commit d1ba7f1 (2026-06-10).
Update when features ship; the public-facing summary lives in `web/lib/electrace-info.ts` (FEATURES_MD)
and the tier claims in `web/lib/plans.ts`.

Tier legend: **[F]** free · **[P]** Pro · **[F→P soft]** visible to all, Pro to use (upsell modal/note).

## Schematic editor (canvas)

- [F] **Sandbox (no account):** /editor is public — anonymous users get the full free tier,
  localStorage-only, with a banner + signup hook; signing up auto-imports the work. Cloud APIs
  401 for anonymous (no server cost/abuse surface). Sparky stays signed-in + Pro.
- [F] Block palette: library + my-blocks + connectors; click or drag to place
- [F] Spec-search ("18V → 5V at 3A" filters to blocks whose declared specs satisfy it, with why-it-fits)
- [F] Typed terminals (power / rail / signal / gnd) with roles (in/out); handle-drag wiring
- [F] Block cards: declared-spec line, live status chip (errors/warnings), IC/DISC tag, glyph colors
- [F] Findings light blocks up in severity color; click a finding → jump + highlight
- [F] Hover explainers; double-click → drill into the block's internal schematic
- [F] In-block schematic editor: placed symbols, wires with waypoints, net labels / power flags
  (same-name = same net, no wire), junction taps bound to host wires, ANSI/IEC symbol toggle
- [F] Custom blocks: create / rename / edit terminals / delete; authored chips (package + pinout)
- [F] Undo/redo (debounced snapshots), autosave (+ flush on tab close), import/export design JSON
- [F] Full-schematic view (all blocks side by side, connector regions, net flags) + SVG export
- [F] What-if stress test (entry-rail propagation + authored limits, margins sorted)
- [F] Power budget bar (per-rail draw vs capacity)
- [F] Acknowledge correct-but-noisy findings (mark intended, with note); unacknowledge
- [F] Connectors: 21-part catalog; per-pin declarations (name/type/direction/V/I) via double-click
  or right-click → Pin specs…; built-in pin meanings for USB-C/A/Mini/Micro, JST-PH LiPo, barrel,
  audio TRS; pin rows render name color-coded by net type + declared V/A
- [F→P soft] Right-click block → Isolation… (galvanic-isolation constraints, incl. "isolate from all")
- [F→P soft] Right-click wire → Signal class… (SI net classes with pairPin/pull-up/bus-cap knobs)
- [F] Report Bug (Shadowplay-style local buffer; confirm dialog shows exactly what's sent)
- [F] Themes Light/Mid/Dark; accent + glyph colors; Sparky bubble (gated, see below)

## Checking engine (@electrace/core — runs client-side on every change)

22 lint rules: danglingWire, openNet, overCurrent, **connectorPinCurrent** (per-contact rating),
**usbInrush** (hard-attached bulk C on a USB rail vs the ~10 µF spec allowance), overVoltage, underVoltage, signalOverCurrent, shortCircuit, polarityConflict, multipleDrivers,
undrivenRail, internalShort, regulatorDissipation (linear topology, (Vin−Vout)·I), isolationBridged,
busTermination (finds the actual resistor bridging the pair), i2cRiseTime (pull-ups + bus C, fix in
message), lowEfficiency, underUtilized, testPoints, emptyBlock, connectorFull.

- DC propagation: `v.follows` outputs swing with their rail (8-pass), sink-labeled override;
  generic load charging (downstream draw charges back to the supply input)
- Net typing/naming: precedence gnd>power>rail>signal; names from wire labels → connector pin
  names (VBUS) → rail-looking terminals
- Galvanic isolation: Block.isolation terminal groups (optocoupler sides), Design constraints,
  conduction-graph BFS names the bridging path
- SI net classes (rs485, can, i2c-100k/400k, usb-fs, fast-edge): z0/termination/rise/edge/skew
- Connector pins as real terminals: catalog defaults merged under per-instance specs
- Resilience: stale wires recorded as invalid (never crash analysis); internal shorts blame the
  block, suppress the cascade

## PCB

- [F] PCB editor: footprints from schematic, ratsnest, manual routing (2 layers, widths), vias,
  board outline + fit, auto-arrange, measure
- [F] DRC: clearance, overlap, short, unrouted, offboard + SI trace checks (si-long electrical
  length vs edge rate, si-skew pair matching)
- [F] KiCad footprint import/browser
- Footprints: ~55 part types with real defaults (0603/1206/SOT-23/TACT/radial/headers…), chip
  packages (soic/qfp/qfn/dip/sot/bga), pitch-correct connector land patterns (JST 2.0/2.5mm).
  USB lands are header stand-ins (known gap)

## Exports & gating

- [F] Design JSON, KiCad netlist (.net), schematic SVG, BOM **viewing**, Digi-Key buy links +
  one-click cart (affiliate — deliberately free)
- [P soft] BOM CSV download; routed-board .kicad_pcb export
- Gerber/pick-and-place: **do not exist** — copy says "plot Gerbers in KiCad" (roadmap: native)

## Sparky (Pro; server-gated at the API + metered into sparky_usage with monthly budget env-gate)

30 tools: list_blocks, find_blocks, create_block, update_block, get_block, author_block,
author_schematic, expose_pins, set_value, delete_block, list_instances, add_block, remove_block,
connect, disconnect, list_connections, remove_invalid_wires, list_nets, power_budget,
analyze_design, acknowledge, unacknowledge, list_connectors, add_connector,
**declare_connector_pins**, **set_isolation** (verifies on declare), **set_signal_class**,
**stress_test**, electrace_help, delegate (parallel sparks, optional cheaper SPARK_MODEL),
web_search.

- Context compaction (12-turn window + rolling summary), prompt-cache hygiene, narration brevity
- Multiple conversations, named from first message, markdown replies, live progress
- Provider switch (Anthropic default / OpenAI A/B), price cards per model

## Blocks & content

- 26 library blocks (functional subcircuits, CC-BY-4.0 pending license decision)
- 10 expand-to-discrete equivalents: ldo-3v3, h-bridge-1ch, ne555, comparator, buck-controller,
  boost-controller, tl431, optocoupler, opamp, tp4056 — every reducible IC in the library is
  covered (16 blocks are already fully discrete; mcu-load is flagged irreducible)
- 15 calculators (E-series snapping, block links): led-resistor, voltage-divider,
  crystal-load-capacitor, ntc-thermistor, op-amp-gain, parallel-resistor, 555-timer, rc-filter,
  ohms-law (+ Joule's-law energy), motor-winding (Kv↔Kt, rewind, wye/delta, cogging, AWG),
  current-divider, delta-wye, lc-resonance, ac-power (PF + correction sizing), ac-motor (slip/torque)
- Block pages with explainers + internal schematics; /vs/ comparison pages; llms.txt; sitemap +
  IndexNow

## Accounts, cloud, billing

- [F] Supabase auth (email+password w/ confirmation, GitHub, Google, password reset); local-only
  fallback when unconfigured
- [F] Cloud designs (graph + PCB), cross-device, localStorage as offline cache; auto-import of
  pre-signup work; user_kv settings sync
- Visibility: public / unlisted / **private [P, 403 server-side]**; DB default 'unlisted';
  RLS ownership; design DELETE endpoint
- Design cap: 10 free — server-enforced on create (autosaves exempt), client dialog + meter
  (pro-aware); Pro unlimited
- Stripe: $9/mo Pro (early-adopter price; monthly/yearly), webhook flips users.plan;
  SPARKY_PRO_EMAILS interim allowlist
- bug_reports table (service-role insert only); privacy-respecting telemetry

## Internal / not user-facing

- Shorts pipeline (shorts/): ElevenLabs River TTS with word-synced captions, multi-scene render
  stage (/shorts-stage), puppeteer+ffmpeg renderer, synthesized SFX, YouTube API upload/comment
  scripts (OAuth pending audit form)
- Headless test pattern: dev server with empty Supabase env + profile seed + puppeteer
- 117 core tests; metering/gating infra (off by default)

## Claimed-but-not-built (tracked, labeled honestly)

- Version history (Pro card: "coming soon")
- Self-serve account deletion (privacy page: "coming"; manual via email works)
- Team plan (planned)
- Native Gerber / pick-and-place export
