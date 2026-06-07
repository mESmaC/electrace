"use client";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "electrace:theme";

/** Reads/sets the theme on <html data-theme>. The no-flash script in the layout sets the initial
 *  attribute before paint; this keeps React in sync and persists the choice. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(t);
  }, []);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };
  return (
    <button onClick={toggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid h-8 w-8 place-items-center rounded-md border border-border text-dim hover:border-accent hover:text-text">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
