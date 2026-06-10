"use client";
// Shared primitives for the calculator pages — controlled number fields and result rows that
// match the site's design system.
import { useId } from "react";

export function Num({ label, value, onChange, unit, step = 0.1, min = 0 }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; min?: number;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 py-2 focus-within:border-accent">
        <input id={id} type="number" value={Number.isFinite(value) ? value : ""} step={step} min={min}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full bg-transparent font-mono text-[15px] text-text outline-none" />
        {unit && <span className="text-[12px] text-faint">{unit}</span>}
      </span>
    </label>
  );
}

export function Out({ label, value, strong, warn, note }: { label: string; value: string; strong?: boolean; warn?: boolean; note?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 rounded-xl border px-4 py-2.5 ${warn ? "border-[#fbbf2455] bg-[#fbbf2410]" : strong ? "border-accent/40 bg-accent/10" : "border-border bg-surface"}`}>
      <span className="text-[13px] text-dim">{label}{note && <span className="ml-2 text-[11.5px] text-faint">{note}</span>}</span>
      <span className={`font-mono text-[15px] ${warn ? "text-[#fbbf24]" : strong ? "font-bold text-accent" : "text-text"}`}>{value}</span>
    </div>
  );
}

export function Preset({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[12px] transition-colors ${active ? "border-accent text-accent" : "border-border-strong text-dim hover:border-accent hover:text-accent"}`}>
      {label}
    </button>
  );
}
