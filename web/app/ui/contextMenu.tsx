"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// A themed right-click menu. Call openContextMenu(event, items) from any onContextMenu handler:
//   onContextMenu={(e) => openContextMenu(e, [
//     { label: "Edit", icon: "✎", onSelect: () => edit() },
//     { separator: true },
//     { label: "Delete", icon: "✕", danger: true, onSelect: () => del() },
//   ])}
// A single <ContextMenuHost/> (mounted in the root layout) renders it at the cursor.

export type MenuItem =
  | { separator: true }
  | { label: string; icon?: string; hint?: string; danger?: boolean; disabled?: boolean; onSelect: () => void };

type State = { x: number; y: number; items: MenuItem[] } | null;

let emit: ((s: State) => void) | null = null;

/** Open the themed context menu at the event's location. Prevents the native menu. */
export function openContextMenu(e: { preventDefault: () => void; clientX: number; clientY: number }, items: MenuItem[]) {
  e.preventDefault();
  if (emit) emit({ x: e.clientX, y: e.clientY, items });
}

export function ContextMenuHost() {
  const [state, setState] = useState<State>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => { emit = setState; return () => { emit = null; }; }, []);

  // keep the menu fully on-screen
  useLayoutEffect(() => {
    if (!state || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(state.x, window.innerWidth - r.width - pad);
    const top = Math.min(state.y, window.innerHeight - r.height - pad);
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top) });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const close = () => setState(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    // close on any outside interaction (next tick so the opening click doesn't immediately close it)
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("contextmenu", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("contextmenu", onDown, true);
    };
  }, [state]);

  if (!state) return null;
  return (
    <div
      ref={ref} role="menu"
      className="fixed z-[110] min-w-[184px] overflow-hidden rounded-xl border border-border-strong bg-surface py-1.5 shadow-2xl"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((it, i) =>
        "separator" in it ? (
          <div key={i} className="my-1.5 h-px bg-border" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => { setState(null); it.onSelect(); }}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition disabled:cursor-not-allowed disabled:opacity-40 ${it.danger ? "text-[#e2837e] hover:bg-[color-mix(in_srgb,#e2554b_16%,transparent)]" : "text-text hover:bg-surface-2"}`}
          >
            <span className={`w-4 text-center text-[12px] ${it.danger ? "" : "text-faint"}`}>{it.icon ?? ""}</span>
            <span className="flex-1">{it.label}</span>
            {it.hint && <span className="font-mono text-[11px] text-faint">{it.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
