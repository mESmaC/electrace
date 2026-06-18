// Screen templates — full Electrace screens assembled from the real @electrace/ui components, the way
// the design agent should compose them. These carry demo data so they render standalone; they double
// as on-brand starting points (a "Templates" group) and as the dogfood that proves the parts suffice.
import { Logo } from "@/app/Logo";
import ThemeToggle from "@/app/ThemeToggle";
import NetlistView from "@/app/editor/NetlistView";
import SchematicPreview from "@/app/editor/SchematicPreview";
import BomPanel from "@/app/editor/BomPanel";
import AssistantBubble from "@/app/editor/AssistantBubble";
import { SevChip } from "@/app/docs/checks/ui";
import { AppShell } from "./app-shell";

// ── shared demo data (the bridge-rectifier block, as elsewhere) ──────────────
const palette = [
  ["◇", "Bridge Rectifier", "power"], ["⇄", "Buck Regulator", "power"], ["⇗", "Boost Converter", "power"],
  ["⊡", "Debounced Button", "input"], ["◈", "Crystal Oscillator", "timing"], ["◑", "Comparator", "analog"],
] as const;
const nlParts = [
  { ref: "U1", type: "regulator", value: "AMS1117-3.3" }, { ref: "C1", type: "capacitor", value: "10µF" },
  { ref: "C2", type: "capacitor", value: "22µF" }, { ref: "R1", type: "resistor", value: "1k" }, { ref: "D1", type: "led", value: "grn" },
];
const nlNets = [
  { name: "VIN", members: ["@vin", "U1.IN", "C1.1"] }, { name: "3V3", members: ["U1.OUT", "C2.1", "R1.1"] },
  { name: "GND", members: ["@gnd", "U1.GND", "C1.2", "C2.2", "D1.2"] }, { name: "LED", members: ["R1.2", "D1.1"] },
];
const layout = {
  symbols: [
    { id: "P_ac1", type: "port", ref: "ac1", x: 90, y: 170, rot: 180 },
    { id: "D1", type: "diode", ref: "D1", x: 195, y: 101, rot: 270 }, { id: "D2", type: "diode", ref: "D2", x: 355, y: 101, rot: 270 },
    { id: "D3", type: "diode", ref: "D3", x: 195, y: 231, rot: 270 }, { id: "D4", type: "diode", ref: "D4", x: 355, y: 231, rot: 270 },
    { id: "P_ac2", type: "port", ref: "ac2", x: 430, y: 170, rot: 0 },
    { id: "C1", type: "cap-pol", ref: "C1", value: "470µF", x: 438, y: 96, rot: 90 },
    { id: "P_vout", type: "port", ref: "vout", x: 560, y: 70, rot: 0 }, { id: "P_gnd", type: "port", ref: "gnd", x: 470, y: 270, rot: 0 },
  ],
  wires: [
    { from: "D1.2", to: "D2.2" }, { from: "D2.2", to: "C1.1" }, { from: "C1.1", to: "P_vout.1" },
    { from: "D3.1", to: "D4.1" }, { from: "D4.1", to: "P_gnd.1" }, { from: "C1.2", to: "P_gnd.1" },
    { from: "D1.1", to: "D3.2" }, { from: "P_ac1.1", to: "D3.2" }, { from: "D2.1", to: "D4.2" }, { from: "P_ac2.1", to: "D4.2" },
  ],
};
const bomRows = [
  { qty: 4, type: "diode", part: "1N4007", footprint: "DO-41", refs: ["D1", "D2", "D3", "D4"] },
  { qty: 1, type: "cap", value: "470µF", footprint: "radial-8mm", polarized: true, refs: ["C1"] },
];

/** The signature Electrace editor screen — three panes: block-library palette, the canvas (net graph),
 *  and a persistent context panel (selected block's explanation, internal schematic, lint, BOM), with
 *  Sparky floating. Assembled from the real components (the live Editor itself is too stateful to ship). */
export function EditorScreen() {
  return (
    <div className="relative flex h-screen flex-col bg-bg text-text" style={{ minHeight: 640 }}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-bg/90 px-4">
        <Logo className="text-[15px]" />
        <span className="text-faint">/</span>
        <span className="text-sm font-semibold">USB-C 5 V Supply</span>
        <div className="ml-2 flex items-center rounded-lg border border-border-strong p-0.5 text-[12px]">
          <button className="rounded bg-accent px-2 py-0.5 font-medium text-white">Blocks</button>
          <button className="px-2 py-0.5 text-dim">Schematic</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <SevChip sev="warn" />
          <span className="font-mono text-xs text-dim">9.0 W / 15 W</span>
          <div className="hidden sm:block"><ThemeToggle /></div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">Block library</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {palette.map(([glyph, name, cat]) => (
              <div key={name} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 p-2 hover:border-accent">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-accent/30 bg-accent/15 text-accent">{glyph}</span>
                <div className="min-w-0"><div className="truncate text-[12px] font-semibold">{name}</div><div className="text-[10px] capitalize text-faint">{cat}</div></div>
              </div>
            ))}
          </div>
        </aside>
        <main className="relative min-w-0 flex-1 bg-bg"><div className="absolute inset-0"><NetlistView parts={nlParts} nets={nlNets} /></div></main>
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-surface p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/30 bg-accent/15 text-accent">⇄</span>
            <div><div className="text-[14px] font-bold leading-tight">Buck Regulator</div><div className="font-mono text-[11px] text-dim">9–18 V → 5 V · 3 A</div></div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[11.5px]">
            <span className="text-green">●</span> Plenty of headroom — 9 W of 15 W
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">Steps the input down to a fixed 5 V at up to 3 A. Click a part to see why it's there and the arithmetic behind each check.</p>
          <div className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">Internal schematic</div>
          <SchematicPreview blockId="buck::internal" layout={layout} height="fit" />
          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-faint">Bill of materials</div>
          <BomPanel designName="USB-C 5 V Supply" pro={false} rows={bomRows} />
        </aside>
      </div>
      <AssistantBubble />
    </div>
  );
}

const projects = [
  { name: "USB-C 5 V Supply", spec: "9–18 V → 5 V · 3 A", sev: "warn" as const, glyph: "⇄" },
  { name: "Bridge Rectifier PSU", spec: "24 VAC → 30 V · 1 A", sev: "info" as const, glyph: "◇" },
  { name: "LED Driver", spec: "12 V → 350 mA CC", sev: "error" as const, glyph: "◉" },
  { name: "Sensor Frontend", spec: "3.3 V · 2 kHz LP", sev: "recommendation" as const, glyph: "◑" },
  { name: "Motor H-Bridge", spec: "24 V · 5 A peak", sev: "info" as const, glyph: "⊞" },
  { name: "Crystal Clock", spec: "16 MHz · 18 pF", sev: "unknown" as const, glyph: "◈" },
];

/** A projects dashboard — the design grid the user lands on: each card a saved design with its spec
 *  line and lint status. Built on the page surface inside AppShell. */
export function Dashboard() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center">
          <h1 className="text-[26px] font-extrabold tracking-tight">Your designs</h1>
          <button className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hi">New design</button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.name} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/15 text-lg text-accent">{p.glyph}</span>
                <div className="min-w-0"><div className="truncate font-semibold">{p.name}</div><div className="font-mono text-xs text-dim">{p.spec}</div></div>
              </div>
              <div className="mt-4"><SevChip sev={p.sev} /></div>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
