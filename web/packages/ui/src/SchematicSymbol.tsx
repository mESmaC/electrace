// Thin, render-only wrappers over the product's real SYMBOLS library (web/app/editor/symbols.tsx).
// The editor consumes SYMBOLS through xyflow nodes; these wrappers expose the same pure SVG art as
// plain components so a design can drop a themed schematic symbol — or the whole library — anywhere.
import { SYMBOLS, SYMBOL_GROUPS, type SymStyle } from "@/app/editor/symbols";

export { SYMBOL_GROUPS };

/** A schematic symbol's key — e.g. "resistor", "capacitor", "npn", "led". See SYMBOL_TYPES. */
export type SymbolType = string;
/** The symbol drawing standard: ANSI/IEEE (US) or IEC 60617 (international). */
export type SymbolStandard = SymStyle;

/** Every symbol available in the library, in declaration order. */
export const SYMBOL_TYPES: SymbolType[] = Object.keys(SYMBOLS);

/**
 * A single themed schematic symbol rendered as inline SVG, in the ANSI or IEC standard.
 * Body strokes inherit `color` (the Electrace text token); leads/pins are the blue accent.
 */
export function SchematicSymbol({
  type,
  standard = "ansi",
  size = 56,
  showLabel = false,
  className,
}: {
  /** Which symbol to draw (see SYMBOL_TYPES / SYMBOL_GROUPS). */
  type: SymbolType;
  /** Drawing standard — "ansi" (zigzag resistor) or "iec" (boxed). Defaults to "ansi". */
  standard?: SymbolStandard;
  /** Rendered width in px; height follows the symbol's aspect ratio. Defaults to 56. */
  size?: number;
  /** Show the symbol's label beneath it. Defaults to false. */
  showLabel?: boolean;
  className?: string;
}) {
  const sym = SYMBOLS[type];
  if (!sym) return null;
  const height = Math.round((size * sym.h) / sym.w);
  const svg = (
    <svg
      viewBox={`0 0 ${sym.w} ${sym.h}`}
      width={size}
      height={height}
      role="img"
      aria-label={sym.label}
      style={{ color: "var(--color-text)", overflow: "visible", display: "block" }}
      className={className}
    >
      {sym.draw(standard)}
    </svg>
  );
  if (!showLabel) return svg;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {svg}
      <span className="font-mono text-[10px] text-faint">{sym.label}</span>
    </span>
  );
}

/**
 * The full Electrace schematic-symbol library, laid out by group (Passive, Diode, Transistor,
 * Integrated, Source, Power, Electromechanical, Connector). Useful as a palette/reference.
 */
export function SchematicSymbolGallery({ standard = "ansi" }: { standard?: SymbolStandard }) {
  return (
    <div className="flex flex-col gap-5">
      {SYMBOL_GROUPS.map((group) => {
        const types = group.types.filter((t) => SYMBOLS[t]);
        if (types.length === 0) return null;
        return (
          <div key={group.name} className="flex flex-col gap-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{group.name}</div>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
              {types.map((t) => (
                <div key={t} className="flex w-[84px] flex-col items-center gap-1.5">
                  <div className="grid h-14 w-full place-items-center rounded-lg border border-border bg-surface-2 px-2">
                    <SchematicSymbol type={t} standard={standard} size={56} />
                  </div>
                  <span className="text-center font-mono text-[9.5px] leading-tight text-faint">
                    {SYMBOLS[t]?.label ?? t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
