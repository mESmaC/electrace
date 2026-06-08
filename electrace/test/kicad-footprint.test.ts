import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKicadFootprint } from "../src/kicad-footprint.js";

// A real KiCad SMD footprint (roundrect pads, rotation, multi-line) — abbreviated to the essentials.
const SMD = `(footprint "D_SMAF"
  (layer "F.Cu")
  (attr smd)
  (fp_text reference "REF**" (at 0 -2) (layer "F.SilkS"))
  (fp_line (start -2 -1) (end 2 -1) (layer "F.SilkS") (width 0.12))
  (pad "1" smd roundrect (at -1.96 0 180) (size 1.6 1.7) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))
  (pad "2" smd roundrect (at 1.96 0 180) (size 1.6 1.7) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))
)`;

// A through-hole DIP (legacy `module`, rect + circle pads with drills).
const THT = `(module DIP-4 (layer F.Cu)
  (fp_text reference REF** (at 0 -2) (layer F.SilkS))
  (pad 1 thru_hole rect (at 0 0) (size 1.4 1.4) (drill 0.7) (layers *.Cu *.Mask))
  (pad 2 thru_hole circle (at 0 2.54) (size 1.4 1.4) (drill 0.7) (layers *.Cu *.Mask))
  (pad 3 thru_hole circle (at 7.62 2.54) (size 1.4 1.4) (drill 0.7) (layers *.Cu *.Mask))
  (pad 4 thru_hole circle (at 7.62 0) (size 1.4 1.4) (drill 0.7) (layers *.Cu *.Mask))
)`;

test("parses an SMD footprint (roundrect, rotation, recentred)", () => {
  const r = parseKicadFootprint(SMD);
  assert.ok(r, "should parse");
  assert.equal(r!.name, "D_SMAF");
  assert.equal(r!.footprint.kind, "smd");
  assert.equal(r!.footprint.pads.length, 2);
  // pads were at x=±1.96 around origin → stay centred (bbox centre is 0)
  assert.equal(r!.footprint.pads[0].num, "1");
  assert.equal(r!.footprint.pads[0].x, -1.96);
  assert.equal(r!.footprint.pads[1].x, 1.96);
  assert.equal(r!.footprint.pads[0].round, 0.25);
  assert.ok(r!.footprint.pads.every((p) => p.drill === undefined), "smd pads have no drill");
});

test("parses a through-hole footprint (legacy module, drills, kind=tht)", () => {
  const r = parseKicadFootprint(THT);
  assert.ok(r);
  assert.equal(r!.name, "DIP-4");
  assert.equal(r!.footprint.kind, "tht");
  assert.equal(r!.footprint.pads.length, 4);
  assert.ok(r!.footprint.pads.every((p) => p.drill === 0.7), "tht pads carry the drill");
  // recentred: the 0..7.62 / 0..2.54 span centres at (3.81, 1.27)
  assert.equal(r!.footprint.pads[0].x, -3.81);
  assert.equal(r!.footprint.pads[0].y, -1.27);
});

test("rejects non-footprint input", () => {
  assert.equal(parseKicadFootprint("(kicad_pcb (version 20221018))"), null);
  assert.equal(parseKicadFootprint("not an s-expression"), null);
  assert.equal(parseKicadFootprint("(footprint \"empty\" (layer F.Cu))"), null); // no pads
});
