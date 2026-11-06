# Electrace

Transparent, block-based electrical engineering IDE for schematic capture, deterministic design-rule checking (DRC), power-rail propagation, and multi-layer PCB layout with KiCad export.

## Architecture

- **lectrace/** — Framework-agnostic TypeScript core engine: block definitions, typed terminals, net derivation, power propagation, deterministic DRC/lint rules, and KiCad netlist/schematic export.
- **web/** — Next.js + React + TypeScript interactive SVG schematic and multi-layer PCB editor (octolinear routing, vias, copper pours, net highlighting, and stress-test analysis).
- **mcp/** — Model Context Protocol (MCP) server exposing Electrace's design graph, rule checker, and block catalog to AI agents.