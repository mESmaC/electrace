// @electrace/ui — the Electrace design-system surface consumed by claude.ai/design.
//
// This package does NOT reimplement anything: every export below is the product's real, shipped
// component re-exported from web/app (the source of truth), plus two thin wrappers over the
// existing SYMBOLS library. Keeping it re-export-only means the design system never drifts from
// the app. See web/packages/ui/README sync notes in .design-sync/.

// ── Brand ──────────────────────────────────────────────────────────────────
export { Logo, LogoMark } from "@/app/Logo";

// ── Theme ──────────────────────────────────────────────────────────────────
export { default as ThemeToggle } from "@/app/ThemeToggle";

// ── Form primitives (the calculator field/result/preset controls) ───────────
export { Num, Out, Preset } from "@/app/calculators/ui";

// ── Status ──────────────────────────────────────────────────────────────────
export { SevChip } from "@/app/docs/checks/ui";

// ── Schematic ────────────────────────────────────────────────────────────────
export { default as NetlistView } from "@/app/editor/NetlistView";
export {
  SchematicSymbol,
  SchematicSymbolGallery,
  SYMBOL_TYPES,
  SYMBOL_GROUPS,
  type SymbolType,
  type SymbolStandard,
} from "./SchematicSymbol";

// ── Calculators (16 self-contained interactive widgets) ──────────────────────
export { default as OhmsLawCalculator } from "@/app/calculators/ohms-law/Calc";
export { default as VoltageDividerCalculator } from "@/app/calculators/voltage-divider/Calc";
export { default as LedResistorCalculator } from "@/app/calculators/led-resistor/Calc";
export { default as RcFilterCalculator } from "@/app/calculators/rc-filter/Calc";
export { default as OpAmpGainCalculator } from "@/app/calculators/op-amp-gain/Calc";
export { default as ParallelResistorCalculator } from "@/app/calculators/parallel-resistor/Calc";
export { default as CurrentDividerCalculator } from "@/app/calculators/current-divider/Calc";
export { default as LcResonanceCalculator } from "@/app/calculators/lc-resonance/Calc";
export { default as DeltaWyeCalculator } from "@/app/calculators/delta-wye/Calc";
export { default as Timer555Calculator } from "@/app/calculators/555-timer/Calc";
export { default as AcMotorCalculator } from "@/app/calculators/ac-motor/Calc";
export { default as AcPowerCalculator } from "@/app/calculators/ac-power/Calc";
export { default as CrystalLoadCapacitorCalculator } from "@/app/calculators/crystal-load-capacitor/Calc";
export { default as FilterDesignerCalculator } from "@/app/calculators/filter-designer/Calc";
export { default as MotorWindingCalculator } from "@/app/calculators/motor-winding/Calc";
export { default as NtcThermistorCalculator } from "@/app/calculators/ntc-thermistor/Calc";
