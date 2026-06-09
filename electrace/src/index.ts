// Public API for the Electrace core.
export * from "./types.js";
export { resolve } from "./resolve.js";
export { lint, RULES, findingKey } from "./lint.js";
export { bom, bomCsv } from "./bom.js";
export { flatten } from "./flatten.js";
export { railBudgets } from "./budget.js";
export type { RailBudget } from "./budget.js";
export { toKicadNetlist } from "./export-kicad.js";
export type { KicadOptions } from "./export-kicad.js";
export { annotatePower } from "./power.js";
export type { PowerReport, TransformPower } from "./power.js";
export { deriveSchematicNets } from "./schematic-nets.js";
export type { SchEndpoint, SchConnection, SchNet, SchematicNets } from "./schematic-nets.js";
export { deriveBlockSchematic } from "./derive-schematic.js";
export { SYMBOL_CATALOG, PACKAGES, chipPinIds, pinsOf } from "./catalog.js";
export type { CatalogEntry, SymbolGroup } from "./catalog.js";
export { validateBlock } from "./validate.js";
export type { ValidationIssue } from "./validate.js";
export { designContext, blockContext, blockBrief } from "./context.js";
export { parseValue, parallelResistance, seriesSum, formatValue } from "./values.js";
export { schematicInsights, type InsightComponent, type Insight } from "./insights.js";
export { CONNECTOR_CATALOG, connectorPart, type ConnectorPart } from "./connectors.js";
export { authorChipLayout, authorPartLayout, buildBlockLayout, exposeChipPins, inferRoleType } from "./authoring.js";
export type { PartSpec, NetSpec } from "./authoring.js";
export type { DesignContext, BlockContext, BlockBrief } from "./context.js";
export type { ElectraceEvent, CapturedEvent } from "./events.js";
export { designReport } from "./report.js";
export { pcbProject } from "./pcb.js";
export type { PcbProject, PcbComponent, PcbPad, PcbRat } from "./pcb.js";
export { drcCheck } from "./drc.js";
export type { DrcInput, DrcViolation, DrcKind, DrcTrace, DrcPad, DrcVia, DrcComp, DrcUnrouted, DrcPoint, DrcBoard } from "./drc.js";
export { toKicadPcb } from "./export-kicad-pcb.js";
export type { KicadPcbInput, KicadComp, KicadPad, KicadTrace, KicadVia, KicadBoard } from "./export-kicad-pcb.js";
export { parseKicadFootprint } from "./kicad-footprint.js";
export type { ParsedFootprint } from "./kicad-footprint.js";
export { DISCRETE_LIBRARY, discreteEquivalentFor } from "./discrete.js";
export type { DiscreteEquivalent } from "./discrete.js";
export type { Footprint, LandPad } from "./footprints.js";
export { parseSpecQuery, findBlocks, searchBlocks } from "./spec-search.js";
export type { SpecQuery, SpecMatch } from "./spec-search.js";

import type { Block, Design, ResolvedDesign, Finding, BomRow } from "./types.js";
import { resolve } from "./resolve.js";
import { lint } from "./lint.js";
import { bom } from "./bom.js";
import { annotatePower, type PowerReport } from "./power.js";

export interface Analysis {
  resolved: ResolvedDesign;
  power: PowerReport;
  findings: Finding[];
  bom: BomRow[];
}

/** Resolve a design, propagate power, lint it, and project its BOM — the one call
 *  the app and the AI tool use. (Power runs before lint so the current rules can
 *  check regulator input rails.) */
export function analyze(design: Design, blocks: Map<string, Block>): Analysis {
  const resolved = resolve(design, blocks);
  const power = annotatePower(resolved);
  return { resolved, power, findings: lint(resolved), bom: bom(resolved) };
}
