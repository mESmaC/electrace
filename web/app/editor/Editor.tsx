"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ReactFlow, Background, Controls, Handle, Position, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type NodeProps, type Connection as RFConnection, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { analyze, railBudgets, deriveBlockSchematic, designReport, type Block, type Design, type Finding, type Severity, type RailBudget, type InstanceOverrides, type NetType } from "@electrace/core";
import BlockSchematic from "./BlockSchematic";
import SchematicPreview from "./SchematicPreview";
import { modelToLayout } from "./schematic-model";
import { track } from "@/lib/telemetry";
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

interface BlockNodeData { block: Block; instanceRef: string; blockKey: string; overrides?: InstanceOverrides; [k: string]: unknown }

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
  return (
    <div
      style={{ width: 210, boxShadow: sel ? "0 0 0 2.5px rgba(110,163,255,.95), 0 0 22px rgba(76,141,255,.6), 0 10px 24px rgba(0,0,0,.5)" : "0 8px 20px rgba(0,0,0,.4)" }}
      className={`rounded-xl border ${sel ? "border-[#4c8dff]" : "border-[#677494]"} bg-[#4e586f] text-[#ffffff]`}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-[#4c8dff55] bg-[#4c8dff26] text-sm text-[#4c8dff]">{block.glyph ?? "▦"}</span>
        <span className="flex-1 text-[13px] font-semibold">{block.name}</span>
        <span className="text-[9px] uppercase tracking-wide text-[#9aa3b5]">{instanceRef}</span>
      </div>
      <div className="px-3 pb-2 font-mono text-[11px] text-white">{block.topology ?? block.category ?? ""}</div>
      <div className="px-3 pb-2">
        <SchematicPreview blockId={block.id} layout={block.layout} />
      </div>
      <div className="border-t border-[#54607a] py-1">
        {block.terminals.map((t) => {
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
              <span className="ml-auto text-[9px] uppercase text-[#9aa3b5]">{t.role}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nodeTypes = { block: BlockNode };

/** Build React Flow nodes + edges from a design (used for initial load, localStorage
 *  restore, and import). Skips instances/connections referencing unknown blocks. */
function buildFlow(design: Design, blockMap: Map<string, Block>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = design.blocks
    .filter((bi) => blockMap.has(bi.block))
    .map((bi) => ({
      id: bi.ref, type: "block",
      position: { x: bi.pos?.[0] ?? 0, y: bi.pos?.[1] ?? 0 },
      data: { block: blockMap.get(bi.block)!, instanceRef: bi.ref, blockKey: bi.block, overrides: bi.overrides },
    }));
  const refs = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = design.connections
    .filter((c) => refs.has(c.from.split(".")[0]) && refs.has(c.to.split(".")[0]))
    .map((c, i) => {
      const [srcRef, srcTerm] = c.from.split(".");
      const [dstRef, dstTerm] = c.to.split(".");
      const srcKey = design.blocks.find((b) => b.ref === srcRef)?.block;
      const type = (srcKey && blockMap.get(srcKey)?.terminals.find((t) => t.id === srcTerm)?.type) || "signal";
      return { id: `e${i}`, source: srcRef, sourceHandle: srcTerm, target: dstRef, targetHandle: dstTerm, style: { stroke: NET_COLOR[type] ?? "#4c8dff", strokeWidth: 2 } };
    });
  return { nodes, edges };
}

export default function Editor({ design, blocks }: { design: Design; blocks: Record<string, Block> }) {
  // A block's edited internal schematic (saved by the in-block editor) is the source of truth:
  // merge each saved layout, re-derive its parts/nets, and analyze against that. `mounted` keeps
  // the first (SSR) render on the authored blocks to avoid a hydration mismatch; `draftV` bumps
  // when the schematic editor autosaves so design-level lint refreshes when you pop back out.
  const [mounted, setMounted] = useState(false);
  const [draftV, setDraftV] = useState(0);
  useEffect(() => {
    setMounted(true);
    const onSave = () => setDraftV((v) => v + 1);
    window.addEventListener("electrace:blocksch", onSave);
    return () => window.removeEventListener("electrace:blocksch", onSave);
  }, []);

  const blockMap = useMemo(() => {
    const m = new Map<string, Block>();
    for (const [key, b] of Object.entries(blocks)) {
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
  }, [blocks, mounted, draftV]);

  const initial = useMemo(() => buildFlow(design, blockMap), [design, blockMap]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Nodes + edges are the source of truth. Derive a live design from them and re-run
  // analyze() on every change — live, deterministic checks. Connections to a removed
  // node are filtered out so transient mid-edit states stay valid.
  const designLive = useMemo(() => {
    const refs = new Set(nodes.map((n) => n.id));
    return {
      id: design.id, name: design.name, visibility: design.visibility,
      blocks: nodes.map((n) => ({
        ref: n.id, block: (n.data as BlockNodeData).blockKey,
        pos: [n.position.x, n.position.y] as [number, number],
        overrides: (n.data as BlockNodeData).overrides,
      })),
      connections: edges
        .filter((e) => refs.has(e.source) && refs.has(e.target))
        .map((e) => ({ from: `${e.source}.${e.sourceHandle ?? ""}`, to: `${e.target}.${e.targetHandle ?? ""}` })),
    };
  }, [nodes, edges, design]);

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

  const setTermCurrent = useCallback(
    (ref: string, term: string, val: string) => {
      const num = parseFloat(val);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== ref) return n;
          const data = n.data as BlockNodeData;
          const terminals = { ...(data.overrides?.terminals ?? {}) };
          terminals[term] = { ...(terminals[term] ?? {}), i: Number.isFinite(num) ? { max: num, unit: "A" } : undefined };
          return { ...n, data: { ...data, overrides: { ...(data.overrides ?? {}), terminals } } };
        }),
      );
    },
    [setNodes],
  );

  const budgets = useMemo(() => railBudgets(analysis.resolved), [analysis]);
  const totalW = budgets.filter((b) => b.type === "rail").reduce((a, b) => a + (b.watts ?? 0), 0);
  const worstRail = budgets.filter((b) => b.capacityA != null).sort((a, b) => (b.usedPct ?? 0) - (a.usedPct ?? 0))[0];
  const probCount = { error: analysis.findings.filter((f) => f.severity === "error").length, warn: analysis.findings.filter((f) => f.severity === "warn").length };
  const [stressV, setStressV] = useState(24); // what-if input voltage for the stress test
  // part-value consolidation: distinct values per passive family (from the BOM)
  const consolidation = ([["res", "Resistors"], ["cap", "Capacitors"], ["inductor", "Inductors"]] as const)
    .map(([t, label]) => {
      const rows = analysis.bom.filter((r) => r.type === t);
      const values = [...new Set(rows.map((r) => r.value).filter(Boolean) as string[])];
      return { label, distinct: values.length, qty: rows.reduce((a, r) => a + r.qty, 0), values };
    })
    .filter((c) => c.qty > 0);
  // stress test: authored voltage limits across the design, ranked by headroom at the what-if input
  const stressLimits = nodes
    .flatMap((n) => ((n.data as unknown as BlockNodeData).block.limits ?? [])
      .filter((l) => l.unit === "V" || /\bv|vin|vac/i.test(l.field))
      .map((l) => ({ ref: n.id, ...l, margin: l.value - stressV })))
    .sort((a, b) => a.margin - b.margin);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNet, setSelectedNet] = useState<string | null>(null); // a member node "REF.term"
  const [drillRef, setDrillRef] = useState<string | null>(null);
  const [bottomOpen, setBottomOpen] = useState(true);
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
      setEdges((eds) => addEdge({ ...params, style: { stroke: NET_COLOR[type] ?? "#4c8dff", strokeWidth: 2 } }, eds));
      track({ kind: "connect", from: `${params.source}.${params.sourceHandle}`, to: `${params.target}.${params.targetHandle}`, netType: type as NetType });
    },
    [termType, setEdges],
  );

  const addBlock = useCallback(
    (key: string) => {
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
            position: { x: 60 + (nds.length % 6) * 36, y: 50 + (nds.length % 6) * 36 },
            data: { block, instanceRef: ref, blockKey: key },
          },
        ];
      });
      track({ kind: "block.add", block: key });
    },
    [blockMap, setNodes],
  );

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

  const canUndo = hidx.current > 0;
  const canRedo = hidx.current < history.current.length - 1;

  // ── local persistence: autosave to localStorage + export/import ───────────
  const LS_KEY = `electrace:design:${design.id}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loadedRef = useRef(false);

  const loadDesign = useCallback((d: Design) => {
    const flow = buildFlow(d, blockMap);
    restoring.current = true;
    setNodes(flow.nodes);
    setEdges(flow.edges);
    history.current = [{ nodes: flow.nodes, edges: flow.edges }];
    hidx.current = 0;
    setSelectedId(null);
    bumpHist((v) => v + 1);
  }, [blockMap, setNodes, setEdges]);

  const resetSample = useCallback(() => loadDesign(design), [loadDesign, design]);
  // wipe every saved block-schematic draft so the blocks revert to their authored versions
  const resetSchematics = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Clear all saved block-schematic edits and revert every block to its authored version?")) return;
    Object.keys(localStorage).filter((k) => k.startsWith("electrace:blocksch:")).forEach((k) => localStorage.removeItem(k));
    setDraftV((v) => v + 1);
  }, []);

  // restore from localStorage once, post-hydration (avoids SSR mismatch)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const d = JSON.parse(raw) as Design; if (Array.isArray(d?.blocks)) loadDesign(d); }
    } catch { /* ignore */ }
  }, [LS_KEY, loadDesign]);

  // autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(designLive)); setSavedAt(Date.now()); } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(id);
  }, [LS_KEY, designLive]);

  const exportDesign = useCallback(() => {
    const blob = new Blob([JSON.stringify(designLive, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${design.name || "design"}.design.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [designLive, design.name]);

  const downloadReport = useCallback(() => {
    const md = designReport(designLive, blockMap);
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(design.name || "design").replace(/\s+/g, "-").toLowerCase()}-report.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [designLive, blockMap, design.name]);

  const onImportFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file.text().then((txt) => { try { const d = JSON.parse(txt) as Design; if (Array.isArray(d?.blocks)) loadDesign(d); } catch { /* ignore */ } });
  }, [loadDesign]);

  return (
    <div className="relative flex" style={{ height: "calc(100vh - 56px)" }}>
      <aside className="w-56 shrink-0 overflow-auto border-r border-[#54607a] bg-[#454e62] p-3">
        <h2 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#9aa3b5]">Blocks</h2>
        <div className="space-y-1.5">
          {Object.entries(blocks).map(([key, b]) => (
            <button
              key={key}
              onClick={() => addBlock(key)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-[#54607a] bg-[#4e586f] px-2.5 py-2 text-left hover:border-[#4c8dff]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md border border-[#4c8dff55] bg-[#4c8dff26] text-sm text-[#4c8dff]">{b.glyph ?? "▦"}</span>
              <span className="text-[12.5px] text-[#ffffff]">{b.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 px-1 text-[10px] text-[#9aa3b5]">Click to add to the canvas · select a block + Delete to remove.</p>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          <button onClick={resetSample} className="rounded-md border border-[#54607a] bg-[#454e62] px-2.5 py-1 text-[11.5px] text-white hover:border-[#4c8dff]">New</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-md border border-[#54607a] bg-[#454e62] px-2.5 py-1 text-[11.5px] text-white hover:border-[#4c8dff]">Import</button>
          <button onClick={exportDesign} className="rounded-md border border-[#54607a] bg-[#454e62] px-2.5 py-1 text-[11.5px] text-white hover:border-[#4c8dff]">Export</button>
          <button onClick={downloadReport} title="Generate a Markdown design report" className="rounded-md border border-[#54607a] bg-[#454e62] px-2.5 py-1 text-[11.5px] text-white hover:border-[#4c8dff]">Report</button>
          <button onClick={resetSchematics} title="Discard saved block-schematic edits and revert to authored versions" className="rounded-md border border-[#54607a] bg-[#454e62] px-2.5 py-1 text-[11.5px] text-white hover:border-[#4c8dff]">Reset schematics</button>
          <button onClick={() => setPcbOpen(true)} title="Open the PCB layout" className="rounded-md border border-[#4c8dff66] bg-[#4c8dff26] px-2.5 py-1 text-[11.5px] text-[#4c8dff] hover:border-[#4c8dff]">PCB ↗</button>
          {savedAt && <span className="ml-1 text-[10px] text-[#9aa3b5]">Saved ✓</span>}
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImportFile} className="hidden" />
          <SymbolStyleToggle />
          <TelemetryToggle />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-[#54607a] bg-[#454e62]/80 px-3 py-1.5 text-[11px] text-[#9aa3b5]">
          Drag between ports to wire · select a wire + Delete to remove
        </div>
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <div className="pointer-events-none flex items-center gap-3 rounded-md border border-[#54607a] bg-[#454e62]/90 px-3 py-1.5 text-[11px]">
            <span><span className="text-[#9aa3b5]">Power</span> <span className="font-mono text-white">≈{round1(totalW)} W</span></span>
            <span className="text-[#54607a]">·</span>
            <span><span className="text-[#9aa3b5]">Blocks</span> <span className="font-mono text-white">{nodes.length}</span></span>
            <span className="text-[#54607a]">·</span>
            <span><span className="text-[#9aa3b5]">Nets</span> <span className="font-mono text-white">{analysis.resolved.nets.length}</span></span>
            {worstRail && (
              <>
                <span className="text-[#54607a]">·</span>
                <span><span className="text-[#9aa3b5]">Top rail</span> <span className="font-mono" style={{ color: barColor(worstRail.usedPct) }}>{Math.round(worstRail.usedPct ?? 0)}%</span></span>
              </>
            )}
          </div>
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[#54607a] bg-[#454e62] text-[15px] text-white disabled:opacity-40 enabled:hover:border-[#4c8dff]">↶</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
            className="grid h-8 w-8 place-items-center rounded-md border border-[#54607a] bg-[#454e62] text-[15px] text-white disabled:opacity-40 enabled:hover:border-[#4c8dff]">↷</button>
        </div>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={(_, n) => { setSelectedId(n.id); setSelectedNet(null); }}
          onEdgeClick={(_, e) => { setSelectedNet(`${e.source}.${e.sourceHandle}`); setSelectedId(null); }}
          onPaneClick={() => { setSelectedId(null); setSelectedNet(null); }}
          onInit={(inst) => { rfRef.current = inst; }}
          onNodeDoubleClick={(_, n) => { setDrillRef(n.id); track({ kind: "drill.in", block: (n.data as unknown as BlockNodeData).blockKey }); }} zoomOnDoubleClick={false}
          deleteKeyCode={drillRef ? null : ["Backspace", "Delete"]}
          fitView proOptions={{ hideAttribution: true }}
        >
          <Background color="#54607a" gap={22} />
          <Controls />
        </ReactFlow>
        <AssistantBubble />
      </div>

      {/* real-time linting / debug pane */}
      <div className="shrink-0 border-t border-[#54607a] bg-[#3f4860]">
        <div className="flex items-center gap-1 px-2">
          <button onClick={() => setBottomOpen((o) => !o)} className="flex items-center gap-1.5 border-b-2 border-[#4c8dff] px-3 py-1.5 text-[11px] text-white">
            Problems
            {(probCount.error + probCount.warn) > 0 && <span className="rounded-full bg-[#54607a] px-1.5 text-[9px] text-white">{probCount.error + probCount.warn}</span>}
          </button>
          <div className="ml-auto flex items-center gap-3 px-2 font-mono text-[10px] text-[#9aa3b5]">
            <span><span className="text-[#9aa3b5]">nets</span> <span className="text-white">{analysis.resolved.nets.length}</span></span>
            <span><span className="text-[#9aa3b5]">parts</span> <span className="text-white">{analysis.bom.length}</span></span>
            <span><span className="text-[#9aa3b5]">power</span> <span className="text-white">≈{round1(totalW)} W</span></span>
            {worstRail && <span><span className="text-[#9aa3b5]">top rail</span> <span style={{ color: barColor(worstRail.usedPct) }}>{Math.round(worstRail.usedPct ?? 0)}%</span></span>}
            <button onClick={() => setBottomOpen((o) => !o)} className="text-[#9aa3b5] hover:text-white" title={bottomOpen ? "Collapse" : "Expand"}>{bottomOpen ? "▾" : "▴"}</button>
          </div>
        </div>
        {bottomOpen && (
          <div className="h-40 overflow-y-auto border-t border-[#54607a] bg-[#373f54] px-2 py-1.5 text-[12px]">
            {analysis.findings.length === 0 ? (
              <div className="flex items-center gap-2 px-1.5 py-1 text-[#46dca6]">● All clear — no lint findings.</div>
            ) : (
              <ul className="space-y-0.5">
                {analysis.findings.map((f, i) => {
                  const blk = findingBlock(f);
                  return (
                    <li key={i}>
                      <button onClick={() => blk && locateBlock(blk)} disabled={!blk}
                        className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left enabled:hover:bg-[#454e62] disabled:cursor-default">
                        <span style={{ color: SEV_COLOR[f.severity] }}>{SEV_ICON[f.severity]}</span>
                        <span className="min-w-0 flex-1">
                          <span className="text-white">{f.message}</span>
                          {f.derivation && <span className="ml-1.5 font-mono text-[10.5px] text-[#9aa3b5]">— {f.derivation}</span>}
                        </span>
                        {blk && <span className="ml-auto shrink-0 font-mono text-[10px] text-[#677494]">{blk} ↗</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
      </div>

      <aside className="w-80 shrink-0 overflow-auto border-l border-[#54607a] bg-[#454e62] p-4 text-[#ffffff]">
        {passportNet && (
          <div className="mb-5 rounded-xl border border-[#4c8dff] bg-[#4e586f] p-3">
            <div className="flex items-center gap-2">
              <span style={{ color: NET_COLOR[passportNet.type] ?? "#4c8dff" }}>●</span>
              <div className="text-sm font-semibold">{passportNet.id}</div>
              <span className="ml-auto text-[9px] uppercase tracking-wide text-[#9aa3b5]">{passportNet.type} net</span>
            </div>
            <div className="mt-1.5 font-mono text-[11px] text-white">{passportNet.voltage ? `≈ ${fmtRange(passportNet.voltage)}` : "voltage not declared"}</div>
            {passportBudget?.capacityA != null && (
              <div className="mt-2.5">
                <div className="flex justify-between text-[11.5px]"><span className="text-[#9aa3b5]">Current</span><span className="font-mono text-white">{round1(passportBudget.drawA)} / {round1(passportBudget.capacityA)} A</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-[#3c4658]"><div className="h-full rounded" style={{ width: `${Math.min(100, passportBudget.usedPct ?? 0)}%`, background: barColor(passportBudget.usedPct) }} /></div>
              </div>
            )}
            <div className="mt-3 border-t border-[#54607a] pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa3b5]">Sources</div>
              {passportNet.sources.length
                ? passportNet.sources.map((s) => (
                  <div key={s.node} className="mt-1 flex justify-between text-[11.5px]"><span className="font-mono">{s.node}</span><span className="font-mono text-[#9aa3b5]">{fmtRange(s.def.v) || "—"}</span></div>
                ))
                : <div className="mt-1 text-[11px] text-[#fbbf24]">none — open net (nothing drives it)</div>}
            </div>
            <div className="mt-3 border-t border-[#54607a] pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa3b5]">Loads</div>
              {passportNet.sinks.length
                ? passportNet.sinks.map((s) => (
                  <div key={s.pin.node} className="mt-1 flex justify-between text-[11.5px]"><span className="font-mono">{s.pin.node}</span><span className="font-mono text-[#9aa3b5]">{fmtRange(s.current) ? `${fmtRange(s.current)} draw` : "—"}</span></div>
                ))
                : <div className="mt-1 text-[11px] text-[#9aa3b5]">no declared loads</div>}
            </div>
            <div className="mt-2.5 text-[10px] text-[#677494]">{passportNet.members.length} terminals on this net · click a block instead to inspect it</div>
          </div>
        )}
        {selectedBlock && (
          <div className="mb-5 rounded-xl border border-[#4c8dff] bg-[#4e586f] p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#4c8dff55] bg-[#4c8dff26] text-[#4c8dff]">{selectedBlock.glyph ?? "▦"}</span>
              <div>
                <div className="text-sm font-semibold">{selectedBlock.name}</div>
                <div className="font-mono text-[10px] text-[#9aa3b5]">{selectedId}</div>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {Object.entries(selectedBlock.spec ?? {}).map(([k, v]) => (
                <span key={k} className="rounded border border-[#54607a] bg-[#454e62] px-2 py-0.5 font-mono text-[10px] text-white">{k} {fmtRange(v)}</span>
              ))}
            </div>
            {selectedBlock.terminals.some((t) => t.i?.max != null) && (
              <div className="mt-3 border-t border-[#54607a] pt-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#9aa3b5]">Edit current</div>
                {selectedBlock.terminals.filter((t) => t.i?.max != null).map((t) => (
                  <label key={t.id} className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="font-mono">{t.id} · {t.role === "out" ? "max out" : "draw"} (A)</span>
                    <input
                      type="number" step="0.1" min="0"
                      value={selectedOverrides?.terminals?.[t.id]?.i?.max ?? t.i!.max!}
                      onChange={(e) => setTermCurrent(selectedId!, t.id, e.target.value)}
                      className="w-20 rounded border border-[#54607a] bg-[#454e62] px-2 py-1 text-right font-mono text-[11.5px] text-white outline-none focus:border-[#4c8dff]"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <Panel title={`Power budget · ≈${round1(totalW)} W`}>
          {budgets.length === 0
            ? <p className="mt-2 text-xs text-[#9aa3b5]">No power rails yet.</p>
            : budgets.map((b) => <BudgetBar key={b.net} b={b} />)}
          {Object.entries(analysis.power.transforms).map(([ref, p]) => (
            <div key={ref} className="mt-2 font-mono text-[10px] text-[#9aa3b5]">↳ {ref} draws ~{p.iIn} A from {p.vIn} V ({p.pIn} W in)</div>
          ))}
        </Panel>

        <Panel title={selectedId ? `Checks · ${selectedId}` : `Checks · ${analysis.findings.length}`}>
          {shownFindings.length === 0
            ? <p className="mt-2 text-sm text-[#46dca6]">● {selectedId ? "No issues on this block" : "All clear"}</p>
            : <div className="mt-2 space-y-2">{shownFindings.map((f, i) => <FindingCard key={i} f={f} />)}</div>}
        </Panel>

        <Panel title={`BOM · ${analysis.bom.length}`}>
          <div className="mt-2 space-y-1 font-mono text-[11px] text-white">
            {analysis.bom.map((r, i) => (
              <div key={i}>{r.qty}× {r.value ?? r.part ?? r.type} <span className="text-[#9aa3b5]">{r.refs.join(", ")}</span></div>
            ))}
          </div>
        </Panel>

        {consolidation.length > 0 && (
          <Panel title="Part values">
            <div className="mt-2 space-y-2 text-[11.5px]">
              {consolidation.map((c) => (
                <div key={c.label}>
                  <div className="text-white">{c.label}: <span className="font-mono">{c.distinct}</span> distinct {c.distinct === 1 ? "value" : "values"} across {c.qty} parts</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.values.map((v) => <span key={v} className="rounded border border-[#54607a] bg-[#454e62] px-1.5 py-0.5 font-mono text-[10px] text-[#9aa3b5]">{v}</span>)}
                  </div>
                </div>
              ))}
              <p className="text-[10px] leading-relaxed text-[#677494]">Fewer distinct values = fewer reels and stocking mistakes. Consolidate where a block&apos;s declared envelope allows.</p>
            </div>
          </Panel>
        )}

        {stressLimits.length > 0 && (
          <Panel title="Stress test">
            <label className="mt-1 flex items-center justify-between gap-2 text-[11.5px]">
              <span className="text-[#9aa3b5]">Input what-if</span>
              <span className="flex items-center gap-1">
                <input type="number" step="1" min="0" value={stressV} onChange={(e) => setStressV(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded border border-[#54607a] bg-[#454e62] px-2 py-1 text-right font-mono text-[11.5px] text-white outline-none focus:border-[#4c8dff]" />
                <span className="font-mono text-[#9aa3b5]">V</span>
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
                  <span className="font-mono text-white">{l.ref} · {l.field}</span>
                  <span className="font-mono" style={{ color: l.margin < 0 ? "#f87171" : l.margin < 3 ? "#fbbf24" : "#9aa3b5" }}>
                    {l.value}{l.unit ?? "V"} · {l.margin < 0 ? "over" : `+${round1(l.margin)}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#677494]">Reads authored limit notes against your what-if input — not a simulation. A guided tour of how the design dies.</p>
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
        <div className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[#3c4658]">
          <div className="flex items-center gap-2 border-b border-[#54607a] px-4 py-2 text-sm">
            <button onClick={() => setDrillRef(null)} className="text-[#9aa3b5] hover:text-white">← {design.name}</button>
            <span className="text-[#677494]">/</span>
            <span className="font-semibold">{drillRef} — {drilledBlock.name}</span>
            <span className="ml-2 text-[11px] text-[#9aa3b5]">internal schematic · drag symbols, wire pins</span>
          </div>
          <div className="min-h-0 flex-1">
            <BlockSchematic blockId={drilledBlock.id} initial={drilledBlock.layout} terminals={drilledBlock.terminals} block={drilledBlock} />
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#9aa3b5]">{title}</h2>
      {children}
    </section>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <div className="rounded-lg border border-[#54607a] bg-[#4e586f] p-3 text-xs">
      <div className="font-semibold" style={{ color: SEV_COLOR[f.severity] }}>{SEV_ICON[f.severity]} {f.message}</div>
      {f.derivation && <div className="mt-1 font-mono text-[11px] text-white">{f.derivation}</div>}
    </div>
  );
}

function BudgetBar({ b }: { b: RailBudget }) {
  return (
    <div className="mt-2 rounded-lg border border-[#54607a] bg-[#4e586f] p-2.5">
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-mono">{b.net}{b.voltage != null ? ` · ${b.voltage} V` : ""}</span>
        <span className="text-white">{b.capacityA != null ? `${b.drawA} / ${b.capacityA} A` : `${b.drawA} A`}</span>
      </div>
      {b.capacityA != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-[#3c4658]">
          <div className="h-full rounded" style={{ width: `${Math.min(100, b.usedPct ?? 0)}%`, background: barColor(b.usedPct) }} />
        </div>
      )}
      {b.watts != null && (
        <div className="mt-1 text-[10px] text-[#9aa3b5]">
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
