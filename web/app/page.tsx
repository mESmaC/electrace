import Link from "next/link";
import RevealScript from "./RevealScript";

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-[12.5px] font-bold uppercase tracking-[1.4px] text-accent">{children}</div>
);

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      {/* ===== HERO ===== */}
      <header className="relative px-7 pb-16 pt-[74px] text-center">
        <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[560px] w-[1000px] -translate-x-1/2"
          style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent)" }} />
        <div className="relative mx-auto max-w-[1140px]">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold text-accent" style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)", borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)" }}>⚡ The electrical engineer&apos;s IDE</span>
          <h1 className="text-[54px] font-black leading-[0.98] tracking-[-2px] sm:text-[74px] sm:tracking-[-2.5px]">See inside<br />every circuit.<span className="ec-blink ml-1.5 inline-block h-9 w-2 translate-y-1 rounded-[1px] bg-accent align-middle sm:h-14" /></h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[20px] text-dim">Blocks that explain themselves — and catch what doesn&apos;t add up.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:bg-accent-hi">Get early access</Link>
            <a href="#how" className="rounded-xl border border-border-strong px-6 py-3 font-semibold transition hover:border-accent hover:text-accent">Watch it work ↓</a>
          </div>
          <div className="mt-4 text-[13px] text-faint">No simulation · no guessing · vendor-neutral</div>

          {/* product window */}
          <div className="ec-float mx-auto mt-14 max-w-[940px] overflow-hidden rounded-2xl border border-border-strong bg-surface text-left shadow-2xl">
            <div className="flex h-11 items-center gap-2 border-b border-border bg-surface-2 px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2.5 font-mono text-[12px] text-dim">buck-supply.elec — Electrace</span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-green">● all nets connected</span>
            </div>
            <div className="relative grid h-[360px] place-items-center overflow-hidden bg-bg" style={{ backgroundImage: "radial-gradient(color-mix(in srgb, var(--color-text) 5%, transparent) 1.4px, transparent 1.4px)", backgroundSize: "22px 22px" }}>
              <div className="relative h-[290px] w-[560px] scale-[0.74] sm:scale-100">
                {/* port-to-port wires — straight, like a real schematic net */}
                <svg viewBox="0 0 560 290" className="pointer-events-none absolute inset-0 h-full w-full">
                  <path className="ec-wire" d="M218 150 H300" stroke="var(--color-amber)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                  <path className="ec-wire" style={{ animationDelay: "0.45s" }} d="M218 178 H300" stroke="var(--color-gray)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                </svg>

                {/* hover-to-explain tooltip — ABOVE the buck block, pointing down to it */}
                <div className="ec-tip pointer-events-none absolute left-[296px] top-[2px] z-20 w-[220px] rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-[11.5px] leading-snug shadow-xl">
                  <b className="font-semibold text-accent">✦ U1 — buck controller.</b> Holds 5 V from a 9–18 V input; R1/R2 set the voltage.
                  <span className="absolute bottom-[-5px] left-7 h-2.5 w-2.5 rotate-45 border-b border-r border-border-strong bg-surface" />
                </div>

                {/* lint bubble — BELOW the blocks, clear of everything */}
                <div className="ec-bubble absolute left-[150px] top-[236px] z-20 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border-strong bg-surface px-3 py-2 text-[11.5px] shadow-xl">
                  <span className="text-accent">✦</span><span className="text-green">●</span>Plenty of headroom — 9 W of 15 W.
                </div>

                <svg className="ec-cursor pointer-events-none absolute z-30 h-5 w-5 drop-shadow" viewBox="0 0 20 20"><path d="M2 2 L2 16 L6 12 L9 18 L11 17 L8 11 L14 11 Z" fill="#fff" stroke="#0e1015" strokeWidth={1.2} /></svg>

                <WindowBlock x={18} y={58} glyph="⎓" tone="amber" name="Power Entry" tag="disc" spec="9–18 V DC in"
                  ports={[{ side: "in", top: 101, tone: "amber" }, { side: "out", top: 87, tone: "amber" }, { side: "out", top: 115, tone: "gray" }]}
                  preview={<>
                    <circle cx={16} cy={26} r={8} fill="none" stroke="currentColor" strokeWidth={1.5} /><line x1={13} y1={23} x2={19} y2={29} stroke="currentColor" strokeWidth={1.5} />
                    <line x1={24} y1={26} x2={48} y2={26} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <polygon points="48,19 48,33 62,26" fill="currentColor" /><line x1={62} y1={19} x2={62} y2={33} stroke="currentColor" strokeWidth={1.7} />
                    <line x1={62} y1={26} x2={186} y2={26} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <line x1={124} y1={26} x2={124} y2={40} stroke="var(--color-accent)" strokeWidth={1.7} /><line x1={114} y1={40} x2={134} y2={40} stroke="currentColor" strokeWidth={1.7} /><line x1={114} y1={46} x2={134} y2={46} stroke="currentColor" strokeWidth={1.7} /><line x1={124} y1={46} x2={124} y2={62} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <line x1={62} y1={62} x2={150} y2={62} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <g stroke="currentColor" strokeWidth={1.7}><line x1={98} y1={62} x2={98} y2={68} /><line x1={90} y1={68} x2={106} y2={68} /><line x1={94} y1={71} x2={102} y2={71} /></g>
                  </>} />
                <WindowBlock x={300} y={58} glyph="⇄" tone="cyan" name="Buck Regulator" tag="IC" spec="9–18 V → 5 V · 3 A"
                  ports={[{ side: "in", top: 87, tone: "amber" }, { side: "in", top: 115, tone: "gray" }, { side: "out", top: 87, tone: "green", label: "+5 V" }]}
                  preview={<>
                    <line x1={8} y1={22} x2={46} y2={22} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <line x1={26} y1={22} x2={26} y2={34} stroke="var(--color-accent)" strokeWidth={1.7} /><line x1={18} y1={34} x2={34} y2={34} stroke="currentColor" strokeWidth={1.7} /><line x1={18} y1={38} x2={34} y2={38} stroke="currentColor" strokeWidth={1.7} /><line x1={26} y1={38} x2={26} y2={60} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <rect x={46} y={12} width={46} height={40} rx={3} fill="var(--color-surface-3)" stroke="currentColor" strokeWidth={1.7} /><text x={69} y={36} textAnchor="middle" className="fill-current font-mono text-[10px]">U1</text>
                    <line x1={92} y1={22} x2={104} y2={22} stroke="var(--color-accent)" strokeWidth={1.7} /><path d="M104 22 q5 -8 10 0 q5 -8 10 0 q5 -8 10 0" stroke="currentColor" strokeWidth={1.7} fill="none" /><line x1={134} y1={22} x2={188} y2={22} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <line x1={152} y1={22} x2={152} y2={34} stroke="var(--color-accent)" strokeWidth={1.7} /><line x1={144} y1={34} x2={160} y2={34} stroke="currentColor" strokeWidth={1.7} /><line x1={144} y1={38} x2={160} y2={38} stroke="currentColor" strokeWidth={1.7} /><line x1={152} y1={38} x2={152} y2={60} stroke="var(--color-accent)" strokeWidth={1.7} />
                    <line x1={26} y1={60} x2={152} y2={60} stroke="var(--color-accent)" strokeWidth={1.7} /><line x1={69} y1={52} x2={69} y2={60} stroke="var(--color-accent)" strokeWidth={1.7} />
                  </>} />
              </div>
            </div>
          </div>
          <p className="mx-auto mt-3 max-w-[560px] text-[13px] text-faint">A live Electrace design — hover a block to see what it does, while the linter keeps an eye on the math.</p>
        </div>
      </header>

      {/* ===== PROBLEM ===== */}
      <section className="ec-reveal px-7 py-[70px] text-center">
        <div className="mx-auto max-w-[1140px]">
          <h2 className="text-[34px] font-extrabold tracking-tight">Other tools stay silent — or just guess.</h2>
          <p className="mx-auto mt-2 max-w-[560px] text-[18px] text-dim">Electrace is the one that makes you <span className="text-accent">understand</span>.</p>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="ec-reveal border-y border-border bg-bg2 px-7 py-[92px]">
        <div className="mx-auto max-w-[1140px] text-center">
          <Eyebrow>How it works</Eyebrow><h2 className="text-[42px] font-extrabold tracking-tight">An IDE — for circuits.</h2>
        </div>
        <div className="mx-auto mt-11 grid max-w-[1140px] gap-[18px] sm:grid-cols-3">
          {[
            { ic: "▦", h: "Self-explaining blocks", p: "Authored intent, not guesses. Every block says what it does and why." },
            { ic: "⌖", h: "Drill into anything", p: "Double-click into a block's real schematic — discrete or IC, every part labeled." },
            { ic: "✓", h: "Linting, not SPICE", p: "Instant checks on the numbers you declared. It flags what doesn't add up." },
          ].map((f) => (
            <div key={f.h} className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-4 grid h-[46px] w-[46px] place-items-center rounded-xl text-[22px] text-accent" style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)" }}>{f.ic}</div>
              <h3 className="mb-1.5 text-[17px] font-bold">{f.h}</h3><p className="text-[14px] text-dim">{f.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== SEE INSIDE ===== */}
      <section id="inside" className="ec-reveal px-7 py-[92px]">
        <div className="mx-auto grid max-w-[1140px] items-center gap-14 md:grid-cols-2">
          <div>
            <Eyebrow>Transparency</Eyebrow><h2 className="text-[42px] font-extrabold leading-[1.08] tracking-tight">Open any block.<br />Read every part.</h2>
            <p className="mt-3 max-w-[560px] text-[18px] text-dim">The one IC stops being a mystery — you see exactly what surrounds it, and why.</p>
            <ul className="mt-6 flex flex-col gap-3 text-[15px] text-dim">
              <li className="flex gap-3"><span className="font-bold text-green">✓</span> A plain-language reason on every part.</li>
              <li className="flex gap-3"><span className="font-bold text-green">✓</span> ANSI or IEC symbols — your choice.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl">
            <svg viewBox="0 0 360 200" className="w-full" style={{ color: "var(--color-text)" }}>
              <text x="12" y="30" className="fill-faint font-mono text-[11px]">VIN</text><text x="296" y="30" className="fill-green font-mono text-[11px]">+5 V</text>
              <path d="M24 40 H58 M40 40 V62 M28 62 H52 M28 68 H52 M40 68 V172" stroke="var(--color-accent)" strokeWidth={2} fill="none" />
              <rect x={58} y={24} width={74} height={60} rx={4} fill="var(--color-surface-3)" stroke="currentColor" strokeWidth={2} /><text x={95} y={58} textAnchor="middle" className="fill-current font-mono text-[13px]">U1</text>
              <path d="M132 38 H150 q9 -13 18 0 q9 -13 18 0 q9 -13 18 0 H300 V120" stroke="var(--color-accent)" strokeWidth={2} fill="none" />
              <path d="M240 38 V62 M228 62 H252 M228 68 H252 M240 68 V172" stroke="var(--color-accent)" strokeWidth={2} fill="none" />
              <polyline points="300,120 292,126 308,134 292,142 308,150 292,158 300,164" stroke="currentColor" strokeWidth={2} fill="none" />
              <text x={316} y={140} className="fill-faint font-mono text-[10px]">R1 39k</text><text x={250} y={112} className="fill-accent text-[9px] italic">↳ sets 5 V</text>
              <path d="M300 164 V176 M40 176 H300 M95 84 V176" stroke="var(--color-accent)" strokeWidth={2} fill="none" />
            </svg>
          </div>
        </div>
      </section>

      {/* ===== TYPED NETS ===== */}
      <section className="ec-reveal border-y border-border bg-bg2 px-7 py-[92px]">
        <div className="mx-auto grid max-w-[1140px] items-center gap-14 md:grid-cols-2">
          <div className="rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl">
            <div className="mx-auto flex max-w-[300px] flex-col gap-2.5">
              <NetCard tone="var(--color-green)" name="+5 V" meta="rail · connected" />
              <NetCard tone="var(--color-gray)" name="GND" meta="ground · connected" />
              <div className="flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 font-mono text-[13px]" style={{ borderColor: "color-mix(in srgb, var(--color-amber) 45%, transparent)", color: "var(--color-amber)" }}>
                <span className="h-2.5 w-2.5 rounded-full border border-dashed border-current" />STATUS<span className="ml-auto text-[11px]">⚠ not wired</span>
              </div>
            </div>
          </div>
          <div>
            <Eyebrow>Typed nets</Eyebrow><h2 className="text-[42px] font-extrabold leading-[1.08] tracking-tight">Nothing<br />forgotten.</h2>
            <p className="mt-3 max-w-[560px] text-[18px] text-dim">Connect net-to-net — 5 V to 5 V, ground to ground. Leave one dangling and Electrace tells you, right there.</p>
          </div>
        </div>
      </section>

      {/* ===== WHY ===== */}
      <section id="why" className="ec-reveal px-7 py-[92px]">
        <div className="mx-auto max-w-[1140px] text-center">
          <Eyebrow>Why Electrace</Eyebrow><h2 className="text-[42px] font-extrabold leading-[1.08] tracking-tight">Not guessing. Not SPICE.<br />Not locked in.</h2>
        </div>
        <div className="mx-auto mt-11 grid max-w-[1140px] gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { no: "AI copilots guess", yes: "We show what's declared." },
            { no: "Generators do it for you", yes: "We make you understand it." },
            { no: "Simulators need setup", yes: "Instant arithmetic checks." },
            { no: "Vendor tools sell silicon", yes: "Vendor-neutral, always." },
          ].map((d) => (
            <div key={d.no} className="rounded-2xl border border-border bg-surface p-[22px]">
              <div className="mb-2.5 text-[13px] font-semibold text-faint line-through">{d.no}</div>
              <div className="text-[15px] font-bold text-accent">{d.yes}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ORDER ===== */}
      <section className="ec-reveal border-y border-border bg-bg2 px-7 py-[92px] text-center">
        <div className="mx-auto max-w-[1140px]">
          <Eyebrow>And when you&apos;re done</Eyebrow><h2 className="text-[42px] font-extrabold tracking-tight">Design it. Understand it. Build it.</h2>
          <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
            <span className="rounded-xl border border-border bg-surface px-5 py-3.5 font-semibold">Design with blocks</span>
            <span className="text-[20px] text-accent">→</span>
            <span className="rounded-xl border border-border bg-surface px-5 py-3.5 font-semibold">Lay out the PCB</span>
            <span className="text-[20px] text-accent">→</span>
            <span className="rounded-xl border border-border bg-surface px-5 py-3.5 font-semibold">Build it or get it made</span>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="ec-reveal px-7 py-[92px]">
        <div className="relative mx-auto max-w-[1140px] overflow-hidden rounded-3xl border border-border-strong px-7 py-[70px] text-center" style={{ background: "linear-gradient(180deg, var(--color-surface), var(--color-bg2))" }}>
          <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[430px] w-[760px] -translate-x-1/2" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent)" }} />
          <div className="relative">
            <Eyebrow>Early access</Eyebrow><h2 className="text-[42px] font-extrabold leading-[1.08] tracking-tight">Start understanding<br />your circuits.</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="rounded-xl bg-accent px-6 py-3.5 font-semibold text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:bg-accent-hi">Get early access</Link>
              <Link href="/editor" className="rounded-xl border border-border-strong px-6 py-3.5 font-semibold transition hover:border-accent hover:text-accent">Open the editor</Link>
            </div>
            <div className="mt-4 text-[13px] text-faint">Built by US Nylon · no spam, just launch news</div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border px-7 py-10 text-[14px] text-faint">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-7">
          <span className="font-mono text-[16px] font-bold text-text">Electrace<span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-[1px] bg-accent" /></span>
          <div className="flex flex-wrap gap-x-9 gap-y-2"><a href="#how" className="text-dim hover:text-text">Product</a><a href="#why" className="text-dim hover:text-text">Why</a><Link href="/pricing" className="text-dim hover:text-text">Pricing</Link><Link href="/help" className="text-dim hover:text-text">Docs</Link><Link href="/blocks" className="text-dim hover:text-text">Blocks</Link><Link href="/privacy" className="text-dim hover:text-text">Privacy</Link><Link href="/terms" className="text-dim hover:text-text">Terms</Link></div>
          <span>© 2026 US Nylon</span>
        </div>
      </footer>
      <RevealScript />
    </main>
  );
}

type Port = { side: "in" | "out"; top: number; tone: "amber" | "gray" | "green"; label?: string };
const NUB = { amber: "var(--color-amber)", gray: "var(--color-gray)", green: "var(--color-green)" };
function WindowBlock({ x, y, glyph, tone, name, tag, spec, preview, ports = [] }: { x: number; y: number; glyph: string; tone: "amber" | "cyan"; name: string; tag: string; spec: string; preview: React.ReactNode; ports?: Port[] }) {
  const toneCls = tone === "amber" ? "text-amber" : "text-[#3fd0e6]";
  const toneBg = tone === "amber" ? "color-mix(in srgb, var(--color-amber) 16%, transparent)" : "rgba(34,211,238,.16)";
  const toneBd = tone === "amber" ? "color-mix(in srgb, var(--color-amber) 40%, transparent)" : "rgba(34,211,238,.4)";
  return (
    <div className="absolute w-[200px] rounded-2xl border border-border-strong bg-surface-2 shadow-xl" style={{ left: x, top: y }}>
      <div className="flex items-center gap-2.5 px-3 pb-1.5 pt-3">
        <span className={`grid h-7 w-7 place-items-center rounded-lg border text-[14px] ${toneCls}`} style={{ background: toneBg, borderColor: toneBd }}>{glyph}</span>
        <span className="flex-1 text-[13px] font-semibold">{name}</span>
        <span className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold uppercase text-faint">{tag}</span>
      </div>
      <div className="px-3 pb-2 font-mono text-[11.5px] text-dim">{spec}</div>
      <div className="mx-2.5 mb-2.5 h-[72px] overflow-hidden rounded-lg border border-border-strong bg-bg" style={{ color: "var(--color-text)" }}>
        <svg viewBox="0 0 200 72" className="h-full w-full">{preview}</svg>
      </div>
      {/* terminal nubs sit ON the edge; any label extends OUTWARD (never over the preview) */}
      {ports.map((p, i) => (
        <span key={i}
          className={`absolute z-10 flex items-center gap-1 font-mono text-[10px] text-dim ${p.side === "in" ? "flex-row-reverse" : ""}`}
          style={{ top: p.top, ...(p.side === "in" ? { right: "calc(100% - 7px)" } : { left: "calc(100% - 7px)" }) }}>
          <i className="h-2.5 w-2.5 shrink-0 rounded-full border-2 bg-surface" style={{ borderColor: NUB[p.tone] }} />
          {p.label && <span className="whitespace-nowrap px-0.5 text-text">{p.label}</span>}
        </span>
      ))}
    </div>
  );
}
function NetCard({ tone, name, meta }: { tone: string; name: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 font-mono text-[13px]">
      <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: tone, background: `color-mix(in srgb, ${tone} 25%, transparent)` }} />{name}
      <span className="ml-auto text-[11px] text-faint">{meta}</span>
    </div>
  );
}
