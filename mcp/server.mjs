#!/usr/bin/env node
// Electrace context server (MCP over stdio).
// Exposes the project — its block library, the symbol catalog, deterministic validation/analysis,
// and block authoring — as tools any MCP client (Claude Desktop / Claude Code) can call. The
// handlers live in tools.mjs; this file is just the MCP wiring.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as tools from "./tools.mjs";

const server = new McpServer({ name: "electrace", version: "0.1.0" });

/** Wrap a handler: run it, return its result as pretty JSON; report errors as tool errors. */
const wrap = (fn) => async (args) => {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await fn(args ?? {}), null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
  }
};

server.registerTool("list_blocks",
  { description: "List every block in the library with its interface (terminals, spec, one-line summary).", inputSchema: {} },
  wrap(() => tools.listBlocks()));

server.registerTool("get_catalog",
  { description: "The symbol/part vocabulary: each symbol type's pin ids + part type, and chip package families. Read this before authoring a block layout.", inputSchema: {} },
  wrap(() => tools.getCatalog()));

server.registerTool("get_block",
  { description: "Full detail on one block: interface, internal nets/parts, limits, and authored explanation.", inputSchema: { id: z.string().describe("block id, slug, or id@version") } },
  wrap(tools.getBlock));

server.registerTool("validate_block",
  { description: "Validate a block manifest (YAML or JSON). Returns located, actionable issues — bad pin/symbol refs, unconnected terminals, shorts. Derives the schematic from the layout first.", inputSchema: { manifest: z.string().describe("block.yaml contents (or a JSON manifest)") } },
  wrap(({ manifest }) => tools.validateBlockManifest({ manifest })));

server.registerTool("analyze_design",
  { description: "Run the deterministic engine over a design: lint findings, per-rail current budgets, and BOM. Pass an example name (e.g. \"buck-supply\") or a full design JSON.", inputSchema: { design: z.string().describe("example name or design JSON") } },
  wrap(({ design }) => tools.analyzeDesign({ design })));

server.registerTool("author_block",
  { description: "Write a new/updated block to the library — but only if it validates with no errors. Provide the block.yaml as a layout-first manifest; the schematic is derived. Returns the path or the blocking issues.", inputSchema: { slug: z.string(), manifest: z.string().describe("block.yaml contents"), explain: z.string().optional().describe("explain.md prose") } },
  wrap(tools.authorBlock));

await server.connect(new StdioServerTransport());
