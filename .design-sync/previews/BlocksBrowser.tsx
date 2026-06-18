import type { ReactNode } from "react";
import { BlocksBrowser } from "@electrace/ui";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div data-theme="mid" style={{ background: "var(--color-bg)", padding: 32, fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <h1 className="text-[24px] font-extrabold tracking-tight">Block library</h1>
        {children}
      </div>
    </div>
  );
}

// Block items modeled on the real @electrace blocks (electrace/blocks/*). The card uses
// glyph / name / category / the first few spec entries; searchBlocks only runs on a typed query.
const items = [
  { slug: "buck-converter", block: { name: "Buck Converter", category: "power", glyph: "⇄", spec: { vin: { min: 9, max: 18, unit: "V" }, vout: { value: 5, unit: "V" }, iout: { value: 3, unit: "A" } } } },
  { slug: "bridge-rectifier", block: { name: "Bridge Rectifier", category: "power", glyph: "◇", spec: { vac_in: { min: 9, max: 24, unit: "V" }, iout_max: { value: 1, unit: "A" } } } },
  { slug: "boost-converter", block: { name: "Boost Converter", category: "power", glyph: "⇗", spec: { vin: { min: 3, max: 5, unit: "V" }, vout: { value: 12, unit: "V" } } } },
  { slug: "debounced-button", block: { name: "Debounced Button", category: "input", glyph: "⊡", spec: { vcc: { value: 3.3, unit: "V" } } } },
  { slug: "crystal-oscillator", block: { name: "Crystal Oscillator", category: "timing", glyph: "◈", spec: { freq: { value: 16, unit: "MHz" } } } },
  { slug: "i2c-level-shifter", block: { name: "I²C Level Shifter", category: "interface", glyph: "⇅", spec: { va: { value: 1.8, unit: "V" }, vb: { value: 3.3, unit: "V" } } } },
];

/** The searchable block-library grid — glyph + name + category + spec chips per card, with category
 *  filters and a spec-aware search. */
export const Library = () => (
  <Frame>
    <BlocksBrowser items={items as never} />
  </Frame>
);
