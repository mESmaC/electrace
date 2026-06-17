// Foundations — reference cards that document the Electrace design language for the design agent.
// These are not product components; they render the REAL tokens, fonts and themes so the agent (and
// humans) can see and name the system. Tokens/fonts come from styles.css; nothing here is invented.
import type { ReactNode } from "react";

type Swatch = { name: string; varName: string; util: string };

const SURFACES: Swatch[] = [
  { name: "bg", varName: "--color-bg", util: "bg-bg" },
  { name: "bg2", varName: "--color-bg2", util: "bg-bg2" },
  { name: "surface", varName: "--color-surface", util: "bg-surface" },
  { name: "surface-2", varName: "--color-surface-2", util: "bg-surface-2" },
  { name: "surface-3", varName: "--color-surface-3", util: "bg-surface-3" },
];
const LINES: Swatch[] = [
  { name: "border", varName: "--color-border", util: "border-border" },
  { name: "border-strong", varName: "--color-border-strong", util: "border-border-strong" },
];
const TEXT: Swatch[] = [
  { name: "text", varName: "--color-text", util: "text-text" },
  { name: "dim", varName: "--color-dim", util: "text-dim" },
  { name: "faint", varName: "--color-faint", util: "text-faint" },
];
const BRAND: Swatch[] = [
  { name: "accent", varName: "--color-accent", util: "text-accent / bg-accent" },
  { name: "accent-hi", varName: "--color-accent-hi", util: "—" },
  { name: "link", varName: "--color-link", util: "text-[var(--color-link)]" },
  { name: "amber", varName: "--color-amber", util: "text-amber" },
  { name: "green", varName: "--color-green", util: "text-green" },
  { name: "gray", varName: "--color-gray", util: "text-gray" },
];

const mono = "var(--font-mono)";
const sans = "var(--font-sans)";

function Group({ title, swatches }: { title: string; swatches: Swatch[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-faint)" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {swatches.map((s) => (
          <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 6, width: 132 }}>
            <div style={{ height: 48, borderRadius: 8, background: `var(${s.varName})`, border: "1px solid var(--color-border)" }} />
            <div style={{ fontFamily: mono, fontSize: 11, color: "var(--color-text)" }}>{s.name}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: "var(--color-faint)" }}>{s.util}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Electrace color tokens — semantic, theme-switchable surfaces/text/borders plus the
 *  theme-constant brand & status colors. Style with the listed Tailwind utilities. */
export function ColorTokens() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, background: "var(--color-bg)", padding: 24 }}>
      <Group title="Surfaces (page → panel depth)" swatches={SURFACES} />
      <Group title="Borders" swatches={LINES} />
      <Group title="Text" swatches={TEXT} />
      <Group title="Brand & status (theme-constant)" swatches={BRAND} />
    </div>
  );
}

/** The Electrace type scale — Inter for UI (font-sans), JetBrains Mono for values, nets and specs
 *  (font-mono). Numbers/nets are always monospace; it's core to the brand's credibility. */
export function TypeScale() {
  const row = (label: string, node: ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "baseline", gap: 16 }}>
      <span style={{ fontFamily: mono, fontSize: 10, color: "var(--color-faint)" }}>{label}</span>
      {node}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, background: "var(--color-bg)", padding: 24, color: "var(--color-text)" }}>
      {row("display", <span style={{ fontFamily: sans, fontSize: 30, fontWeight: 800, letterSpacing: "-.02em" }}>Self-explaining circuits</span>)}
      {row("heading", <span style={{ fontFamily: sans, fontSize: 20, fontWeight: 700 }}>Block library &amp; live checks</span>)}
      {row("body", <span style={{ fontFamily: sans, fontSize: 14, color: "var(--color-dim)" }}>Plenty of headroom — 15 W of 25 W. Calm by default, depth on demand.</span>)}
      {row("label", <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-faint)" }}>Output voltage</span>)}
      {row("value", <span style={{ fontFamily: mono, fontSize: 15, color: "var(--color-text)" }}>3.300 V &nbsp; 250 Ω &nbsp; 20 mA</span>)}
      {row("net", <span style={{ fontFamily: mono, fontSize: 13, color: "var(--color-link)" }}>VIN · 3V3 · GND · @vin</span>)}
    </div>
  );
}

function MiniCard() {
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 14, width: 180, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>Regulator</div>
      <div style={{ fontFamily: mono, fontSize: 12, color: "var(--color-dim)" }}>9–18 V → 5 V · 3 A</div>
      <span style={{ alignSelf: "flex-start", fontFamily: sans, fontSize: 11, fontWeight: 600, color: "var(--color-green)", border: "1px solid color-mix(in srgb, var(--color-green) 45%, transparent)", background: "color-mix(in srgb, var(--color-green) 10%, transparent)", borderRadius: 999, padding: "2px 8px" }}>✓ OK</span>
    </div>
  );
}

/** The three themes — Mid (default, slate-dusk), Dark, Light. The same markup re-themes purely by the
 *  `data-theme` attribute on an ancestor; set it to switch, leave it for Mid. */
export function ThemeSpecimen() {
  const themes: { id: string; label: string }[] = [
    { id: "mid", label: "Mid (default)" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 8 }}>
      {themes.map((t) => (
        <div key={t.id} data-theme={t.id} style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: "var(--color-faint)" }}>data-theme=&quot;{t.id}&quot;</div>
          <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>{t.label}</div>
          <MiniCard />
        </div>
      ))}
    </div>
  );
}
