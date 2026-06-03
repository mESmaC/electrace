// Bridge from the schematic world to the PCB world: project a design's flattened netlist into a
// PCB-ready model — placeable components (each with a footprint = pads in mm) and a ratsnest (the
// nets, as pad-to-pad connections). Deterministic, like the rest of the engine; the PCB editor
// consumes this as its starting state. (Accurate library footprints are a later refinement; for
// now footprints are generated to match each part's actual pins so the ratsnest is always valid.)
import { resolve } from "./resolve.js";
import { flatten } from "./flatten.js";
import { resolveFootprint } from "./footprints.js";
import type { Block, Design } from "./types.js";

export interface PcbPad { id: string; pin?: string; x: number; y: number; w: number; h: number; round?: number; drill?: number } // id = physical pad number; pin = schematic pin mapped to it. mm, relative to component origin
export interface PcbComponent { ref: string; type: string; value?: string; footprint: string; w: number; h: number; pads: PcbPad[] }
export interface PcbRat { net: string; pads: string[] } // pad keys "ref.padNum"
export interface PcbProject { components: PcbComponent[]; ratsnest: PcbRat[] }

/** Project a design into a PCB model: each part gets a real land-pattern footprint (full physical
 *  pads), and the ratsnest is the flattened netlist re-keyed from schematic pins to pad numbers. */
export function pcbProject(design: Design, blocks: Map<string, Block>): PcbProject {
  const flat = flatten(resolve(design, blocks));

  // each part's pin set = the pins of that ref that appear in the netlist
  const pinsByRef = new Map<string, Set<string>>();
  for (const net of flat.nets) {
    for (const pin of net.pins) {
      const i = pin.lastIndexOf(".");
      const ref = pin.slice(0, i), pinId = pin.slice(i + 1);
      (pinsByRef.get(ref) ?? pinsByRef.set(ref, new Set()).get(ref)!).add(pinId);
    }
  }

  const components: PcbComponent[] = [];
  const pinToPadByRef = new Map<string, Record<string, string>>();
  for (const p of flat.parts) {
    const pins = [...(pinsByRef.get(p.ref) ?? new Set(["1", "2"]))].sort();
    const { footprint, pinToPad } = resolveFootprint(p, pins);
    pinToPadByRef.set(p.ref, pinToPad);
    // invert pin→pad so each pad knows its schematic pin (the functional name, e.g. "VOUT")
    const padToPin: Record<string, string> = {};
    for (const [pin, pad] of Object.entries(pinToPad)) if (!(pad in padToPin)) padToPin[pad] = pin;
    components.push({
      ref: p.ref, type: p.type, value: p.value, footprint: footprint.id, w: footprint.w, h: footprint.h,
      pads: footprint.pads.map((pad) => ({ id: pad.num, pin: padToPin[pad.num], x: pad.x, y: pad.y, w: pad.w, h: pad.h, round: pad.round, drill: pad.drill })),
    });
  }

  // re-key the netlist from "ref.pin" → "ref.padNum" via each part's pin→pad map
  const ratsnest: PcbRat[] = flat.nets.map((n) => ({
    net: n.name,
    pads: n.pins.map((pin) => {
      const i = pin.lastIndexOf("."), ref = pin.slice(0, i), pinId = pin.slice(i + 1);
      const pad = pinToPadByRef.get(ref)?.[pinId];
      return pad ? `${ref}.${pad}` : null;
    }).filter((x): x is string => x != null),
  })).filter((r) => r.pads.length > 0);

  return { components, ratsnest };
}
