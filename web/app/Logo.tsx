// The Electrace brand mark, taken from mockups/logo.html (the refined `#mk` symbol) — just the icon: a "C"
// (circuit + the C-language IDE heritage) drawn as a ring, with a resistor trace + net terminals through it.
// Themed to the current palette: ring = text, trace/terminals = accent, terminal fill = page background.

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={className} role="img" aria-label="Electrace" fill="none">
      <path d="M169.7 39.9 A78 78 0 1 0 169.7 140.1" stroke="var(--color-text)" strokeWidth={16} strokeLinecap="round" />
      <path d="M65 90 H100 L106 76 L118 104 L130 76 L142 104 L154 76 L160 90 H200" stroke="var(--color-accent)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={55} cy={90} r={10} fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth={6} />
      <circle cx={210} cy={90} r={10} fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth={6} />
    </svg>
  );
}

/** Mark + "Electrace" wordmark + code caret (the horizontal app-header lockup). Sizes to the font-size set
 *  via `className` (e.g. text-[17px]); the mark scales with the text. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-mono font-bold ${className}`}>
      <LogoMark className="h-[1.4em] w-auto shrink-0" />
      <span>Electrace<span className="ml-[0.18em] inline-block h-[0.62em] w-[0.2em] translate-y-[0.04em] rounded-[1px] bg-accent align-middle" /></span>
    </span>
  );
}
