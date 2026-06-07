"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "mid" | "dark";
const KEY = "electrace:theme";
const THEMES: { id: Theme; icon: string; label: string }[] = [
  { id: "light", icon: "☀", label: "Light" },
  { id: "mid", icon: "◐", label: "Mid" },
  { id: "dark", icon: "☾", label: "Dark" },
];

/** Triple theme selector (Light / Mid / Dark — Mid is the default). Sets <html data-theme>; the
 *  no-flash script in the layout applies the stored choice before first paint. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("mid");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "light" || t === "dark" ? t : "mid");
  }, []);
  const pick = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  };
  return (
    <div className="flex items-center rounded-md border border-border p-0.5" role="group" aria-label="Theme">
      {THEMES.map((t) => (
        <button key={t.id} onClick={() => pick(t.id)} title={`${t.label} theme`} aria-pressed={theme === t.id}
          className={`grid h-6 w-7 place-items-center rounded text-[12px] transition ${theme === t.id ? "bg-accent text-white" : "text-faint hover:text-text"}`}>
          {t.icon}
        </button>
      ))}
    </div>
  );
}
