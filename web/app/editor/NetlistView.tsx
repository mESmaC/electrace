"use client";
import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const HID: React.CSSProperties = { opacity: 0, width: 6, height: 6, minWidth: 0, border: "none", background: "transparent" };
const Ports = () => (
  <>
    <Handle type="target" position={Position.Left} style={HID} isConnectable={false} />
    <Handle type="source" position={Position.Right} style={HID} isConnectable={false} />
  </>
);

// A netlist normalized for rendering: parts + named nets (members are pin refs
// like "U1.VIN" or "@vin" for a boundary terminal).
export interface NLPart { ref: string; type: string; value?: string; part?: string; why?: string }
export interface NLNet { name: string; members: string[] }

const NET = "#4c8dff";

function PartNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; sub?: string; why?: string };
  return (
    <div title={d.why} className="relative rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-3 py-2 text-center text-[#ffffff] shadow">
      <Ports />
      <div className="font-mono text-[12px] font-bold">{d.label}</div>
      {d.sub && <div className="font-mono text-[10px] text-[var(--color-faint)]">{d.sub}</div>}
    </div>
  );
}
function NetNode({ data }: NodeProps) {
  const d = data as unknown as { label: string };
  return (
    <div className="relative rounded-full border border-[#4c8dff80] bg-[#4c8dff26] px-2.5 py-1 font-mono text-[10px] text-[var(--color-link)]">
      <Ports />{d.label}
    </div>
  );
}
function PortNode({ data }: NodeProps) {
  const d = data as unknown as { label: string };
  return (
    <div className="relative rounded-md border border-[var(--color-faint)] bg-[var(--color-surface)] px-2.5 py-1 font-mono text-[10px] text-[var(--color-text)]">
      <Ports />⏚ {d.label}
    </div>
  );
}
const nodeTypes = { part: PartNode, net: NetNode, port: PortNode };

const SIZE = { part: { w: 96, h: 46 }, net: { w: 72, h: 26 }, port: { w: 64, h: 26 } };

export default function NetlistView({ parts, nets }: { parts: NLPart[]; nets: NLNet[] }) {
  const { nodes, edges } = useMemo(() => {
    const rawNodes: { id: string; kind: keyof typeof SIZE; data: Record<string, unknown> }[] = [];
    const rawEdges: { id: string; source: string; target: string }[] = [];
    const ports = new Set<string>();

    for (const p of parts) {
      rawNodes.push({ id: `p:${p.ref}`, kind: "part", data: { label: p.ref, sub: p.value ?? p.part ?? p.type, why: p.why } });
    }
    nets.forEach((net, ni) => {
      const netId = `n:${ni}`;
      rawNodes.push({ id: netId, kind: "net", data: { label: net.name } });
      net.members.forEach((m, mi) => {
        let nodeId: string;
        if (m.startsWith("@")) {
          const t = m.slice(1);
          nodeId = `t:${t}`;
          if (!ports.has(t)) { ports.add(t); rawNodes.push({ id: nodeId, kind: "port", data: { label: t } }); }
        } else {
          nodeId = `p:${m.split(".")[0]}`;
        }
        rawEdges.push({ id: `e:${ni}:${mi}`, source: nodeId, target: netId });
      });
    });

    // dagre layout (left → right)
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 56, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of rawNodes) g.setNode(n.id, { width: SIZE[n.kind].w, height: SIZE[n.kind].h });
    for (const e of rawEdges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
    dagre.layout(g);

    const nodes: Node[] = rawNodes.map((n) => {
      const { x, y } = g.node(n.id);
      return {
        id: n.id, type: n.kind, data: n.data, draggable: false, selectable: false,
        position: { x: x - SIZE[n.kind].w / 2, y: y - SIZE[n.kind].h / 2 },
      };
    });
    const edges: Edge[] = rawEdges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      style: { stroke: NET, strokeWidth: 1.6, opacity: 0.7 },
    }));
    return { nodes, edges };
  }, [parts, nets]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      fitView proOptions={{ hideAttribution: true }}
    >
      <Background color="#56617d" gap={22} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
