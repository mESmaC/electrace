// Browser-safe stand-in for @/lib/footprints, aliased in tsup for the design-system bundle.
// The real module fetches /api/footprints (empty in a preview → empty state). For the design pane we
// seed a few representative land patterns so FootprintLibrary shows its populated grid; mutations no-op.
import type { Footprint } from "@electrace/core";

export interface StoredFootprint { id: string; name: string; footprint: Footprint; addedAt: number }

const SEED: StoredFootprint[] = [
  { id: "r0603", name: "R0603", addedAt: 0, footprint: { id: "R0603", kind: "smd", w: 2.6, h: 1.5, pads: [
    { num: "1", x: -0.75, y: 0, w: 0.9, h: 0.95, round: 0.2 }, { num: "2", x: 0.75, y: 0, w: 0.9, h: 0.95, round: 0.2 },
  ] } },
  { id: "sot23", name: "SOT-23", addedAt: 0, footprint: { id: "SOT-23", kind: "smd", w: 3.0, h: 3.0, pads: [
    { num: "1", x: -1.0, y: -0.95, w: 0.7, h: 0.8, round: 0.2 }, { num: "2", x: -1.0, y: 0.95, w: 0.7, h: 0.8, round: 0.2 }, { num: "3", x: 1.0, y: 0, w: 0.7, h: 0.8, round: 0.2 },
  ] } },
  { id: "soic8", name: "SOIC-8", addedAt: 0, footprint: { id: "SOIC-8", kind: "smd", w: 6.0, h: 5.2, pads: [-1.905, -0.635, 0.635, 1.905].flatMap((y, i) => [
    { num: String(i + 1), x: -2.7, y, w: 1.5, h: 0.5, round: 0.15 }, { num: String(8 - i), x: 2.7, y, w: 1.5, h: 0.5, round: 0.15 },
  ]) } },
  { id: "do41", name: "DO-41 (diode)", addedAt: 0, footprint: { id: "DO-41", kind: "tht", w: 12, h: 3, pads: [
    { num: "1", x: -5, y: 0, w: 1.8, h: 1.8, round: 1, drill: 0.9 }, { num: "2", x: 5, y: 0, w: 1.8, h: 1.8, round: 1, drill: 0.9 },
  ] } },
];

export function useFootprints(): StoredFootprint[] { return SEED; }
export async function getFootprints(): Promise<StoredFootprint[]> { return SEED; }
export async function importKicadFootprints(_files: { name: string; text: string }[]): Promise<{ added: number; failed: number }> { return { added: 0, failed: 0 }; }
export async function removeFootprint(_id: string): Promise<void> {}
