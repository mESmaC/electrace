"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent as RDragEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  ReactFlow, Background, Controls, Handle, Position, addEdge, ConnectionMode, useNodes, useEdges,
  useNodesState, useEdgesState, type Node, type Edge, type NodeProps, type Connection as RFConnection, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { analyze, railBudgets, deriveBlockSchematic, designReport, flatten, toKicadNetlist, findingKey, CONNECTOR_CATALOG, connectorPart, type Block, type Design, type Finding, type Severity, type Ack, type RailBudget, type InstanceOverrides, type NetType, type Terminal, type TerminalRole, type SchematicLayout } from "@electrace/core";
import { getUserBlocks, saveUserBlock, deleteUserBlock, isUserBlock, makeUserBlock } from "@/lib/userBlocks";
import { touchProject } from "@/lib/projects";
import { onHydrated } from "@/lib/serverSync";
import { setContextItem, registerAgentSession } from "@/lib/assistant";
import BlockSchematic from "./BlockSchematic";
import SchematicPreview from "./SchematicPreview";
import { modelToLayout, layoutToModel } from "./schematic-model";
import { track } from "@/lib/telemetry";
import { confirmDialog, promptDialog } from "@/app/ui/dialog";
import { openContextMenu } from "@/app/ui/contextMenu";
import TelemetryToggle from "./TelemetryToggle";
import SymbolStyleToggle from "./SymbolStyleToggle";
import AssistantBubble from "./AssistantBubble";
import PcbEditor from "./PcbEditor";

const NET_COLOR: Record<string, string> = {
  power: "#f7b13c", rail: "#46dca6", gnd: "#9aa6b6", signal: "#4c8dff",
};
const SEV_COLOR: Record<Severity, string> = {
  error: "#f87171", warn: "#fbbf24", recommendation: "#4c8dff", info: "#d4dae6", unknown: "#9aa3b5",
};
const SEV_ICON: Record<Severity, string> = {
  error: "✕", warn: "▲", recommendation: "💡", info: "ℹ", unknown: "○",
};
// User-assignable glyph colors for blocks; first = the default theme accent.
const GLYPH_COLORS = ["#4c8dff", "#8b6cff", "#46dca6", "#f7b13c", "#ff6c9c", "#f87171", "#38bdf8", "#9aa3b5"];
const glyphChip = (color?: string): React.CSSProperties => { const c = color || "#4c8dff"; return { color: c, borderColor: `${c}55`, background: `${c}26` }; };

interface BlockNodeData { block: Block; instanceRef: string; blockKey: string; overrides?: InstanceOverrides; [k: string]: unknown }
interface ConnectorNodeData { connectorId: string; ref: string; [k: string]: unknown }

/** Short ref prefix from a block key, e.g. "@electrace/buck-converter@1.2.0" → "BC". */
function abbrev(key: string): string {
  const id = key.slice(0, key.lastIndexOf("@"));
  const name = id.split("/").pop() ?? "blk";
  return name.split("-").map((w) => w[0]).join("").toUpperCase() || "B";
}

const RH = 22; // per-terminal row height

function BlockNode(props: NodeProps) {
  const { block, instanceRef } = props.data as unknown as BlockNodeData;
  const sel = props.selected;
  const edges = useEdges();
  const nodes = useNodes();
  const connectorIds = useMemo(() => new Set(nodes.filter((n) => n.type === "connector").map((n) => n.id)), [nodes]);
  // terminal id → "J1.2" when it's docked onto a connector pin (a hidden edge to a connector node)
  const docked = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of edges) {
      if (e.source === instanceRef && e.sourceHandle && connectorIds.has(e.target)) m.set(e.sourceHandle, `${e.target}.${e.targetHandle}`);
      else if (e.target === instanceRef && e.targetHandle && connectorIds.has(e.source)) m.set(e.targetHandle, `${e.source}.${e.sourceHandle}`);
    }
    return m;
  }, [edges, connectorIds, instanceRef]);
  const terminals = block.terminals.filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i);
  const free = terminals.filter((t) => !docked.has(t.id));
  const dockedTerms = terminals.filter((t) => docked.has(t.id));
  const undock = (terminal: string) => window.dispatchEvent(new CustomEvent("electrace:undock", { detail: { block: instanceRef, terminal } }));
  const shadow = sel ? "0 0 0 2.5px rgba(110,163,255,.95), 0 0 22px rgba(76,141,255,.6), 0 10px 24px rgba(0,0,0,.5)" : "0 8px 20px rgba(0,0,0,.4)";

  // docked terminals collapse to chips; their handles stay in the DOM (hidden) so the hidden
  // dock-edges remain valid. Click a chip to undock.
  const dockedSection = dockedTerms.length > 0 ? (
    <div className="border-t border-dashed border-[var(--color-border)] px-3 py-1.5">
      <div className="mb-1 text-[8px] uppercase tracking-wide text-[var(--color-faint)]">{dockedTerms.length} docked</div>
      <div className="flex flex-wrap gap-1">
        {dockedTerms.map((t) => (
          <button key={t.id} onClick={() => undock(t.id)} title={`${t.id} → ${docked.get(t.id)} · click to undock`}
            className="rounded bg-[var(--color-bg2)] px-1 font-mono text-[9px] text-[var(--color-link)] hover:bg-[#4a2a2e] hover:text-[#e2837e]">{t.id}→{docked.get(t.id)?.split(".")[1]}</button>
        ))}
      </div>
      <div style={{ height: 0, overflow: "hidden" }} aria-hidden>
        {dockedTerms.map((t) => (
          <Handle key={t.id} id={t.id} type={t.role === "out" ? "source" : "target"}
            position={t.role === "out" ? Position.Right : Position.Left} style={{ width: 1, height: 1, opacity: 0 }} />
        ))}
      </div>
    </div>
  ) : null;

  // Many pins → render as a QFP-style chip: terminals split across all four edges (declutters a
  // 30-pin MCU instead of a tall list). Small blocks keep the readable vertical list.
  if (free.length > 10) {
    const order = ["left", "bottom", "right", "top"] as const;
    const sides: Record<(typeof order)[number], typeof free> = { left: [], bottom: [], right: [], top: [] };
    const per = Math.ceil(free.length / 4);
    free.forEach((t, i) => sides[order[Math.min(3, Math.floor(i / per))]].push(t));
    const dim = Math.max(sides.left.length, sides.right.length, sides.top.length, sides.bottom.length, 1) * 22 + 64;
    const vertical = (s: string) => s === "left" || s === "right";
    const posOf = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };
    return (
      <div style={{ width: dim, height: dim, position: "relative", boxShadow: shadow }}
        className={`rounded-lg border-2 ${sel ? "border-[#4c8dff]" : "border-[var(--color-border-strong)]"} bg-[var(--color-surface)] text-[var(--color-text)]`}>
        <div className="pointer-events-none absolute inset-7 flex flex-col items-center justify-center text-center">
          <span className="text-base" style={block.glyphColor ? { color: block.glyphColor } : undefined}>{block.glyph ?? "▦"}</span>
          <span className="text-[11px] font-semibold leading-tight">{block.name}</span>
          <span className="text-[9px] uppercase tracking-wide text-[var(--color-faint)]">{instanceRef}</span>
        </div>
        {order.map((side) => sides[side].map((t, i, arr) => {
          const pct = `${((i + 1) / (arr.length + 1)) * 100}%`;
          const lblBase = "pointer-events-none absolute font-mono text-[8px] text-[var(--color-text)] whitespace-nowrap";
          const lbl = side === "left" ? { left: 7, top: pct, transform: "translateY(-50%)" }
            : side === "right" ? { right: 7, top: pct, transform: "translateY(-50%)" }
            : side === "top" ? { top: 8, left: pct, transform: "translate(-50%) rotate(-90deg)", transformOrigin: "left center" }
            : { bottom: 8, left: pct, transform: "translate(-50%) rotate(-90deg)", transformOrigin: "left center" };
          return (
            <Fragment key={t.id}>
              <Handle id={t.id} type={t.role === "out" ? "source" : "target"} position={posOf[side]}
                style={{ ...(vertical(side) ? { top: pct } : { left: pct }), width: 9, height: 9, background: "#454e62", border: `2px solid ${NET_COLOR[t.type]}` }} />
              <div className={lblBase} style={lbl}>{t.id}</div>
            </Fragment>
          );
        }))}
        {dockedSection && <div className="absolute left-0 right-0 rounded-b-lg bg-[var(--color-surface-2)]" style={{ top: dim }}>{dockedSection}</div>}
      </div>
    );
  }

  return (
    <div style={{ width: 210, boxShadow: shadow }}
      className={`rounded-xl border ${sel ? "border-[#4c8dff]" : "border-[var(--color-border-strong)]"} bg-[var(--color-surface-2)] text-[var(--color-text)]`}>
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <span className="grid h-6 w-6 place-items-center rounded-md border text-sm" style={glyphChip(block.glyphColor)}>{block.glyph ?? "▦"}</span>
        <span className="flex-1 text-[13px] font-semibold">{block.name}</span>
        <span className="text-[9px] uppercase tracking-wide text-[var(--color-faint)]">{instanceRef}</span>
      </div>
      <div className="px-3 pb-2 font-mono text-[11px] text-[var(--color-text)]">{block.topology ?? block.category ?? ""}</div>
      <div className="px-3 pb-2">
        <SchematicPreview blockId={block.id} layout={block.layout} />
      </div>
      <div className="border-t border-[var(--color-border)] py-1">
        {free.map((t) => {
          const out = t.role === "out";
          return (
            <div key={t.id} className="relative flex items-center gap-2 px-3" style={{ height: RH }}>
              <Handle
                id={t.id}
                type={out ? "source" : "target"}
                position={out ? Position.Right : Position.Left}
                style={{
                  top: "50%",
                  ...(out ? { right: 0, transform: "translate(50%,-50%)" } : { left: 0, transform: "translate(-50%,-50%)" }),
                  width: 10, height: 10, background: "#4e586f", border: `2px solid ${NET_COLOR[t.type]}`,
                }}
              />
              <span style={{ color: NET_COLOR[t.type] }}>●</span>
              <span className="font-mono text-[11px]">{t.id}</span>
              <span className="ml-auto text-[9px] uppercase text-[var(--color-faint)]">{t.role}</span>
            </div>
          );
        })}
        {dockedSection}
      </div>
    </div>
  );
}

function ConnectorNode(props: NodeProps) {
  const { connectorId, ref } = props.data as unknown as ConnectorNodeData;
  const sel = props.selected;
  const edges = useEdges();
  const part = connectorPart(connectorId);
  // pin id → "U1.tx" docked onto it (either edge direction)
  const dockOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of edges) {
      if (e.target === ref && e.targetHandle) m.set(e.targetHandle, `${e.source}.${e.sourceHandle}`);
      else if (e.source === ref && e.sourceHandle) m.set(e.sourceHandle, `${e.target}.${e.targetHandle}`);
    }
    return m;
  }, [edges, ref]);
  if (!part) return null;
  return (
    <div
      style={{ width: 158, boxShadow: sel ? "0 0 0 2.5px rgba(110,163,255,.95), 0 8px 20px rgba(0,0,0,.5)" : "0 8px 20px rgba(0,0,0,.4)" }}
      className={`rounded-xl border ${sel ? "border-[#4c8dff]" : "border-[var(--color-border-strong)]"} bg-[var(--color-bg)] text-[var(--color-text)]`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-2.5 pt-2 pb-1.5">
        <span className="grid h-5 w-5 place-items-center rounded border border-[#4c8dff55] bg-[#4c8dff26] text-[11px] text-[#4c8dff]">⊟</span>
        <span className="flex-1 truncate text-[11px] font-semibold">{part.name}</span>
        <span className="text-[9px] uppercase tracking-wide text-[var(--color-faint)]">{ref}</span>
      </div>
      <div className="py-1">
        {part.pins.map((pin) => {
          const d = dockOf.get(pin);
          return (
            <div key={pin} className="relative flex items-center gap-1.5 px-2.5" style={{ height: 17 }}>
              <Handle id={pin} type="target" position={Position.Left}
                style={{ left: 0, top: "50%", transform: "translate(-50%,-50%)", width: 9, height: 9, background: "#3c4658", border: `2px solid ${d ? "#4c8dff" : "#677494"}` }} />
              <span className="w-5 shrink-0 font-mono text-[9px] text-[var(--color-faint)]">{pin}</span>
              <span className="flex-1 truncate font-mono text-[9.5px]" style={{ color: d ? "#fff" : "#566177" }}>{d ?? "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nodeTypes = { block: BlockNode, connector: ConnectorNode };

/** Build React Flow nodes + edges from a design (used for initial load, localStorage
 *  restore, and import). Skips instances/connections referencing unknown blocks. */
function buildFlow(design: Design, blockMap: Map<string, Block>): { nodes: Node[]; edges: Edge[] } {
  const blockNodes: Node[] = design.blocks
    .filter((bi) => blockMap.has(bi.block))
    .map((bi) => ({
      id: bi.ref, type: "block",
      position: { x: bi.pos?.[0] ?? 0, y: bi.pos?.[1] ?? 0 },
      data: { block: blockMap.get(bi.block)!, instanceRef: bi.ref, blockKey: bi.block, overrides: bi.overrides },
    }));
  const connNodes: Node[] = (design.connectors ?? [])
    .filter((ci) => connectorPart(ci.connector))
    .map((ci) => ({
      id: ci.ref, type: "connector",
      position: { x: ci.pos?.[0] ?? 0, y: ci.pos?.[1] ?? 0 },
      data: { connectorId: ci.connector, ref: ci.ref },
    }));
  const nodes = [...blockNodes, ...connNodes];
  const connRefs = new Set(connNodes.map((n) => n.id));
  const refs = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = design.connections
    .filter((c) => refs.has(c.from.split(".")[0]) && refs.has(c.to.split(".")[0]))
    .map((c, i) => {
      const [srcRef, srcTerm] = c.from.split(".");
      const [dstRef, dstTerm] = c.to.split(".");
      const srcKey = design.blocks.find((b) => b.ref === srcRef)?.block;
      const type = (srcKey && blockMap.get(srcKey)?.terminals.find((t) => t.id === srcTerm)?.type) || "signal";
      const dock = connRefs.has(srcRef) || connRefs.has(dstRef); // dock edges are hidden (terminal lives on the connector)
      return { id: `e${i}`, source: srcRef, sourceHandle: srcTerm, target: dstRef, targetHandle: dstTerm, hidden: dock, style: { stroke: NET_COLOR[type] ?? "#4c8dff", strokeWidth: 2 } };
    });
  return { nodes, edges };
}

export default function Editor({ design, blocks, projectId }: { design: Design; blocks: Record<string, Block>; projectId?: string }) {
  // the project's display name (the SSR design is a stub; the real name arrives when we hydrate it)
  const [designName, setDesignName] = useState(design.name);
  const [acks, setAcks] = useState<Ack[]>(design.acks ?? []); // findings marked intended (muted, not counted)
  // A block's edited internal schematic (saved by the in-block editor) is the source of truth:
  // merge each saved layout, re-derive its parts/nets, and analyze against that. `mounted` keeps
  // the first (SSR) render on the authored blocks to avoid a hydration mismatch; `draftV` bumps
  // when the schematic editor autosaves so design-level lint refreshes when you pop back out.
  const [mounted, setMounted] = useState(false);
  const [draftV, setDraftV] = useState(0);
  const [userV, setUserV] = useState(0); // bumps when user blocks are created/deleted
  useEffect(() => {
    setMounted(true);
    const onSave = () => setDraftV((v) => v + 1);
    const onUserBlocks = () => setUserV((v) => v + 1); // a block's terminals changed (e.g. off-board flag)
    window.addEventListener("electrace:blocksch", onSave);
    window.addEventListener("electrace:userblocks", onUserBlocks);
    return () => { window.removeEventListener("electrace:blocksch", onSave); window.removeEventListener("electrace:userblocks", onUserBlocks); };
  }, []);

  // library blocks (build-time) + user blocks (localStorage); user blocks only exist after mount
  const userBlocks = useMemo(() => (mounted ? getUserBlocks() : {}), [mounted, userV]);
  const allBlocks = useMemo(() => ({ ...blocks, ...userBlocks }), [blocks, userBlocks]);

  const blockMap = useMemo(() => {
    const m = new Map<string, Block>();
    for (const [key, b] of Object.entries(allBlocks)) {
      let blk = b;
      if (mounted) {
        try {
          const raw = localStorage.getItem(`electrace:blocksch:${b.id}`);
          const d = raw ? JSON.parse(raw) : null;
          if (d && Array.isArray(d.syms) && d.syms.length) {
            const layout = modelToLayout(d);
            const schematic = deriveBlockSchematic(layout, b.schematic?.parts ?? []);
            // only adopt the drawing as truth once it actually exposes every declared terminal;
            // otherwise keep the authored schematic so a half-wired block doesn't break analysis
            const complete = b.terminals.every((t) => schematic.nets.some((n) => n.connect.includes(`@${t.id}`)));
            if (complete) blk = { ...b, layout, schematic };
          }
        } catch { /* keep authored block */ }
      }
      m.set(key, blk);
    }
    return m;
  }, [allBlocks, mounted, draftV]);

  const initial = useMemo(() => buildFlow(design, blockMap), [design, blockMap]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Nodes + edges are the source of truth. Derive a live design from them and re-run
  // analyze() on every change — live, deterministic checks. Connections to a removed
  // node are filtered out so transient mid-edit states stay valid.
  const designLive = useMemo(() => {
    const refs = new Set(nodes.map((n) => n.id));
    return {
      id: design.id, name: designName, visibility: design.visibility,
      blocks: nodes.filter((n) => n.type === "block").map((n) => ({
        ref: n.id, block: (n.data as BlockNodeData).blockKey,
        pos: [n.position.x, n.position.y] as [number, number],
        overrides: (n.data as BlockNodeData).overrides,
      })),
      connectors: nodes.filter((n) => n.type === "connector").map((n) => ({
        ref: n.id, connector: (n.data as ConnectorNodeData).connectorId,
        pos: [n.position.x, n.position.y] as [number, number],
      })),
      connections: edges
        .filter((e) => refs.has(e.source) && refs.has(e.target))
        .map((e) => ({ from: `${e.source}.${e.sourceHandle ?? ""}`, to: `${e.target}.${e.targetHandle ?? ""}` })),
      acks,
    };
  }, [nodes, edges, design, designName, acks]);

  const analysis = useMemo(() => {
    try {
      return analyze(designLive, blockMap);
    } catch (err) {
      return {
        resolved: { design: designLive, instances: [], nets: [] },
        power: { transforms: {} },
        bom: [],
        findings: [{ rule: "internal/error", severity: "error", category: "declaration", at: [], message: String(err) }],
      } as ReturnType<typeof analyze>;
    }
  }, [designLive, blockMap]);

  // capture the deterministic lint outcome (codes only) whenever it changes
  useEffect(() => {
    const f = analysis.findings;
    track({ kind: "design.lint", codes: f.map((x) => x.rule), errors: f.filter((x) => x.severity === "error").length, warns: f.filter((x) => x.severity === "warn").length });
  }, [analysis]);

  // Per-instance override of a terminal's voltage or current — how you declare a source (V + max A on
  // an out terminal) or a static load (draw A on an in terminal) on a placed block, so it budgets.
  const setTermVal = useCallback(
    (ref: string, term: string, field: "v" | "i", val: string) => {
      const num = parseFloat(val);
      const cell = !Number.isFinite(num) ? undefined : field === "i" ? { max: num, unit: "A" as const } : { value: num, unit: "V" as const };
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== ref) return n;
          const data = n.data as BlockNodeData;
          const terminals = { ...(data.overrides?.terminals ?? {}) };
          terminals[term] = { ...(terminals[term] ?? {}), [field]: cell };
          return { ...n, data: { ...data, overrides: { ...(data.overrides ?? {}), terminals } } };
        }),
      );
    },
    [setNodes],
  );

  // Mark a correct-but-noisy finding as intended (or un-mark): mutes it + drops it from the counts.
  const toggleAck = useCallback(async (f: Finding) => {
    const k = findingKey(f);
    if (acks.some((a) => findingKey(a) === k)) { setAcks((prev) => prev.filter((a) => findingKey(a) !== k)); return; }
    const note = (await promptDialog({ title: "Mark as intended", message: "Mute this finding with an optional note on why it's expected.", placeholder: "Reason (optional)", confirmText: "Mark intended" })) || undefined;
    setAcks((prev) => prev.some((a) => findingKey(a) === k) ? prev : [...prev, { rule: f.rule, at: f.at, note }]);
  }, [acks]);

  const budgets = useMemo(() => railBudgets(analysis.resolved), [analysis]);
  const totalW = budgets.filter((b) => b.type === "rail").reduce((a, b) => a + (b.watts ?? 0), 0);
  // A powered rail (source w/ capacity) but no declared static draw → loads are off-board or dynamic
  // (e.g. a motor bus switched onto phases). Say "0 W declared" + why, so it doesn't read as broken.
  const noStaticLoad = totalW === 0 && budgets.some((b) => b.capacityA != null);
  const powerText = noStaticLoad ? "0 W declared" : `≈${round1(totalW)} W`;
  const powerTitle = noStaticLoad ? "No static load is declared on the powered rail(s). Off-board loads (behind a connector) and dynamic loads (e.g. a motor bus switched onto phases) aren't modeled by the structural checks — declare a load to budget it." : undefined;
  const worstRail = budgets.filter((b) => b.capacityA != null).sort((a, b) => (b.usedPct ?? 0) - (a.usedPct ?? 0))[0];
  const probCount = { error: analysis.findings.filter((f) => f.severity === "error" && !f.acknowledged).length, warn: analysis.findings.filter((f) => f.severity === "warn" && !f.acknowledged).length };

  // keep a live snapshot of the design in the assistant's context window
  const designCtx = useMemo(() => {
    const lines: string[] = [`Electrace design "${designName}".`];
    const blockNodes = nodes.filter((n) => n.type === "block");
    const connNodes = nodes.filter((n) => n.type === "connector");
    lines.push(`Blocks (${blockNodes.length}): ${blockNodes.map((n) => { const b = (n.data as BlockNodeData).block; return `${n.id}=${b.name}${b.topology ? ` (${b.topology})` : ""}`; }).join("; ") || "none"}.`);
    if (connNodes.length) lines.push(`Connectors: ${connNodes.map((n) => `${n.id}=${(n.data as ConnectorNodeData).connectorId}`).join("; ")}.`);
    lines.push(`Power: ≈${round1(totalW)} W across ${analysis.resolved.nets.length} nets${worstRail ? `; worst rail ${Math.round(worstRail.usedPct ?? 0)}% used` : ""}.`);
    const nets = analysis.resolved.nets.slice(0, 24).map((n) => `${n.id} [${n.type}${n.voltage ? ` ${fmtRange(n.voltage)}` : ""}]: ${n.members.map((m) => m.node).join(", ")}`);
    if (nets.length) lines.push("Nets:\n" + nets.join("\n"));
    if (analysis.findings.length) lines.push("Checks: " + analysis.findings.slice(0, 12).map((f) => `[${f.severity}] ${f.message}`).join("; "));
    return lines.join("\n");
  }, [designName, nodes, analysis, totalW, worstRail]);
  useEffect(() => { setContextItem("design", designCtx); }, [designCtx]);
  useEffect(() => () => setContextItem("design", ""), []);

  // expose the live design + blocks to the assistant so it can read and edit them via tools
  const designLiveRef = useRef(designLive); designLiveRef.current = designLive;
  const blockMapRef = useRef(blockMap); blockMapRef.current = blockMap;
  const loadDesignRef = useRef<(d: Design, m?: Map<string, Block>) => void>(() => {});
  useEffect(() => registerAgentSession({
    getDesign: () => designLiveRef.current,
    getBlocks: () => Object.fromEntries(blockMapRef.current),
    apply: ({ design, blocks, deletedBlocks, blockSchematics }) => {
      const created = (blocks as Block[] | undefined) ?? [];
      const deleted = deletedBlocks ?? [];
      created.forEach((b) => saveUserBlock(b));          // persist new/updated user blocks
      deleted.forEach((k) => deleteUserBlock(k));        // remove deleted ones
      // authored internal schematics → write each block's editor draft (the source of truth that
      // overrides block.layout) so the chip shows in the schematic editor + hits the BOM/footprints
      (blockSchematics ?? []).forEach(({ id, layout }) => {
        try {
          localStorage.setItem(`electrace:blocksch:${id}`, JSON.stringify(layoutToModel(layout as SchematicLayout)));
          window.dispatchEvent(new CustomEvent("electrace:blocksch", { detail: id }));
        } catch { /* ignore */ }
      });
      const merged = new Map(blockMapRef.current);        // a block map valid right now (don't wait for re-render)
      created.forEach((b) => merged.set(`${b.id}@${b.version}`, b));
      deleted.forEach((k) => merged.delete(k));
      if (created.length || deleted.length) setUserV((v) => v + 1); // refresh the palette
      if (blockSchematics?.length) setDraftV((v) => v + 1);          // re-derive blocks from new drafts
      if (design) loadDesignRef.current(design as Design, merged);
    },
  }), []);
  const [stressV, setStressV] = useState(24); // what-if input voltage for the stress test
  // part-value consolidation: distinct values per passive family (from the BOM). Memoized — this filter/
  // reduce over the whole BOM otherwise re-runs on every render, including every drag tick.
  const consolidation = useMemo(() => ([["res", "Resistors"], ["cap", "Capacitors"], ["inductor", "Inductors"]] as const)
    .map(([t, label]) => {
      const rows = analysis.bom.filter((r) => r.type === t);
      const values = [...new Set(rows.map((r) => r.value).filter(Boolean) as string[])];
      return { label, distinct: values.length, qty: rows.reduce((a, r) => a + r.qty, 0), values };
    })
    .filter((c) => c.qty > 0), [analysis.bom]);
  // stress test: authored voltage limits across the design, ranked by headroom at the what-if input
  const stressLimits = useMemo(() => nodes
    .filter((n) => n.type === "block")
    .flatMap((n) => ((n.data as unknown as BlockNodeData).block.limits ?? [])
      .filter((l) => l.unit === "V" || /\bv|vin|vac/i.test(l.field))
      .map((l) => ({ ref: n.id, ...l, margin: l.value - stressV })))
    .sort((a, b) => a.margin - b.margin), [nodes, stressV]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNet, setSelectedNet] = useState<string | null>(null); // a member node "REF.term"
  const [drillRef, setDrillRef] = useState<string | null>(null);
  const [bottomOpen, setBottomOpen] = useState(true);
  type FormTerm = { id: string; role: TerminalRole; type: NetType; v?: string; i?: string };
  const [newBlock, setNewBlock] = useState<{ name: string; glyph: string; color: string; category: string; terminals: FormTerm[]; editKey?: string } | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  // strongly highlight a block: select it (blue ring), clear other selection, and animate-centre it
  const locateBlock = (blk: string) => {
    setSelectedId(blk); setSelectedNet(null);
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === blk })));
    const node = nodes.find((n) => n.id === blk), inst = rfRef.current;
    if (node && inst) inst.setCenter(node.position.x + 105, node.position.y + 70, { zoom: Math.max(inst.getZoom(), 0.85), duration: 450 });
  };
  // which block a finding points at: a direct block ref, else the source block of the net it names
  const findingBlock = (f: Finding): string | undefined => {
    for (const a of f.at) { const ref = a.split(".")[0]; if (nodes.some((n) => n.id === ref)) return ref; }
    for (const a of f.at) { const net = analysis.resolved.nets.find((n) => n.id === a); const pin = net?.sources[0] ?? net?.members[0]; if (pin) return pin.instance; }
    return undefined;
  };
  const [pcbOpen, setPcbOpen] = useState(false);
  const passportNet = selectedNet ? analysis.resolved.nets.find((n) => n.members.some((m) => m.node === selectedNet)) : undefined;
  const passportBudget = passportNet ? budgets.find((b) => b.net === passportNet.id) : undefined;
  const drilledBlock = drillRef
    ? (nodes.find((n) => n.id === drillRef)?.data as BlockNodeData | undefined)?.block
    : undefined;
  const selectedBlock = selectedId
    ? (nodes.find((n) => n.id === selectedId)?.data as BlockNodeData | undefined)?.block
    : undefined;
  const selectedOverrides = selectedId
    ? (nodes.find((n) => n.id === selectedId)?.data as BlockNodeData | undefined)?.overrides
    : undefined;
  const shownFindings = selectedId
    ? analysis.findings.filter((f) => f.at.some((a) => a === selectedId || a.startsWith(`${selectedId}.`)))
    : analysis.findings;

  const termType = useCallback(
    (ref?: string | null, term?: string | null) => {
      const node = nodes.find((n) => n.id === ref);
      const bk = node ? (node.data as BlockNodeData).blockKey : undefined;
      return bk ? blockMap.get(bk)?.terminals.find((t) => t.id === term)?.type ?? "signal" : "signal";
    },
    [nodes, blockMap],
  );

  const onConnect = useCallback(
    (params: RFConnection) => {
      const type = termType(params.source, params.sourceHandle);
      // a connection touching a connector node is a "dock": the terminal lives on the connector,
      // so the edge is hidden (no visible wire) and the block collapses that terminal to a chip.
      const dock = nodes.some((n) => n.type === "connector" && (n.id === params.target || n.id === params.source));
      setEdges((eds) => addEdge({ ...params, hidden: dock, style: { stroke: NET_COLOR[type] ?? "#4c8dff", strokeWidth: 2 } }, eds));
      track({ kind: "connect", from: `${params.source}.${params.sourceHandle}`, to: `${params.target}.${params.targetHandle}`, netType: type as NetType });
    },
    [termType, setEdges, nodes],
  );

  // place a connector on the canvas
  const addConnector = useCallback((connId: string, pos?: { x: number; y: number }) => {
    setNodes((nds) => {
      let n = 1; while (nds.some((x) => x.id === `J${n}`)) n++;
      return [...nds, { id: `J${n}`, type: "connector", position: pos ?? { x: 80 + (nds.length % 6) * 40, y: 70 + (nds.length % 6) * 40 }, data: { connectorId: connId, ref: `J${n}` } }];
    });
    track({ kind: "block.add", block: `connector:${connId}` });
  }, [setNodes]);

  // undock a terminal (from a block chip): drop the hidden dock edge for that block.terminal
  useEffect(() => {
    const onUndock = (e: Event) => {
      const { block, terminal } = (e as CustomEvent).detail as { block: string; terminal: string };
      setEdges((eds) => eds.filter((ed) => !((ed.source === block && ed.sourceHandle === terminal) || (ed.target === block && ed.targetHandle === terminal))));
    };
    window.addEventListener("electrace:undock", onUndock);
    return () => window.removeEventListener("electrace:undock", onUndock);
  }, [setEdges]);

  const addBlock = useCallback(
    (key: string, pos?: { x: number; y: number }) => {
      const block = blockMap.get(key);
      if (!block) return;
      setNodes((nds) => {
        const prefix = abbrev(key);
        let n = 1;
        while (nds.some((x) => x.id === `${prefix}${n}`)) n++;
        const ref = `${prefix}${n}`;
        return [
          ...nds,
          {
            id: ref, type: "block",
            position: pos ?? { x: 60 + (nds.length % 6) * 36, y: 50 + (nds.length % 6) * 36 },
            data: { block, instanceRef: ref, blockKey: key },
          },
        ];
      });
      track({ kind: "block.add", block: key });
    },
    [blockMap, setNodes],
  );

  const duplicateNode = useCallback((id: string) => {
    setNodes((nds) => {
      const src = nds.find((x) => x.id === id);
      if (!src || src.type !== "block") return nds;
      const key = (src.data as unknown as BlockNodeData).blockKey;
      const prefix = abbrev(key);
      let n = 1; while (nds.some((x) => x.id === `${prefix}${n}`)) n++;
      const ref = `${prefix}${n}`;
      return [...nds.map((x) => ({ ...x, selected: false })), { ...src, id: ref, selected: true, position: { x: src.position.x + 40, y: src.position.y + 40 }, data: { ...src.data, instanceRef: ref } }];
    });
  }, [setNodes]);
  const deleteNode = useCallback((id: string) => { rfRef.current?.deleteElements({ nodes: [{ id }] }); }, []);

  // themed right-click menus: on a node (open / duplicate / delete) and on empty canvas (fit / clear)
  const onNodeContextMenu = useCallback((e: ReactMouseEvent, n: Node) => {
    setSelectedId(n.id); setSelectedNet(null);
    openContextMenu(e, n.type === "block"
      ? [
          { label: "Open block", icon: "⌖", onSelect: () => setDrillRef(n.id) },
          { label: "Duplicate", icon: "⧉", onSelect: () => duplicateNode(n.id) },
          { separator: true },
          { label: "Delete", icon: "✕", danger: true, hint: "Del", onSelect: () => deleteNode(n.id) },
        ]
      : [{ label: "Delete", icon: "✕", danger: true, hint: "Del", onSelect: () => deleteNode(n.id) }]);
  }, [duplicateNode, deleteNode]);
  const onPaneContextMenu = useCallback((e: MouseEvent | ReactMouseEvent) => {
    openContextMenu(e as ReactMouseEvent, [
      { label: "Fit to view", icon: "⤢", onSelect: () => rfRef.current?.fitView({ duration: 200 }) },
      { label: "Clear selection", icon: "○", onSelect: () => { setSelectedId(null); setSelectedNet(null); } },
    ]);
  }, []);

  // drag-from-palette: drop a block/connector onto the canvas at the cursor (click still works too)
  const onCanvasDragOver = useCallback((e: RDragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }, []);
  const onCanvasDrop = useCallback((e: RDragEvent) => {
    e.preventDefault();
    const blockKey = e.dataTransfer.getData("application/electrace-block");
    const connId = e.dataTransfer.getData("application/electrace-connector");
    if (!blockKey && !connId) return;
    const pos = rfRef.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (blockKey) addBlock(blockKey, pos); else addConnector(connId, pos);
  }, [addBlock, addConnector]);

  // ── undo / redo: debounced snapshots of (nodes, edges) ────────────────────
  type Snap = { nodes: Node[]; edges: Edge[] };
  const history = useRef<Snap[]>([{ nodes: initial.nodes, edges: initial.edges }]);
  const hidx = useRef(0);
  const restoring = useRef(false);
  const [, bumpHist] = useState(0);

  useEffect(() => {
    if (restoring.current) { restoring.current = false; return; }
    const id = setTimeout(() => {
      const snap: Snap = JSON.parse(JSON.stringify({ nodes, edges }));
      if (JSON.stringify(snap) === JSON.stringify(history.current[hidx.current])) return;
      history.current = history.current.slice(0, hidx.current + 1);
      history.current.push(snap);
      hidx.current = history.current.length - 1;
      bumpHist((v) => v + 1);
    }, 350);
    return () => clearTimeout(id);
  }, [nodes, edges]);

  const restore = useCallback((snap: Snap) => {
    restoring.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    bumpHist((v) => v + 1);
  }, [setNodes, setEdges]);

  const undo = useCallback(() => { if (hidx.current > 0) { hidx.current--; restore(history.current[hidx.current]); } }, [restore]);
  const redo = useCallback(() => { if (hidx.current < history.current.length - 1) { hidx.current++; restore(history.current[hidx.current]); } }, [restore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (drillRef) return; // the schematic editor handles its own undo/redo while drilled in
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, drillRef]);

  // Gate on `mounted`: these read refs (not render state), so without it SSR and the first client
  // render can disagree on the button's `disabled` and trip a hydration mismatch. Until mounted both
  // sides render "disabled" deterministically; the real state appears after hydration.
  const canUndo = mounted && hidx.current > 0;
  const canRedo = mounted && hidx.current < history.current.length - 1;

  // ── local persistence: autosave to localStorage + export/import ───────────
  const LS_KEY = `electrace:design:${design.id}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loadedRef = useRef(false);
  const [restored, setRestored] = useState(false); // gates autosave until the saved design is loaded

  const loadDesign = useCallback((d: Design, mapOverride?: Map<string, Block>) => {
    const flow = buildFlow(d, mapOverride ?? blockMap);
    restoring.current = true;
    if (d.name) setDesignName(d.name);
    setAcks(d.acks ?? []);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    history.current = [{ nodes: flow.nodes, edges: flow.edges }];
    hidx.current = 0;
    setSelectedId(null);
    bumpHist((v) => v + 1);
  }, [blockMap, setNodes, setEdges]);
  loadDesignRef.current = loadDesign; // keep the assistant's apply() pointing at the latest

  const resetSample = useCallback(() => loadDesign(design), [loadDesign, design]);
  // wipe every saved block-schematic draft so the blocks revert to their authored versions
  // --- user-defined blocks ---
  const startNewBlock = () => setNewBlock({ name: "", glyph: "", color: GLYPH_COLORS[0], category: "", terminals: [{ id: "vin", role: "in", type: "power" }, { id: "gnd", role: "in", type: "gnd" }] });
  // Edit a block you made: re-open the same form pre-filled. Saving keeps the block's id (and its
  // drawn internal schematic) so existing instances keep resolving — only its definition changes.
  const startEditBlock = (key: string) => {
    const b = allBlocks[key];
    if (!b) return;
    setNewBlock({ name: b.name, glyph: b.glyph ?? "", color: b.glyphColor ?? GLYPH_COLORS[0], category: b.category ?? "", editKey: key, terminals: b.terminals.map((t) => ({ id: t.id, role: t.role, type: t.type, v: t.v?.value != null ? String(t.v.value) : "", i: t.i?.max != null ? String(t.i.max) : "" })) });
  };
  const createBlock = () => {
    if (!newBlock || !newBlock.name.trim()) return;
    const terms: Terminal[] = newBlock.terminals.filter((t) => t.id.trim()).map((t) => {
      const vn = parseFloat(t.v ?? ""), inum = parseFloat(t.i ?? "");
      return {
        id: t.id.trim(), role: t.role, type: t.type,
        ...(Number.isFinite(vn) ? { v: { value: vn, unit: "V" as const } } : {}),
        ...(Number.isFinite(inum) ? { i: { max: inum, unit: "A" as const } } : {}),
      };
    });
    if (!terms.length) return;
    if (newBlock.editKey && allBlocks[newBlock.editKey]) {
      const existing = allBlocks[newBlock.editKey];                  // preserve id/version/layout/schematic
      saveUserBlock({ ...existing, name: newBlock.name.trim(), glyph: newBlock.glyph.trim() || existing.glyph, glyphColor: newBlock.color, category: newBlock.category.trim() || existing.category, terminals: terms });
    } else {
      saveUserBlock(makeUserBlock({ name: newBlock.name, glyph: newBlock.glyph, glyphColor: newBlock.color, category: newBlock.category, terminals: terms }));
    }
    setNewBlock(null); setUserV((v) => v + 1);
  };
  const removeUserBlock = async (key: string) => {
    if (!(await confirmDialog({ title: "Remove this block?", message: "Removes the custom block from your palette and discards its saved schematic.", confirmText: "Remove", danger: true }))) return;
    deleteUserBlock(key); setUserV((v) => v + 1);
  };

  const resetSchematics = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!(await confirmDialog({ title: "Revert all block edits?", message: "Clears every saved block-schematic edit and reverts each block to its authored version.", confirmText: "Revert all", danger: true }))) return;
    Object.keys(localStorage).filter((k) => k.startsWith("electrace:blocksch:")).forEach((k) => localStorage.removeItem(k));
    setDraftV((v) => v + 1);
  }, []);

  // restore from localStorage once — but only after `mounted`, so user blocks are loaded into
  // blockMap. Restoring earlier would filter out user-block instances (not yet in the map), and the
  // autosave below would then persist that lossy design — silently dropping blocks on refresh.
  useEffect(() => {
    if (!mounted || loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const d = JSON.parse(raw) as Design; if (Array.isArray(d?.blocks)) loadDesign(d); }
    } catch { /* ignore */ }
    setRestored(true);
  }, [mounted, LS_KEY, loadDesign]);

  // If localStorage was empty on load (fresh browser / cleared cache) and the server hydrates this
  // design afterwards, restore it — but only while the canvas is still the empty initial stub, so we
  // never clobber edits already in progress.
  useEffect(() => onHydrated(() => {
    const live = designLiveRef.current;
    if (live.blocks.length || live.connections.length) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const d = JSON.parse(raw) as Design; if (Array.isArray(d?.blocks)) loadDesignRef.current(d); }
    } catch { /* ignore */ }
  }), [LS_KEY]);

  // keep placed blocks visually in sync with their (edited) definition. Without this, editing a
  // block's terminals doesn't refresh its node (node data holds a stale block) until you delete +
  // re-add it. blockMap is memoized, so once synced it stays stable — no churn.
  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        if (n.type !== "block") return n;
        const b = blockMap.get((n.data as BlockNodeData).blockKey);
        if (b && b !== (n.data as BlockNodeData).block) { changed = true; return { ...n, data: { ...n.data, block: b } }; }
        return n;
      });
      return changed ? next : nds;
    });
  }, [blockMap, setNodes]);

  // autosave (debounced) — gated on `restored` so the empty SSR stub never overwrites the saved design
  useEffect(() => {
    if (!restored) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(designLive));
        if (projectId) touchProject(projectId, designName); // keep the dashboard's "edited" stamp + name current
        setSavedAt(Date.now());
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(id);
  }, [restored, LS_KEY, designLive, projectId, designName]);

  const exportDesign = useCallback(() => {
    const blob = new Blob([JSON.stringify(designLive, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${designName || "design"}.design.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [designLive, designName]);

  const downloadReport = useCallback(() => {
    const md = designReport(designLive, blockMap);
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(designName || "design").replace(/\s+/g, "-").toLowerCase()}-report.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [designLive, blockMap, designName]);

  // KiCad netlist export (the schematic-side fab handoff): flatten the whole design's stitched netlist
  // and emit a KiCad .net so the design can leave Electrace for a traditional EDA flow.
  const downloadNetlist = useCallback(() => {
    const net = toKicadNetlist(flatten(analysis.resolved), { source: `${designName || "design"} (Electrace)` });
    const blob = new Blob([net], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(designName || "design").replace(/\s+/g, "-").toLowerCase()}.net`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [analysis, designName]);

  const onImportFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.text().then((txt) => { try { const d = JSON.parse(txt) as Design; if (Array.isArray(d?.blocks)) loadDesign(d); } catch { /* ignore */ } });
  }, [loadDesign]);

  // palette: split user-created from the standard library
  const libEntries = Object.entries(allBlocks).filter(([k]) => !isUserBlock(k));
  const myEntries = Object.entries(allBlocks).filter(([k]) => isUserBlock(k));
  const blockTile = (key: string, b: Block) => (
    <div key={key} className="group relative">
      <button onClick={() => addBlock(key)} draggable title={b.name}
        onDragStart={(e) => { e.dataTransfer.setData("application/electrace-block", key); e.dataTransfer.effectAllowed = "copy"; }}
        className="flex h-full w-full cursor-grab flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-center hover:border-[#4c8dff] active:cursor-grabbing">
        <span className="grid h-8 w-8 place-items-center rounded-md border text-base" style={glyphChip(b.glyphColor)}>{b.glyph ?? "▦"}</span>
        <span className="text-[10px] leading-tight text-[var(--color-text)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.name}</span>
      </button>
      {isUserBlock(key) && (
        <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
          <button onClick={() => startEditBlock(key)} title="Edit this block's name & terminals"
            className="grid h-4 w-4 place-items-center rounded bg-[var(--color-bg2)] text-[9px] text-[var(--color-faint)] hover:text-[var(--color-text)]">✎</button>
          <button onClick={() => removeUserBlock(key)} title="Delete this custom block"
            className="grid h-4 w-4 place-items-center rounded bg-[var(--color-bg2)] text-[9px] text-[var(--color-faint)] hover:text-[#e2837e]">✕</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex bg-[var(--color-bg)]" style={{ height: "calc(100vh - 56px)" }}>
      <aside className="w-60 shrink-0 overflow-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <CollapsibleSection title={`My blocks${myEntries.length ? ` (${myEntries.length})` : ""}`}
          action={<button onClick={startNewBlock} title="Create a custom block" className="rounded-md border border-[#4c8dff66] bg-[#4c8dff26] px-1.5 py-0.5 text-[10px] text-[var(--color-link)] hover:border-[#4c8dff]">+ New</button>}>
          {myEntries.length
            ? <div className="grid grid-cols-2 gap-1.5">{myEntries.map(([k, b]) => blockTile(k, b))}</div>
            : <p className="px-1 pb-1 text-[10px] text-[var(--color-border-strong)]">None yet — <button onClick={startNewBlock} className="text-[var(--color-link)] hover:underline">create one</button>.</p>}
        </CollapsibleSection>

        <CollapsibleSection title={`Library (${libEntries.length})`}>
          <div className="grid grid-cols-2 gap-1.5">{libEntries.map(([k, b]) => blockTile(k, b))}</div>
        </CollapsibleSection>

        <CollapsibleSection title="Connectors">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.values(CONNECTOR_CATALOG).map((c) => (
              <button key={c.id} onClick={() => addConnector(c.id)} title={`${c.name} · ${c.pins.length} pins`}
                draggable onDragStart={(e) => { e.dataTransfer.setData("application/electrace-connector", c.id); e.dataTransfer.effectAllowed = "copy"; }}
                className="flex cursor-grab flex-col items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-center hover:border-[#4c8dff] active:cursor-grabbing">
                <span className="grid h-8 w-8 place-items-center rounded-md border border-[#4c8dff55] bg-[#4c8dff26] text-base text-[#4c8dff]">⊟</span>
                <span className="text-[10px] leading-tight text-[var(--color-text)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.name}</span>
                <span className="font-mono text-[8px] text-[var(--color-faint)]">{c.pins.length}p</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>
        <p className="mt-3 px-1 text-[10px] text-[var(--color-faint)]">Drag (or click) onto the canvas · <span className="text-[var(--color-link)]">+ New</span> defines your own block · double-click a block to draw its schematic. Drag a terminal onto a connector pin to dock it (it leaves the block; click its chip to undock).</p>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden" onDrop={onCanvasDrop} onDragOver={onCanvasDragOver}>
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          <button onClick={resetSample} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">New</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Import</button>
          <button onClick={exportDesign} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Export</button>
          <button onClick={downloadReport} title="Generate a Markdown design report" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Report</button>
          <button onClick={downloadNetlist} title="Export a KiCad netlist (.net) of the whole stitched design" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Netlist</button>
          <button onClick={resetSchematics} title="Discard saved block-schematic edits and revert to authored versions" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11.5px] text-[var(--color-text)] hover:border-[#4c8dff]">Reset schematics</button>
          <button onClick={() => setPcbOpen(true)} title="Open the PCB layout" className="rounded-md border border-[#4c8dff66] bg-[#4c8dff26] px-2.5 py-1 text-[11.5px] text-[#4c8dff] hover:border-[#4c8dff]">PCB ↗</button>
          {savedAt && <span className="ml-1 text-[10px] text-[var(--color-faint)]">Saved ✓</span>}
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImportFile} className="hidden" />
          <SymbolStyleToggle />
          <TelemetryToggle />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-[11px] text-[var(--color-faint)]">
          Drag between ports to wire · select a wire + Delete to remove
        </div>
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <div className="pointer-events-none flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-[11px]">
            <span title={powerTitle}><span className="text-[var(--color-faint)]">Power</span> <span className="font-mono text-[var(--color-text)]">{powerText}</span>{noStaticLoad && <span className="ml-1 text-[var(--color-faint)]">ⓘ</span>}</span>
            <span className="text-[var(--color-border)]">·</span>
            <span><span className="text-[var(--color-faint)]">Blocks</span> <span className="font-mono text-[var(--color-text)]">{nodes.length}</span></span>
            <span className="text-[var(--color-border)]">·</span>
            <span><span className="text-[var(--color-faint)]">Nets</span> <span className="font-mono text-[var(--color-text)]">{analysis.resolved.nets.length}</span></span>
            {worstRail && (
              <>
                <span className="text-[var(--color-border)]">·</span>
                <span><span className="text-[var(--color-faint)]">Top rail</span> <span className="font-mono" style={{ color: barColor(worstRail.usedPct) }}>{Math.round(worstRail.usedPct ?? 0)}%</span></span>
              </>
            )}
          </div>
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">↶</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] text-[var(--color-text)] disabled:opacity-40 enabled:hover:border-[#4c8dff]">↷</button>
        </div>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} connectionMode={ConnectionMode.Loose}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={(_, n) => { setSelectedId(n.id); setSelectedNet(null); }}
          onEdgeClick={(_, e) => { setSelectedNet(`${e.source}.${e.sourceHandle}`); setSelectedId(null); }}
          onPaneClick={() => { setSelectedId(null); setSelectedNet(null); }}
          onInit={(inst) => { rfRef.current = inst; }}
          onNodeDoubleClick={(_, n) => { if (n.type !== "block") return; setDrillRef(n.id); track({ kind: "drill.in", block: (n.data as unknown as BlockNodeData).blockKey }); }} zoomOnDoubleClick={false}
          onNodeContextMenu={onNodeContextMenu} onPaneContextMenu={onPaneContextMenu}
          deleteKeyCode={drillRef ? null : ["Backspace", "Delete"]}
          fitView proOptions={{ hideAttribution: true }}
        >
          <Background color="#54607a" gap={22} />
          <Controls />
        </ReactFlow>
        <AssistantBubble />
      </div>

      {/* real-time linting / debug pane */}
      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-1 px-2">
          <button onClick={() => setBottomOpen((o) => !o)} className="flex items-center gap-1.5 border-b-2 border-[#4c8dff] px-3 py-1.5 text-[11px] text-[var(--color-text)]">
            Problems
            {(probCount.error + probCount.warn) > 0 && <span className="rounded-full bg-[var(--color-border)] px-1.5 text-[9px] text-[var(--color-text)]">{probCount.error + probCount.warn}</span>}
          </button>
          <div className="ml-auto flex items-center gap-3 px-2 font-mono text-[10px] text-[var(--color-faint)]">
            <span><span className="text-[var(--color-faint)]">nets</span> <span className="text-[var(--color-text)]">{analysis.resolved.nets.length}</span></span>
            <span><span className="text-[var(--color-faint)]">parts</span> <span className="text-[var(--color-text)]">{analysis.bom.length}</span></span>
            <span title={powerTitle}><span className="text-[var(--color-faint)]">power</span> <span className="text-[var(--color-text)]">{powerText}</span></span>
            {worstRail && <span><span className="text-[var(--color-faint)]">top rail</span> <span style={{ color: barColor(worstRail.usedPct) }}>{Math.round(worstRail.usedPct ?? 0)}%</span></span>}
            <button onClick={() => setBottomOpen((o) => !o)} className="text-[var(--color-faint)] hover:text-[var(--color-text)]" title={bottomOpen ? "Collapse" : "Expand"}>{bottomOpen ? "▾" : "▴"}</button>
          </div>
        </div>
        {bottomOpen && (
          <div className="h-40 overflow-y-auto border-t border-[var(--color-border)] bg-[var(--color-bg2)] px-2 py-1.5 text-[12px]">
            {analysis.findings.length === 0 ? (
              <div className="flex items-center gap-2 px-1.5 py-1 text-[#46dca6]">● All clear — no lint findings.</div>
            ) : (
              <ul className="space-y-0.5">
                {analysis.findings.map((f, i) => {
                  const blk = findingBlock(f);
                  const ackd = !!f.acknowledged;
                  const canAck = f.severity === "error" || f.severity === "warn";
                  return (
                    <li key={i} className="group flex items-start gap-1">
                      <button onClick={() => blk && locateBlock(blk)} disabled={!blk}
                        className={`flex min-w-0 flex-1 items-start gap-2 rounded px-1.5 py-1 text-left enabled:hover:bg-[var(--color-surface)] disabled:cursor-default ${ackd ? "opacity-50" : ""}`}>
                        <span style={{ color: ackd ? "#9aa3b5" : SEV_COLOR[f.severity] }}>{ackd ? "✓" : SEV_ICON[f.severity]}</span>
                        <span className="min-w-0 flex-1">
                          <span className={ackd ? "text-[var(--color-faint)] line-through" : "text-[var(--color-text)]"}>{f.message}</span>
                          {ackd && f.acknowledged?.note && <span className="ml-1.5 text-[10.5px] text-[#46dca6]">intended: {f.acknowledged.note}</span>}
                          {!ackd && f.derivation && <span className="ml-1.5 font-mono text-[10.5px] text-[var(--color-faint)]">— {f.derivation}</span>}
                        </span>
                        {blk && <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--color-border-strong)]">{blk} ↗</span>}
                      </button>
                      {(canAck || ackd) && (
                        <button onClick={() => toggleAck(f)} title={ackd ? "Flag this again" : "Mark this finding as intended — mutes it"}
                          className="shrink-0 self-center rounded px-1.5 py-0.5 text-[10px] text-[var(--color-border-strong)] opacity-0 hover:text-[var(--color-text)] group-hover:opacity-100">
                          {ackd ? "unmute" : "mark intended"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-1.5 border-t border-[var(--color-border)] px-1.5 pt-1.5 text-[10px] leading-snug text-[var(--color-faint)]">
              Structural checks (typed nets · budgets), not a simulation — a clean result means sane, not validated. <a href="/help" className="text-[var(--color-link)] hover:underline">what this catches →</a>
            </div>
          </div>
        )}
      </div>
      </div>

      <aside className="w-80 shrink-0 overflow-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)]">
        {passportNet && (
          <div className="mb-5 rounded-xl border border-[#4c8dff] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center gap-2">
              <span style={{ color: NET_COLOR[passportNet.type] ?? "#4c8dff" }}>●</span>
              <div className="text-sm font-semibold">{passportNet.id}</div>
              <span className="ml-auto text-[9px] uppercase tracking-wide text-[var(--color-faint)]">{passportNet.type} net</span>
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-[var(--color-text)]">{passportNet.voltage ? `≈ ${fmtRange(passportNet.voltage)}` : "voltage not declared"}</div>
            {passportBudget?.capacityA != null && (
              <div className="mt-2.5">
                <div className="flex justify-between text-[11.5px]"><span className="text-[var(--color-faint)]">Current</span><span className="font-mono text-[var(--color-text)]">{round1(passportBudget.drawA)} / {round1(passportBudget.capacityA)} A</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--color-bg)]"><div className="h-full rounded" style={{ width: `${Math.min(100, passportBudget.usedPct ?? 0)}%`, background: barColor(passportBudget.usedPct) }} /></div>
              </div>
            )}
            <div className="mt-3 border-t border-[var(--color-border)] pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Sources</div>
              {passportNet.sources.length
                ? passportNet.sources.map((s) => (
                  <div key={s.node} className="mt-1 flex justify-between text-[11.5px]"><span className="font-mono">{s.node}</span><span className="font-mono text-[var(--color-faint)]">{fmtRange(s.def.v) || "—"}</span></div>
                ))
                : <div className="mt-1 text-[11px] text-[#fbbf24]">none — open net (nothing drives it)</div>}
            </div>
            <div className="mt-3 border-t border-[var(--color-border)] pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Loads</div>
              {passportNet.sinks.length
                ? passportNet.sinks.map((s) => (
                  <div key={s.pin.node} className="mt-1 flex justify-between text-[11.5px]"><span className="font-mono">{s.pin.node}</span><span className="font-mono text-[var(--color-faint)]">{fmtRange(s.current) ? `${fmtRange(s.current)} draw` : "—"}</span></div>
                ))
                : <div className="mt-1 text-[11px] text-[var(--color-faint)]">no declared loads</div>}
            </div>
            <div className="mt-2.5 text-[10px] text-[var(--color-border-strong)]">{passportNet.members.length} terminals on this net · click a block instead to inspect it</div>
          </div>
        )}
        {selectedBlock && (
          <div className="mb-5 rounded-xl border border-[#4c8dff] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border" style={glyphChip(selectedBlock.glyphColor)}>{selectedBlock.glyph ?? "▦"}</span>
              <div>
                <div className="text-sm font-semibold">{selectedBlock.name}</div>
                <div className="font-mono text-[10px] text-[var(--color-faint)]">{selectedId}</div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {Object.entries(selectedBlock.spec ?? {}).map(([k, v]) => (
                <span key={k} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-text)]">{k} {fmtRange(v)}</span>
              ))}
            </div>
            {selectedBlock.terminals.some((t) => t.type === "power" || t.type === "rail") && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-faint)]">Power / load</div>
                <p className="mt-1 text-[10px] leading-snug text-[var(--color-faint)]">Declare a source (V + max A on an <span className="font-mono">out</span>) or a static load (draw A on an <span className="font-mono">in</span>) so it shows in the budget.</p>
                <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1.5">
                  {selectedBlock.terminals.filter((t) => t.type === "power" || t.type === "rail").map((t) => {
                    const ov = selectedOverrides?.terminals?.[t.id];
                    const vVal = ov?.v?.value ?? t.v?.value ?? "";
                    const iVal = ov?.i?.max ?? t.i?.max ?? "";
                    const fld = "w-16 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right font-mono text-[11px] text-[var(--color-text)] outline-none focus:border-[#4c8dff] placeholder:text-[var(--color-faint)]";
                    return (
                      <Fragment key={t.id}>
                        <span className="min-w-0 truncate font-mono text-[11.5px]">{t.id} <span className="text-[var(--color-faint)]">{t.role === "out" ? "src" : "load"}</span></span>
                        <input type="number" step="0.1" placeholder="V" title="Voltage" value={vVal}
                          onChange={(e) => setTermVal(selectedId!, t.id, "v", e.target.value)} className={fld} />
                        <input type="number" step="0.1" min="0" placeholder="A" title={t.role === "out" ? "Max supply current" : "Current draw"} value={iVal}
                          onChange={(e) => setTermVal(selectedId!, t.id, "i", e.target.value)} className={fld} />
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <Panel title={`Power budget · ≈${round1(totalW)} W`}>
          {budgets.length === 0
            ? <p className="mt-2 text-xs text-[var(--color-faint)]">No power rails yet.</p>
            : budgets.map((b) => <BudgetBar key={b.net} b={b} />)}
          {Object.entries(analysis.power.transforms).map(([ref, p]) => (
            <div key={ref} className="mt-2 font-mono text-[10px] text-[var(--color-faint)]">↳ {ref} draws ~{p.iIn} A from {p.vIn} V ({p.pIn} W in)</div>
          ))}
        </Panel>

        <Panel title={selectedId ? `Checks · ${selectedId}` : `Checks · ${analysis.findings.length}`}>
          {shownFindings.length === 0
            ? <p className="mt-2 text-sm text-[#46dca6]">● {selectedId ? "No issues on this block" : "All clear"}</p>
            : <div className="mt-2 space-y-2">{shownFindings.map((f, i) => <FindingCard key={i} f={f} onToggleAck={toggleAck} />)}</div>}
        </Panel>

        <Panel title={`BOM · ${analysis.bom.length}`}>
          <div className="mt-2 space-y-1 font-mono text-[11px] text-[var(--color-text)]">
            {analysis.bom.map((r, i) => (
              <div key={i}>{r.qty}× {r.value ?? r.part ?? r.type}{r.polarized && <span className="ml-1 rounded-sm bg-[#4c8dff26] px-1 text-[10px] text-[var(--color-link)]">pol</span>} <span className="text-[var(--color-faint)]">{r.refs.join(", ")}</span></div>
            ))}
          </div>
        </Panel>

        {consolidation.length > 0 && (
          <Panel title="Part values">
            <div className="mt-2 space-y-2 text-[11.5px]">
              {consolidation.map((c) => (
                <div key={c.label}>
                  <div className="text-[var(--color-text)]">{c.label}: <span className="font-mono">{c.distinct}</span> distinct {c.distinct === 1 ? "value" : "values"} across {c.qty} parts</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.values.map((v) => <span key={v} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-faint)]">{v}</span>)}
                  </div>
                </div>
              ))}
              <p className="text-[10px] leading-relaxed text-[var(--color-border-strong)]">Fewer distinct values = fewer reels and stocking mistakes. Consolidate where a block&apos;s declared envelope allows.</p>
            </div>
          </Panel>
        )}

        {stressLimits.length > 0 && (
          <Panel title="Stress test">
            <label className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-[var(--color-faint)]">Input what-if</span>
              <span className="flex items-center gap-1">
                <input type="number" step="1" min="0" value={stressV} onChange={(e) => setStressV(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right font-mono text-[11.5px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]" />
                <span className="font-mono text-[var(--color-faint)]">V</span>
              </span>
            </label>
            {(() => {
              const first = stressLimits[0];
              const tripped = first.margin < 0;
              return (
                <p className={`mt-2 text-[11.5px] leading-relaxed ${tripped ? "text-[#f87171]" : "text-[#46dca6]"}`}>
                  {tripped
                    ? `At ${stressV} V, ${first.ref}'s ${first.field} (${first.value} ${first.unit ?? "V"}) is the first to go — ${first.note}`
                    : `Holds at ${stressV} V. Tightest: ${first.ref}'s ${first.field}, ${round1(first.margin)} V of headroom.`}
                </p>
              );
            })()}
            <div className="mt-2 space-y-1">
              {stressLimits.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-[var(--color-text)]">{l.ref} · {l.field}</span>
                  <span className="font-mono" style={{ color: l.margin < 0 ? "#f87171" : l.margin < 3 ? "#fbbf24" : "#9aa3b5" }}>
                    {l.value}{l.unit ?? "V"} · {l.margin < 0 ? "over" : `+${round1(l.margin)}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-border-strong)]">Reads authored limit notes against your what-if input — not a simulation. A guided tour of how the design dies.</p>
          </Panel>
        )}
      </aside>

      {/* PCB layout — full-screen over the whole design editor */}
      {pcbOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#222a38]">
          <PcbEditor design={designLive} blocks={blockMap} onClose={() => setPcbOpen(false)} />
        </div>
      )}

      {/* Block schematic editor — full-screen over the whole design editor while drilled in */}
      {drillRef && drilledBlock && (
        <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[var(--color-bg)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2 text-sm">
            <button onClick={() => setDrillRef(null)} className="text-[var(--color-faint)] hover:text-[var(--color-text)]">← {designName}</button>
            <span className="text-[var(--color-border-strong)]">/</span>
            <span className="font-semibold">{drillRef} — {drilledBlock.name}</span>
            <span className="ml-2 text-[11px] text-[var(--color-faint)]">internal schematic · drag symbols, wire pins</span>
          </div>
          <div className="min-h-0 flex-1">
            <BlockSchematic blockId={drilledBlock.id} initial={drilledBlock.layout} terminals={drilledBlock.terminals} block={drilledBlock} />
          </div>
        </div>
      )}

      {/* create a custom block */}
      {newBlock && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 p-4" onClick={() => setNewBlock(null)}>
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-[14px] font-semibold">{newBlock.editKey ? "Edit block" : "New block"}</h3>
            <div className="mb-3 flex gap-2">
              <label className="flex-1 text-[11px] text-[var(--color-faint)]">Name
                <input autoFocus value={newBlock.name} onChange={(e) => setNewBlock({ ...newBlock, name: e.target.value })} placeholder="e.g. Sensor frontend"
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]" />
              </label>
              <label className="w-16 text-[11px] text-[var(--color-faint)]">Glyph
                <input value={newBlock.glyph} onChange={(e) => setNewBlock({ ...newBlock, glyph: e.target.value.slice(0, 2) })} placeholder="▦"
                  className="mt-1 w-full rounded-md border text-center text-[14px] outline-none focus:border-[#4c8dff]" style={{ ...glyphChip(newBlock.color), paddingTop: 6, paddingBottom: 6 }} />
              </label>
            </div>
            <label className="mb-3 block text-[11px] text-[var(--color-faint)]">Glyph color
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {GLYPH_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewBlock({ ...newBlock, color: c })} title={c}
                    className={`h-6 w-6 rounded-full border-2 transition ${newBlock.color.toLowerCase() === c ? "border-white" : "border-transparent hover:border-[var(--color-faint)]"}`}
                    style={{ background: c }} />
                ))}
                <label className="relative ml-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-[var(--color-border)] text-[10px] text-[var(--color-faint)] hover:border-[#4c8dff]" title="Custom color">
                  <span style={{ color: newBlock.color }}>●</span>
                  <input type="color" value={newBlock.color} onChange={(e) => setNewBlock({ ...newBlock, color: e.target.value })} className="absolute h-0 w-0 opacity-0" />
                </label>
              </div>
            </label>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-faint)]">Terminals</span>
              <button onClick={() => setNewBlock({ ...newBlock, terminals: [...newBlock.terminals, { id: "", role: "in", type: "signal" }] })}
                className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-link)] hover:border-[#4c8dff]">+ terminal</button>
            </div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {newBlock.terminals.map((t, i) => {
                const set = (patch: Partial<FormTerm>) => setNewBlock({ ...newBlock, terminals: newBlock.terminals.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <input value={t.id} onChange={(e) => set({ id: e.target.value })} placeholder="name"
                      className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono text-[11px] text-[var(--color-text)] outline-none focus:border-[#4c8dff]" />
                    <select value={t.role} onChange={(e) => set({ role: e.target.value as TerminalRole })} style={{ colorScheme: "dark" }}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-1 text-[11px] text-[var(--color-text)] outline-none">
                      <option value="in">in</option><option value="out">out</option>
                    </select>
                    <select value={t.type} onChange={(e) => set({ type: e.target.value as NetType })} style={{ colorScheme: "dark" }}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-1 text-[11px] text-[var(--color-text)] outline-none">
                      <option value="power">power</option><option value="rail">rail</option><option value="signal">signal</option><option value="gnd">gnd</option>
                    </select>
                    {(t.type === "power" || t.type === "rail") && (<>
                      <input value={t.v ?? ""} onChange={(e) => set({ v: e.target.value })} placeholder="V" title={t.role === "out" ? "Output voltage" : "Accepted voltage"} inputMode="decimal"
                        className="w-11 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-1 text-right font-mono text-[11px] text-[var(--color-text)] outline-none focus:border-[#4c8dff] placeholder:text-[var(--color-faint)]" />
                      <input value={t.i ?? ""} onChange={(e) => set({ i: e.target.value })} placeholder="A" title={t.role === "out" ? "Max supply current" : "Current draw"} inputMode="decimal"
                        className="w-11 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-1 text-right font-mono text-[11px] text-[var(--color-text)] outline-none focus:border-[#4c8dff] placeholder:text-[var(--color-faint)]" />
                    </>)}
                    <button onClick={() => setNewBlock({ ...newBlock, terminals: newBlock.terminals.filter((_, j) => j !== i) })}
                      className="grid h-6 w-6 place-items-center rounded text-[var(--color-faint)] hover:bg-[#3a1c20] hover:text-[#e2837e]">✕</button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNewBlock(null)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-text)] hover:border-[#4c8dff]">Cancel</button>
              <button onClick={createBlock} disabled={!newBlock.name.trim() || !newBlock.terminals.some((t) => t.id.trim())}
                className="rounded-md bg-[#4c8dff] px-3 py-1.5 text-[12px] text-white disabled:opacity-40">{newBlock.editKey ? "Save changes" : "Create block"}</button>
            </div>
            <p className="mt-3 text-[10px] leading-snug text-[var(--color-faint)]">{newBlock.editKey ? "Editing keeps the block's id and drawn schematic; renaming or removing a terminal may leave existing connections to it dangling." : "After creating, click it in the palette to drop it on the canvas, then double-click to draw its internal schematic."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, action, defaultOpen = true, children }: { title: string; action?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)] hover:text-[var(--color-text)]">
          <span className="inline-block w-2 text-[8px]">{open ? "▾" : "▸"}</span>{title}
        </button>
        {action}
      </div>
      {open && children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">{title}</h2>
      {children}
    </section>
  );
}

function FindingCard({ f, onToggleAck }: { f: Finding; onToggleAck?: (f: Finding) => void }) {
  const ackd = !!f.acknowledged;
  const canAck = f.severity === "error" || f.severity === "warn";
  return (
    <div className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs ${ackd ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <div className={`flex-1 font-semibold ${ackd ? "line-through" : ""}`} style={{ color: ackd ? "#9aa3b5" : SEV_COLOR[f.severity] }}>{ackd ? "✓" : SEV_ICON[f.severity]} {f.message}</div>
        {onToggleAck && (canAck || ackd) && (
          <button onClick={() => onToggleAck(f)} title={ackd ? "Flag this again" : "Mark intended — mutes it"}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-[var(--color-faint)] hover:text-[var(--color-text)]">{ackd ? "unmute" : "intended?"}</button>
        )}
      </div>
      {ackd && f.acknowledged?.note && <div className="mt-1 text-[11px] text-[#46dca6]">intended: {f.acknowledged.note}</div>}
      {!ackd && f.derivation && <div className="mt-1 font-mono text-[11px] text-[var(--color-text)]">{f.derivation}</div>}
    </div>
  );
}

function BudgetBar({ b }: { b: RailBudget }) {
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5">
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-mono">{b.net}{b.voltage != null ? ` · ${b.voltage} V` : ""}</span>
        <span className="text-[var(--color-text)]">{b.capacityA != null ? `${b.drawA} / ${b.capacityA} A` : `${b.drawA} A`}</span>
      </div>
      {b.capacityA != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-[var(--color-bg)]">
          <div className="h-full rounded" style={{ width: `${Math.min(100, b.usedPct ?? 0)}%`, background: barColor(b.usedPct) }} />
        </div>
      )}
      {b.watts != null && (
        <div className="mt-1 text-[10px] text-[var(--color-faint)]">
          {b.watts} W{b.headroomA != null ? ` · ${b.headroomA} A spare` : " · no source"}
        </div>
      )}
    </div>
  );
}

function barColor(pct?: number): string {
  if (pct == null) return "#4c8dff";
  if (pct > 100) return "#f87171";
  if (pct >= 85) return "#fbbf24";
  return "#46dca6";
}
function round1(n: number): number { return Math.round(n * 10) / 10; }
function fmtRange(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const r = v as { value?: number; min?: number; max?: number; unit?: string };
    const u = r.unit ? ` ${r.unit}` : "";
    if (r.value != null) return `${r.value}${u}`;
    if (r.min != null || r.max != null) return `${r.min ?? "?"}–${r.max ?? "?"}${u}`;
  }
  return "";
}
