"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setSymbolStyle, type SymStyle } from "@/app/editor/symbols";
import RequireAuth from "@/app/RequireAuth";
import { Logo } from "@/app/Logo";

export default function WelcomePage() {
  return <RequireAuth><WelcomeWizard /></RequireAuth>;
}

type Theme = "dark" | "mid" | "light";
const ACCENTS = [
  { k: "blue", c: "#4c8dff" }, { k: "teal", c: "#2dd4bf" }, { k: "violet", c: "#7c6cff" }, { k: "amber", c: "#f7b13c" },
];
const ROLES = [
  { v: "learn", ic: "🎓", t: "Learning", d: "Understand how circuits actually work." },
  { v: "build", ic: "🛠", t: "Building", d: "Get projects designed and made." },
  { v: "pro", ic: "💼", t: "Professionally", d: "Day-job hardware design." },
];

const applyTheme = (t: Theme) => { try { document.documentElement.setAttribute("data-theme", t); localStorage.setItem("electrace:theme", t); } catch { /* ignore */ } };
const applyAccent = (c: string) => { try { const d = document.documentElement; d.style.setProperty("--color-accent", c); d.style.setProperty("--color-accent-hi", c); localStorage.setItem("electrace:accent", c); } catch { /* ignore */ } };

function WelcomeWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("learn");
  const [sym, setSym] = useState<SymStyle>("ansi");
  const [theme, setTheme] = useState<Theme>("mid");
  const [accent, setAccent] = useState("#4c8dff");
  const total = 4;

  // Apply the live prefs as they're picked, so the wizard previews them in place.
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { applyAccent(accent); }, [accent]);

  const finish = (toSample: boolean) => {
    try {
      setSymbolStyle(sym);
      localStorage.setItem("electrace:role", role);
      localStorage.setItem("electrace:onboarded", "1");
    } catch { /* ignore */ }
    router.push(toSample ? "/editor" : "/projects");
  };
  const next = () => (step < total - 1 ? setStep(step + 1) : finish(true));
  const nextLabel = step === total - 1 ? "Open sample design →" : step === total - 2 ? "Finish →" : "Continue →";

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center p-6"
      style={{ background: "radial-gradient(900px 500px at 50% -10%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent), var(--color-bg)" }}>
      <div className="w-[680px] max-w-full overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <Logo className="text-[16px]" />
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-5 bg-accent" : "w-2 bg-surface-3"}`} />
            ))}
          </div>
          <button onClick={() => finish(false)} className="ml-3 text-[12.5px] text-faint hover:text-text">Skip</button>
        </div>

        {/* body */}
        <div className="min-h-[392px] px-10 pt-8 pb-5">
          {step === 0 && (
            <section>
              <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-accent">Welcome</div>
              <h1 className="mb-2.5 text-[30px] font-extrabold tracking-tight">Let&apos;s set up Electrace.</h1>
              <p className="max-w-[520px] text-[16px] text-dim">Two quick choices and you&apos;re in. First — what brings you here? We&apos;ll tune the tips and defaults to match.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {ROLES.map((r) => (
                  <Opt key={r.v} sel={role === r.v} onClick={() => setRole(r.v)}>
                    <span className="mb-2.5 block text-[24px]">{r.ic}</span>
                    <div className="text-[15px] font-bold">{r.t}</div>
                    <div className="mt-0.5 text-[12.5px] text-dim">{r.d}</div>
                  </Opt>
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-accent">Schematic symbols</div>
              <h1 className="mb-2.5 text-[30px] font-extrabold tracking-tight">Which symbols feel like home?</h1>
              <p className="max-w-[520px] text-[16px] text-dim">Same circuit, two conventions. Here&apos;s a resistor in each — pick your default (you can switch any time).</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Opt sel={sym === "ansi"} onClick={() => setSym("ansi")}>
                  <SymCard name="Zigzag" std="ANSI / IEEE 315" use="Common in the US & older textbooks">
                    <path d="M20 40 H66" className="stroke-accent" strokeWidth={3} fill="none" strokeLinecap="round" />
                    <path d="M66 40 L74 24 L90 56 L106 24 L122 56 L134 40" style={{ stroke: "var(--color-text)" }} strokeWidth={3} fill="none" strokeLinejoin="round" />
                    <path d="M134 40 H180" className="stroke-accent" strokeWidth={3} fill="none" strokeLinecap="round" />
                  </SymCard>
                </Opt>
                <Opt sel={sym === "iec"} onClick={() => setSym("iec")}>
                  <SymCard name="Box" std="IEC 60617" use="International & modern standard">
                    <path d="M20 40 H68" className="stroke-accent" strokeWidth={3} fill="none" strokeLinecap="round" />
                    <rect x={68} y={28} width={64} height={24} rx={2} style={{ stroke: "var(--color-text)" }} strokeWidth={3} fill="none" />
                    <path d="M132 40 H180" className="stroke-accent" strokeWidth={3} fill="none" strokeLinecap="round" />
                  </SymCard>
                </Opt>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wider text-accent">Appearance</div>
              <h1 className="mb-2.5 text-[30px] font-extrabold tracking-tight">Pick your canvas.</h1>
              <p className="max-w-[520px] text-[16px] text-dim">Three to choose from — Mid is the easy middle ground. Change it anytime in settings.</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {(["dark", "mid", "light"] as Theme[]).map((th) => (
                  <Opt key={th} sel={theme === th} onClick={() => setTheme(th)}>
                    <ThemePrev theme={th} />
                    <div className="text-[15px] font-bold capitalize">{th}</div>
                  </Opt>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2.5">
                <small className="text-[12px] font-semibold text-faint">ACCENT</small>
                {ACCENTS.map((a) => (
                  <button key={a.k} onClick={() => setAccent(a.c)} title={a.k}
                    className={`h-6 w-6 rounded-full border-2 ${accent === a.c ? "border-[var(--color-text)]" : "border-transparent"}`} style={{ background: a.c }} />
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="pt-2 text-center">
              <div className="mx-auto mb-4 mt-1.5 grid h-[72px] w-[72px] place-items-center rounded-full text-[34px] text-accent" style={{ background: "color-mix(in srgb, var(--color-accent) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)" }}>✓</div>
              <h1 className="mb-2.5 text-[30px] font-extrabold tracking-tight">You&apos;re all set.</h1>
              <p className="mx-auto max-w-[520px] text-[16px] text-dim">We loaded a sample design so you can poke around — hover a block, drill in, and watch it explain itself.</p>
              <div className="mx-auto mt-5 flex max-w-[420px] items-center gap-3.5 rounded-2xl border border-border bg-surface-2 p-3.5 text-left">
                <svg viewBox="0 0 300 148" className="h-[54px] w-[90px] shrink-0 rounded-lg border border-border bg-bg">
                  <line x1="96" y1="64" x2="128" y2="64" className="stroke-amber" strokeWidth={3} /><line x1="96" y1="80" x2="128" y2="80" className="stroke-gray" strokeWidth={3} /><line x1="214" y1="72" x2="246" y2="72" className="stroke-green" strokeWidth={3} />
                  <rect x="30" y="50" width="66" height="46" rx="9" className="fill-surface-2 stroke-border-strong" /><rect x="30" y="50" width="6" height="46" rx="2" className="fill-amber" />
                  <rect x="128" y="50" width="86" height="46" rx="9" className="fill-surface-2 stroke-border-strong" /><rect x="128" y="50" width="6" height="46" rx="2" fill="#3fd0e6" />
                  <rect x="246" y="50" width="48" height="46" rx="9" className="fill-surface-2 stroke-border-strong" /><rect x="246" y="50" width="6" height="46" rx="2" className="fill-green" />
                </svg>
                <div><div className="text-[14px] font-semibold">Sample · Buck Supply</div><div className="text-[12px] text-faint">3 blocks · power entry → regulator → load</div></div>
              </div>
            </section>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center gap-3 px-10 pb-7 pt-2">
          <button onClick={() => setStep(Math.max(0, step - 1))} className={`rounded-xl border border-border-strong px-5 py-3 font-semibold text-dim hover:border-[var(--color-text)] hover:text-text ${step === 0 ? "invisible" : ""}`}>← Back</button>
          <div className="flex-1" />
          <button onClick={next} className="rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 hover:bg-accent-hi">{nextLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Opt({ sel, onClick, children }: { sel: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`relative rounded-2xl border-[1.5px] p-[18px] text-left transition ${sel ? "border-accent bg-accent/15 ring-[3px] ring-accent/15" : "border-border bg-surface-2 hover:border-border-strong"}`}>
      <span className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-accent text-[12px] text-white transition ${sel ? "opacity-100" : "opacity-0"}`}>✓</span>
      {children}
    </button>
  );
}
function SymCard({ name, std, use, children }: { name: string; std: string; use: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 pb-4 pt-5 text-center">
      <svg viewBox="0 0 200 80" className="h-16 w-40">{children}</svg>
      <div className="mt-1.5 text-[15px] font-bold">{name}</div>
      <div className="font-mono text-[11px] text-faint">{std}</div>
      <div className="mt-1 text-[12px] text-dim">{use}</div>
    </div>
  );
}
function ThemePrev({ theme }: { theme: Theme }) {
  const sw = { dark: { bg: "#13151a", bar: "#2a2f3a", blk: "#21242c", l: "#3a4250" }, mid: { bg: "#3c4658", bar: "#54607a", blk: "#4e586f", l: "#6b7790" }, light: { bg: "#eef0f4", bar: "#d6dae2", blk: "#fff", l: "#c8cdd6" } }[theme];
  return (
    <div className="mb-3 flex h-[78px] flex-col justify-center gap-1.5 overflow-hidden rounded-[10px] border border-border px-3" style={{ background: sw.bg }}>
      <div className="h-2 w-[60%] rounded" style={{ background: sw.bar }} />
      <div className="flex h-[22px] items-center gap-1.5 rounded-md px-2" style={{ background: sw.blk }}>
        <span className="h-2 w-2 rounded-full bg-accent" /><span className="h-[5px] flex-1 rounded" style={{ background: sw.l }} />
      </div>
    </div>
  );
}
