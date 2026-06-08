"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { setSymbolStyle, getSymbolStyle, type SymStyle } from "@/app/editor/symbols";
import { telemetryEnabled, setTelemetry, getEvents, clearEvents } from "@/lib/telemetry";

type Theme = "dark" | "mid" | "light";
const THEMES: { k: Theme; label: string }[] = [{ k: "light", label: "Light" }, { k: "mid", label: "Mid" }, { k: "dark", label: "Dark" }];
const ACCENTS = [{ k: "blue", c: "#4c8dff" }, { k: "teal", c: "#2dd4bf" }, { k: "violet", c: "#7c6cff" }, { k: "amber", c: "#f7b13c" }];
const ROLES = [
  { v: "learn", ic: "🎓", t: "Learning" },
  { v: "build", ic: "🛠", t: "Building" },
  { v: "pro", ic: "💼", t: "Professionally" },
];

const applyTheme = (t: Theme) => { try { document.documentElement.setAttribute("data-theme", t); localStorage.setItem("electrace:theme", t); } catch { /* ignore */ } };
const applyAccent = (c: string) => { try { const d = document.documentElement; d.style.setProperty("--color-accent", c); d.style.setProperty("--color-accent-hi", c); localStorage.setItem("electrace:accent", c); } catch { /* ignore */ } };

const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5 last:border-0">
    <div>
      <div className="font-medium text-text">{title}</div>
      {hint && <div className="mt-0.5 text-[13px] text-faint">{hint}</div>}
    </div>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-6 rounded-2xl border border-border bg-surface px-6 py-2">
    <h2 className="mt-4 mb-1 text-[13px] font-bold uppercase tracking-wide text-faint">{title}</h2>
    {children}
  </section>
);

const pill = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-sm transition ${active ? "border-accent bg-accent/15 text-accent" : "border-border-strong text-dim hover:border-accent hover:text-text"}`;

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("You");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<Theme>("mid");
  const [accent, setAccent] = useState("#4c8dff");
  const [sym, setSym] = useState<SymStyle>("ansi");
  const [role, setRole] = useState("learn");
  const [capture, setCapture] = useState(false);
  const [evtCount, setEvtCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const p = localStorage.getItem("electrace:profile"); if (p) { const o = JSON.parse(p); setName(o.name || "You"); setEmail(o.email || ""); }
      const t = localStorage.getItem("electrace:theme") as Theme | null; if (t) setTheme(t);
      const a = localStorage.getItem("electrace:accent"); if (a) setAccent(a);
      setSym(getSymbolStyle());
      const r = localStorage.getItem("electrace:role"); if (r) setRole(r);
    } catch { /* ignore */ }
    const sync = () => { setCapture(telemetryEnabled()); setEvtCount(getEvents().length); };
    sync();
    window.addEventListener("electrace:telemetry", sync);
    return () => window.removeEventListener("electrace:telemetry", sync);
  }, []);

  const saveName = (n: string) => { setName(n); try { localStorage.setItem("electrace:profile", JSON.stringify({ name: n.trim() || "You", email })); } catch { /* ignore */ } };
  const pickTheme = (t: Theme) => { setTheme(t); applyTheme(t); };
  const pickAccent = (c: string) => { setAccent(c); applyAccent(c); };
  const pickSym = (s: SymStyle) => { setSym(s); setSymbolStyle(s); };
  const pickRole = (v: string) => { setRole(v); try { localStorage.setItem("electrace:role", v); } catch { /* ignore */ } };

  if (!mounted) return <main className="mx-auto max-w-2xl px-7 py-12" />; // avoid SSR/localStorage hydration mismatch

  return (
    <main className="mx-auto max-w-2xl px-7 py-12">
      <Link href="/projects" className="text-sm text-faint hover:text-dim">← Back to your designs</Link>
      <header className="mt-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Settings</h1>
        <p className="mt-1 text-dim">Preferences are stored in your browser. Account settings arrive with the cloud backend.</p>
      </header>

      <Card title="Profile">
        <Row title="Display name" hint="Shown on your dashboard.">
          <input value={name} onChange={(e) => saveName(e.target.value)}
            className="w-48 rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-accent" />
        </Row>
        <Row title="Email" hint={email ? "From your local sign-in." : "Set when you sign in."}>
          <span className="text-sm text-dim">{email || "—"}</span>
        </Row>
      </Card>

      <Card title="Appearance">
        <Row title="Theme">
          {THEMES.map((t) => <button key={t.k} onClick={() => pickTheme(t.k)} className={pill(theme === t.k)}>{t.label}</button>)}
        </Row>
        <Row title="Accent">
          {ACCENTS.map((a) => (
            <button key={a.k} onClick={() => pickAccent(a.c)} aria-label={a.k}
              className={`h-7 w-7 rounded-full border-2 transition ${accent === a.c ? "border-text" : "border-transparent hover:border-border-strong"}`}
              style={{ background: a.c }} />
          ))}
        </Row>
      </Card>

      <Card title="Schematic symbols">
        <Row title="Standard" hint="ANSI (US, zig-zag resistor) or IEC (international, box resistor).">
          <button onClick={() => pickSym("ansi")} className={pill(sym === "ansi")}>ANSI</button>
          <button onClick={() => pickSym("iec")} className={pill(sym === "iec")}>IEC</button>
        </Row>
      </Card>

      <Card title="You">
        <Row title="I'm using Electrace for" hint="Tunes tone and defaults.">
          {ROLES.map((r) => <button key={r.v} onClick={() => pickRole(r.v)} className={pill(role === r.v)}>{r.ic} {r.t}</button>)}
        </Row>
        <Row title="Re-run the welcome tour">
          <Link href="/welcome" className={pill(false)}>Open onboarding →</Link>
        </Row>
      </Card>

      <Card title="Privacy">
        <Row title="Local usage capture" hint="Anonymized editor events, stored only in your browser — never sent anywhere.">
          <button onClick={() => setTelemetry(!capture)} className={pill(capture)}>{capture ? "On" : "Off"}</button>
          {capture && evtCount > 0 && (
            <button onClick={clearEvents} className="text-[13px] text-faint hover:text-text">clear ({evtCount})</button>
          )}
        </Row>
        <Row title="Legal">
          <Link href="/privacy" className="text-sm text-link hover:underline">Privacy</Link>
          <span className="text-faint">·</span>
          <Link href="/terms" className="text-sm text-link hover:underline">Terms</Link>
        </Row>
      </Card>
    </main>
  );
}
