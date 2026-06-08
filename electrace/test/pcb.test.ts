import { test } from "node:test";
import assert from "node:assert/strict";
import { authorChipLayout, deriveBlockSchematic, pcbProject } from "../src/index.js";
import type { Block, Design } from "../src/index.js";

test("pcbProject: connectors land on the board and their nets connect both ends", () => {
  const { layout, terminals } = authorChipLayout("U1",
    { profile: "qfn", pins: 32, mpn: "DRV8323", names: { "1": "VM", "2": "GND", "10": "PHA" } },
    ["VM", "GND", "PHA"]);
  const drv: Block = { id: "@user/drv", name: "DRV", version: "1.0.0", terminals, layout, schematic: deriveBlockSchematic(layout) };
  const design: Design = {
    id: "d", name: "t",
    blocks: [{ ref: "GD1", block: "@user/drv@1.0.0" }],
    connectors: [{ ref: "J_M1", connector: "screw-3" }, { ref: "J_CTRL", connector: "hdr-2x20" }],
    connections: [{ from: "GD1.PHA", to: "J_M1.1" }, { from: "GD1.GND", to: "J_CTRL.40" }, { from: "GD1.VM", to: "J_CTRL.1" }],
  };
  const pcb = pcbProject(design, new Map([["@user/drv@1.0.0", drv]]));

  // the connectors are real board components (not dropped)
  const j1 = pcb.components.find((c) => c.ref === "J_M1");
  const jc = pcb.components.find((c) => c.ref === "J_CTRL");
  assert.ok(j1 && jc, "both connectors land on the board");
  assert.equal(j1!.pads.length, 3, "screw-3 has 3 pads");
  assert.equal(jc!.pads.length, 40, "hdr-2x20 has all 40 pads");
  assert.equal(jc!.footprint, "HDR-2x20", "a 2x20 header is a 2-row grid, not a giant single row");

  // every ratsnest net connects BOTH ends (the chip pad AND the connector pad) — no orphan nets
  assert.ok(pcb.ratsnest.length > 0);
  assert.equal(pcb.ratsnest.filter((r) => r.pads.length < 2).length, 0, "no single-pad (dangling) nets");
  const pha = pcb.ratsnest.find((r) => r.pads.some((p) => p.startsWith("J_M1.")));
  assert.ok(pha && pha.pads.some((p) => p.startsWith("GD1/U1.")), "PHA net joins the chip pad to the connector pad");
});
