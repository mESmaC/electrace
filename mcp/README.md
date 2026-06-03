# Electrace context server (MCP)

Exposes the Electrace project to an agent over the [Model Context Protocol](https://modelcontextprotocol.io)
so a client like Claude Code or Claude Desktop can read, reason over, and author blocks.

## Tools

| tool | what it does |
|---|---|
| `list_blocks` | every block in the library with its interface (terminals, spec, summary) |
| `get_catalog` | the symbol/part vocabulary — pin ids + part type per symbol, and chip package families. Read before authoring a layout. |
| `get_block` | full detail on one block: interface, internal nets/parts, limits, authored explanation |
| `validate_block` | located, actionable issues for a manifest (bad pin/symbol refs, unconnected terminals, shorts). Derives the schematic from the layout first. |
| `analyze_design` | deterministic lint + per-rail current budgets + BOM for a design (example name or design JSON) |
| `author_block` | write a new/updated block — **only if it validates with no errors**. Layout-first; the schematic is derived. |

The handlers live in `tools.mjs` (transport-agnostic, smoke-tested via `npm run smoke`); `server.mjs` is the MCP wiring.

## Setup

The server imports the built core, so build it once first:

```sh
cd ../electrace && npm run build
cd ../mcp && npm install
```

**Claude Code:**

```sh
claude mcp add electrace -- node /abs/path/to/discrete/mcp/server.mjs
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "electrace": { "command": "node", "args": ["/abs/path/to/discrete/mcp/server.mjs"] }
  }
}
```

## The authoring loop

`get_catalog` (vocabulary) → emit a layout-first `block.yaml` → `validate_block` (fix located errors) →
`author_block` (writes only when clean). The schematic/nets are derived from the layout, so the agent
never hand-maintains a parallel representation.
