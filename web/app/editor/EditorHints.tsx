"use client";
// One-time discoverability chips: the editor's best features are gestures (double-click,
// right-click) with no visual affordance — these hand a first-timer the keys, then get out
// of the way forever. Each chip dismisses individually; dismissals persist per browser.
import { useEffect, useState } from "react";

const HINTS = [
  { id: "drill", icon: "⊟", text: "Double-click any block to see inside it — every part explains why it's there." },
  { id: "label", icon: "⚑", text: "Right-click any pin to name its net — same name = same net, no wire needed." },
  { id: "break", icon: "⚡", text: "Checks run live. Wire something wrong on purpose — watch it get caught." },
];
const KEY = "electrace:hints-dismissed";

export default function EditorHints() {
  const [gone, setGone] = useState<Set<string> | null>(null); // null until mounted (SSR-safe)
  useEffect(() => {
    try { setGone(new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"))); } catch { setGone(new Set()); }
  }, []);
  if (!gone) return null;
  const live = HINTS.filter((h) => !gone.has(h.id));
  if (!live.length) return null;
  const dismiss = (id: string) => {
    const next = new Set(gone); next.add(id);
    setGone(next);
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden w-full max-w-md -translate-x-1/2 flex-col items-center gap-1.5 px-4 md:flex">
      {live.map((h) => (
        <div key={h.id} className="pointer-events-auto flex w-full items-center gap-2.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]/95 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur">
          <span className="shrink-0 text-[13px]">{h.icon}</span>
          <span className="flex-1 text-[11.5px] leading-snug text-[var(--color-dim)]">{h.text}</span>
          <button onClick={() => dismiss(h.id)} title="Got it" className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] text-[var(--color-faint)] hover:text-[var(--color-text)]">✕</button>
        </div>
      ))}
    </div>
  );
}
