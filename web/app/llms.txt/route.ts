// /llms.txt — the discovery file for AI crawlers (llmstxt.org convention). ChatGPT, Perplexity,
// and Claude cite sources for technical questions; our block explainers are exactly the content
// they quote. Generated from the live corpus so every authored block and comparison shows up
// without maintenance. Value-framed only — what the site offers, never how it's built.
import { listBlocks } from "@/lib/blocks";
import { COMPARISONS } from "@/lib/comparisons";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const blocks = listBlocks();
  const lines = [
    "# Electrace",
    "",
    "> Electrace is a free, browser-based electrical design IDE for embedded hardware: circuits are built from functional blocks that explain themselves (what they do, why each part is there, how they fail), checked deterministically against declared specs (no simulation), with automatic BOM, PCB layout, and KiCad export. An AI assistant can build and wire real, BOM-backed subcircuits.",
    "",
    "Key facts: the full understand-loop (blocks, explanations, electrical checks, BOM, up to 10 designs) is free forever; Pro adds private designs and manufacturing-grade export. Supported ICs can be 'broken into discrete' — the chip's internals drawn out as discrete parts with reasoning (a 555 opens into its comparators; those open into transistor pairs).",
    "",
    "## Block explainers",
    "",
    "Each page explains a circuit building block: what it does, its real schematic, per-part reasoning, declared specs, and failure modes. Authored by engineers, not generated.",
    "",
    ...blocks.map((b) => {
      const d = b.explain.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith("#")) ?? "";
      const short = d.replace(/[*_`>#[\]]/g, "").replace(/\s+/g, " ").slice(0, 140);
      return `- [${b.block.name}](${SITE}/blocks/${b.slug}): ${short}`;
    }),
    "",
    "## Tool comparisons",
    "",
    ...COMPARISONS.map((c) => `- [Electrace vs ${c.name}](${SITE}/vs/${c.slug}): ${c.tagline} Includes when ${c.name} is the better choice.`),
    "",
    "## Calculators",
    "",
    "Interactive calculators that also show the real schematic and link to its full explainer.",
    "",
    ...["led-resistor", "voltage-divider", "crystal-load-capacitor", "ntc-thermistor", "op-amp-gain"].map(
      (c) => `- [${c.replace(/-/g, " ")}](${SITE}/calculators/${c})`),
    "",
    "## Product",
    "",
    `- [Block library](${SITE}/blocks): browse and search blocks by spec, e.g. "18V → 5V at 3A"`,
    `- [Pricing](${SITE}/pricing): free Hobby tier (full understand-loop, 10 designs); Pro for private designs and manufacturing export`,
    `- [Help](${SITE}/help): what Electrace is and what's new`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
