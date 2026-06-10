// ─────────────────────────────────────────────────────────────────────────
// Electrace canonical types — the contract everything else is built on.
// See ../../data-model.md
// ─────────────────────────────────────────────────────────────────────────

export type Unit = "V" | "A" | "W" | "Ohm" | "F" | "H" | "Hz" | "%" | string;

/** A declared quantity: a fixed `value`, and/or a `min`/`max` range. */
export interface Range {
  value?: number;
  min?: number;
  max?: number;
  unit?: Unit;
  /** On an OUTPUT terminal's `v`: the output swings with the net at this sibling terminal
   *  (e.g. a 555's `out` follows `vcc` — rail-to-rail). Resolved during net propagation. */
  follows?: string;
}

export const rmax = (r?: Range): number | undefined =>
  r ? (r.max ?? r.value) : undefined;
export const rmin = (r?: Range): number | undefined =>
  r ? (r.min ?? r.value) : undefined;

// ── Blocks (authored manifest = block.yaml) ───────────────────────────────

export type TerminalRole = "in" | "out";
export type NetType = "power" | "rail" | "gnd" | "signal";
export type GroundClass = "gnd" | "agnd" | "pgnd" | "dgnd";

/** An exposed net on a block's boundary — its interface to the rest of a design. */
export interface Terminal {
  id: string;
  role: TerminalRole;
  type: NetType;
  v?: Range;                 // declared voltage (sources declare it; inputs declare accepted range)
  i?: Range;                 // declared current (source capability; sink draw)
  polarity?: "+" | "-";
  groundClass?: GroundClass;
  sensitive?: boolean;
  external?: boolean;          // fed/terminated off-board (a connector, cable, another board) — a design
                               // needn't wire it on-board, so ERC treats it as driven, not floating.
}

export interface Limit {
  field: string;             // e.g. "vin.max"
  value: number;
  unit?: Unit;
  note: string;              // plain-language "how it dies"
}

/** A component inside a block's schematic. */
export interface Part {
  ref: string;               // "U1", "R1"
  type: string;              // "ic" | "res" | "cap" | "inductor" | "diode" | ...
  value?: string;
  part?: string;             // mpn / family
  footprint?: string;
  why?: string;              // authored reason → hover/explainer content
  polarized?: boolean;
  shielded?: boolean;
  chip?: ChipSpec;           // for an IC: its package + pinout → real PCB land pattern (all pins, named→pad)
}

/** A net inside a block's schematic. `connect` lists pins ("U1.VIN") and
 *  terminal refs ("@vin" = tie this internal net to the exposed terminal `vin`). */
export interface SchematicNet {
  name: string;
  connect: string[];
}

export interface Schematic {
  parts: Part[];
  nets: SchematicNet[];
}


/** Marks a block that transforms power (regulator), for future input-current
 *  propagation: P_in = P_out / efficiency. */
export interface Transform {
  kind: "regulator";
  efficiency: number;
}

export interface Block {
  id: string;                // "@electrace/buck-converter"
  name: string;
  version: string;           // semver
  category?: string;
  author?: string;
  license?: string;
  glyph?: string;
  glyphColor?: string;       // user-assigned accent for the block's glyph (hex); falls back to the theme accent
  topology?: "linear" | "switching";
  noisy?: boolean;
  spec?: Record<string, Range | number | string>;
  terminals: Terminal[];
  limits?: Limit[];
  transform?: Transform;
  schematic?: Schematic;
  layout?: SchematicLayout;  // the editable internal schematic: placed symbols + wires (one source for view + edit)
  irreducible?: boolean;     // silicon IS the primitive (MCU/CPU/FPGA) — a hint that it has no discrete reduction
  // explain.md is loaded alongside, not part of the manifest
  /** Galvanic-isolation groups: terminal ids in DIFFERENT groups have no conductive path through
   *  this block (an optocoupler's LED side vs its transistor side — only light crosses). Absent =
   *  all terminals conduct internally (true of nearly everything). */
  isolation?: string[][];
}

/** The editable internal schematic: predefined symbols placed on a canvas, wired pin-to-pin.
 *  Renders as the schematic AND is what the in-block editor mutates (one representation). */
export interface PlacedSymbol {
  id: string;                // instance id within the block schematic ("R1", "U1")
  type: string;              // symbol type: resistor | capacitor | inductor | diode | ground | ic | chip | ...
  ref?: string;
  value?: string;
  x: number;
  y: number;
  rot?: number;              // rotation in degrees (0 | 90 | 180 | 270), about the symbol centre
  chip?: ChipSpec;           // a parametric chip: package profile + pin count + pin-function names
}

/** A parametric chip placed in a schematic: a package profile + pin count, with optional
 *  function names per pin (so a wire to pin "1" can derive as the named net, e.g. VIN). */
export interface ChipSpec { profile: string; pins: number; names?: Record<string, string>; mpn?: string }
export interface SchematicWire { from: string; to: string; via?: [number, number][] } // "R1.2" → "U1.4" (id.pin), optional bend waypoints
export interface SchematicLayout { symbols: PlacedSymbol[]; wires: SchematicWire[] }

// ── Designs (user project = design.json) ───────────────────────────────────

/** Per-instance tweaks to a block's declared values (without forking the block). */
export interface TerminalOverride { i?: Range; v?: Range }
export interface InstanceOverrides {
  terminals?: Record<string, TerminalOverride>;
  efficiency?: number;
}

export interface BlockInstance {
  ref: string;               // "REG1"
  block: string;             // "@electrace/buck-converter@1.2.0"  (id@version)
  pos?: [number, number];
  overrides?: InstanceOverrides;
}

export interface Connection {
  from: string;              // "PWR1.vout"  (instanceRef.terminalId)
  to: string;                // "REG1.vin"
  net?: string;              // optional display name ("VBUS")
}

/** A multi-pin physical connector placed on the design (board I/O). A block terminal docked to one of
 *  its pins leaves the block boundary off-board — a connector is N off-board references as one part. */
export interface ConnectorInstance {
  ref: string;               // "J1"
  connector: string;         // connector catalog id, e.g. "hdr-2x10"
  pos?: [number, number];
}
export interface Design {
  id: string;
  name: string;
  visibility?: "public" | "unlisted" | "private"; // unlisted = link-shareable, not indexed (the free default)
  blocks: BlockInstance[];
  connections: Connection[];
  connectors?: ConnectorInstance[];
  acks?: Ack[];              // findings the user/agent marked intended (e.g. an intentional diode-OR)
  isolation?: IsolationConstraint[]; // declared galvanic-isolation requirements, checked every pass
  signals?: import("./netclasses.js").NetClassAssignment[]; // declared SI net classes, checked every pass
}

/** "These two blocks must share NO conductive path." b is a block ref, or "*" = every other block.
 *  Checked against the conduction graph (nets + intra-block paths, honouring Block.isolation groups);
 *  a violation names the bridging path. */
export interface IsolationConstraint { a: string; b: string; note?: string }

/** An acknowledged finding: a correct-but-noisy warning marked intended so it stops counting against
 *  the design. Keyed by the finding's rule + its `at` subjects, so it mutes that one occurrence only. */
export interface Ack { rule: string; at: string[]; note?: string }

// ── Resolved model (what the lint + projections operate on) ────────────────

export interface ResolvedPin {
  node: string;              // "REG1.vin"
  instance: string;          // "REG1"
  terminal: string;          // "vin"
  block: Block;
  def: Terminal;
}

export interface ResolvedNet {
  id: string;                // display name, derived
  type: NetType;
  voltage?: Range;           // from a declaring source on the net
  sources: ResolvedPin[];    // role: out
  sinks: { pin: ResolvedPin; current?: Range }[]; // role: in
  members: ResolvedPin[];
  connectorPins?: string[];  // board-I/O members ("J1.1") — connector pins ARE part of the net,
                             // and hiding them made the graph untrustworthy (agents + pin passport)
  open: boolean;             // a single unconnected terminal
  external?: boolean;        // reaches off-board (a connector pin, or a terminal marked external)
}

/** A connection whose endpoint(s) no longer exist (stale after a re-author/rename). Resolve SKIPS
 *  these instead of throwing — one dangling wire must not kill the whole analysis — and lint turns
 *  each into an actionable `connectivity/dangling-wire` finding. */
export interface InvalidConnection { from: string; to: string; missing: string[] }

export interface ResolvedInstance extends BlockInstance {
  def: Block;
}

export interface ResolvedDesign {
  design: Design;
  instances: ResolvedInstance[];
  nets: ResolvedNet[];
  invalid?: InvalidConnection[]; // stale wires skipped during resolve (→ dangling-wire findings)
}

// ── Lint ───────────────────────────────────────────────────────────────────

export type Severity = "error" | "warn" | "info" | "unknown" | "recommendation";
export type Category =
  | "connectivity" | "voltage" | "current" | "power" | "limit"
  | "polarity" | "grounding" | "thermal" | "debug" | "declaration" | "completeness";

export interface Finding {
  rule: string;              // "current/over-budget"
  severity: Severity;
  category: Category;
  at: string[];              // net ids / instance refs / "inst.terminal"
  message: string;           // conversational
  derivation?: string;       // the shown arithmetic
  fix?: { label: string };   // optional advisory
  acknowledged?: { note?: string }; // set when the user/agent marked this finding intended — muted, not counted
}

export type Rule = (rd: ResolvedDesign) => Finding[];

// ── Projections ─────────────────────────────────────────────────────────────

export interface BomRow {
  qty: number;
  type: string;
  value?: string;
  footprint?: string;
  part?: string;
  polarized?: boolean;       // electrolytic/tantalum — a distinct line from a bipolar cap of the same value
  refs: string[];            // ["REG1/U1", ...]
}

/** The whole design flattened to one netlist: every block's parts + nets, stitched
 *  across boundaries. Read-only ("Schematic view") and the basis for export. */
export interface FlatPart {
  ref: string;               // "REG1/U1" (instance/part)
  instance: string;
  type: string;
  value?: string;
  part?: string;
  footprint?: string;
  why?: string;
  polarized?: boolean;
  shielded?: boolean;
  chip?: ChipSpec;           // IC package + pinout → PCB land pattern
}

export interface FlatNet {
  name: string;
  pins: string[];            // ["REG1/U1.VIN", "PWR1/C1.1", ...] — component pins only
}

export interface FlatSchematic {
  parts: FlatPart[];
  nets: FlatNet[];
}
