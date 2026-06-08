"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listProjects, createProject, deleteProject, renameProject, getDesign, setStar, type ProjectMeta, type LintSummary } from "@/lib/projects";
import { onHydrated } from "@/lib/serverSync";
import { isLoggedIn, getProfile } from "@/lib/auth";
import { HOBBY_DESIGN_CAP } from "@/lib/plans";
import { confirmDialog, promptDialog } from "@/app/ui/dialog";
import { openContextMenu } from "@/app/ui/contextMenu";
import type { Design } from "@electrace/core";

function relTime(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}
const STRIPE = ["#f7b13c", "#3fd0e6", "#46dca6", "#c08cf7", "#f178b6", "#4c8dff"];
const TEMPLATES = [
  { name: "Power supply", desc: "Entry → regulate → rails", glyph: "⎓", cls: "text-amber bg-amber/15 border-amber/40" },
  { name: "Buck converter", desc: "Step a voltage down", glyph: "⇄", cls: "text-[#3fd0e6] bg-[#3fd0e6]/15 border-[#3fd0e6]/40" },
  { name: "MCU board", desc: "Micro + power + IO", glyph: "⊞", cls: "text-[#c08cf7] bg-[#c08cf7]/15 border-[#c08cf7]/40" },
  { name: "Sensor front-end", desc: "Amplify → filter → ADC", glyph: "⊳", cls: "text-green bg-green/15 border-green/40" },
  { name: "Blank canvas", desc: "Start from nothing", glyph: "＋", cls: "text-dim bg-surface-2 border-border" },
];

/** Per-design lint status, derived from the summary the editor stashes on save. */
function statusChip(lint?: LintSummary): { label: string; icon: string; cls: string } {
  if (!lint) return { label: "Not checked", icon: "○", cls: "text-faint border-border" };
  const issues = lint.error + lint.warn;
  if (issues === 0) return { label: "Ready", icon: "✓", cls: "text-green border-green/40 bg-green/10" };
  if (lint.error > 0) return { label: `${issues} issue${issues > 1 ? "s" : ""}`, icon: "▲", cls: "text-[#e2837e] border-[#e2837e]/45 bg-[#e2554b]/10" };
  return { label: `${lint.warn} warning${lint.warn > 1 ? "s" : ""}`, icon: "▲", cls: "text-amber border-amber/45 bg-amber/10" };
}

/** A stylized peek of a design — up to 4 of its blocks as accent-striped cards with wires. */
function Thumb({ design }: { design: Design | null }) {
  const n = Math.min(4, design?.blocks?.length ?? 0);
  if (!n) return <div className="grid h-full place-items-center text-[11px] text-faint">empty</div>;
  const w = 300, h = 140, bw = Math.min(80, (w - 40) / n - 12);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
      {Array.from({ length: n - 1 }).map((_, i) => {
        const x = 24 + (i + 1) * (bw + 24) - 12; return <line key={i} x1={x} y1={h / 2} x2={x + 12} y2={h / 2} stroke={STRIPE[i % STRIPE.length]} strokeWidth={2.5} />;
      })}
      {Array.from({ length: n }).map((_, i) => {
        const x = 24 + i * (bw + 24);
        return (
          <g key={i}>
            <rect x={x} y={h / 2 - 21} width={bw} height={42} rx={9} className="fill-surface-2 stroke-border-strong" />
            <rect x={x} y={h / 2 - 21} width={5} height={42} rx={2} fill={STRIPE[i % STRIPE.length]} />
          </g>
        );
      })}
    </svg>
  );
}

type Nav = "recent" | "starred" | "drafts";
type Sort = "recent" | "name" | "issues";

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [promo, setPromo] = useState(true);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [nav, setNav] = useState<Nav>("recent");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const refresh = () => setProjects(listProjects());
  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; } // your designs are account-specific
    try { if (!localStorage.getItem("electrace:onboarded")) { router.replace("/welcome"); return; } } catch { /* ignore */ }
    setProfile(getProfile());
    setMounted(true); refresh(); return onHydrated(refresh);
  }, [router]);
  const who = profile?.name?.trim() || "You";
  const initials = who.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "YOU";

  const open = (id: string) => router.push(`/editor?p=${id}`);
  const newProject = async (name?: string) => {
    if (listProjects().length >= HOBBY_DESIGN_CAP) {
      if (await confirmDialog({ title: "You've reached the Hobby limit", message: `Hobby includes up to ${HOBBY_DESIGN_CAP} designs. Upgrade to Pro for unlimited designs and private projects.`, confirmText: "See plans", cancelText: "Not now" })) router.push("/pricing");
      return;
    }
    open(createProject(name).id);
  };
  const onRename = async (id: string, cur: string) => {
    const n = await promptDialog({ title: "Rename design", defaultValue: cur, placeholder: "Design name", confirmText: "Rename" });
    if (n !== null) { renameProject(id, n); refresh(); }
  };
  const onDelete = async (id: string, name: string) => {
    if (await confirmDialog({ title: `Delete “${name}”?`, message: "This can't be undone.", confirmText: "Delete", danger: true })) { deleteProject(id); refresh(); }
  };
  const toggleStar = (id: string, cur?: boolean) => { setStar(id, !cur); refresh(); };

  const designs = useMemo(() => new Map(projects.map((p) => [p.id, getDesign(p.id)])), [projects]);
  const blocksOf = (id: string) => designs.get(id)?.blocks?.length ?? 0;
  const issuesOf = (p: ProjectMeta) => (p.lint ? p.lint.error + p.lint.warn : 0);
  const totalBlocks = useMemo(() => projects.reduce((a, p) => a + blocksOf(p.id), 0), [projects, designs]); // eslint-disable-line react-hooks/exhaustive-deps
  const openIssues = useMemo(() => projects.reduce((a, p) => a + issuesOf(p), 0), [projects]);
  const starCount = useMemo(() => projects.filter((p) => p.starred).length, [projects]);
  const recent = projects.slice(0, 4);

  const filtered = useMemo(() => {
    let list = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (nav === "starred") list = list.filter((p) => p.starred);
    else if (nav === "drafts") list = list.filter((p) => blocksOf(p.id) === 0);
    const out = [...list];
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "issues") out.sort((a, b) => issuesOf(b) - issuesOf(a));
    else out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  }, [projects, query, nav, sort, designs]); // eslint-disable-line react-hooks/exhaustive-deps

  const navTitle = nav === "starred" ? "Starred" : nav === "drafts" ? "Drafts" : "All designs";
  const showIntro = nav === "recent" && !query;

  const sideLink = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-dim hover:bg-surface-2 hover:text-text";
  const navBtn = (k: Nav, icon: string, label: string, count?: number) => (
    <button onClick={() => setNav(k)} className={`${sideLink} ${nav === k ? "bg-accent/15 text-text" : ""}`}>
      <span className="w-4 text-center">{icon}</span> {label}
      {count ? <span className="ml-auto font-mono text-[11px] text-faint">{count}</span> : null}
    </button>
  );

  const cardMenu = (p: ProjectMeta) => [
    { label: "Open", icon: "↗", onSelect: () => open(p.id) },
    { label: p.starred ? "Unstar" : "Star", icon: "★", onSelect: () => toggleStar(p.id, p.starred) },
    { label: "Rename", icon: "✎", onSelect: () => onRename(p.id, p.name) },
    { separator: true as const },
    { label: "Delete", icon: "🗑", danger: true, onSelect: () => onDelete(p.id, p.name) },
  ];

  // until the session check passes, render nothing (logged-out users are mid-redirect to /login)
  if (!mounted) return <div style={{ height: "calc(100vh - 3.5rem)" }} />;

  return (
    <div className="flex" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col overflow-auto border-r border-border bg-surface p-3 md:flex">
        <div className="mb-3.5 flex items-center gap-2.5 rounded-xl border border-border p-2">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-gradient-to-br from-accent to-[#7c6cff] text-[13px] font-extrabold text-white">UN</span>
          <span className="leading-tight"><span className="block text-[14px] font-bold">US Nylon</span><span className="text-[11px] text-faint">Free plan</span></span>
          <span className="ml-auto text-faint">▾</span>
        </div>
        <button onClick={() => newProject()} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 font-semibold text-white shadow-lg shadow-accent/30 hover:bg-accent-hi">＋ New design</button>
        <nav className="flex flex-col gap-0.5">
          {navBtn("recent", "⌂", "Recents")}
          {navBtn("starred", "★", "Starred", starCount)}
          {navBtn("drafts", "▤", "Drafts")}
        </nav>
        <div className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-wider text-faint">Library</div>
        <nav className="flex flex-col gap-0.5">
          <Link href="/blocks" className={sideLink}><span className="w-4 text-center">◳</span> Blocks</Link>
          <Link href="/help" className={sideLink}><span className="w-4 text-center">◎</span> Learn</Link>
        </nav>
        <div className="flex-1" />
        <Link href="/pricing" className="mb-2.5 block rounded-xl border border-border bg-surface-2 p-3 transition hover:border-accent">
          <div className="flex justify-between text-[12px] font-semibold"><span>Hobby plan</span><span className="font-mono text-faint">{projects.length} / {HOBBY_DESIGN_CAP}</span></div>
          <div className="my-2 h-1.5 overflow-hidden rounded bg-bg"><div className={`h-full rounded ${projects.length >= HOBBY_DESIGN_CAP ? "bg-[#e2837e]" : "bg-accent"}`} style={{ width: `${Math.min(100, (projects.length / HOBBY_DESIGN_CAP) * 100)}%` }} /></div>
          <div className="text-[12px] font-semibold text-accent">Upgrade for unlimited + private →</div>
        </Link>
        <Link href="/settings" className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 hover:bg-surface-2">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-gradient-to-br from-accent to-[#7c6cff] text-[12px] font-bold text-white">{initials}</span>
          <span className="leading-tight"><span className="block text-[13px] font-semibold">{who}</span><span className="text-[11px] text-faint">{profile?.email || "Signed in on this device"}</span></span>
          <span className="ml-auto text-faint">⚙</span>
        </Link>
      </aside>

      {/* main */}
      <main className="flex-1 overflow-auto">
        <div className="px-7 py-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-extrabold tracking-tight">Your designs</h1>
            <div className="ml-auto flex w-full max-w-[360px] items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-faint">
              ⌕<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search designs…" className="w-full bg-transparent text-[13.5px] text-text outline-none placeholder:text-faint" />
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"><span className="text-faint">Designs</span> <b className="font-mono">{mounted ? projects.length : "—"}</b></div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"><span className="text-faint">Blocks placed</span> <b className="font-mono">{mounted ? totalBlocks : "—"}</b></div>
            <div className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-[13px] ${mounted && openIssues > 0 ? "border-[#e2837e]/45" : "border-border"}`}>
              <span className="text-faint">Open issues</span> <b className={`font-mono ${mounted && openIssues > 0 ? "text-[#e2837e]" : ""}`}>{mounted ? openIssues : "—"}</b>
            </div>
            {recent[0] && <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px]"><span className="text-faint">Last edit</span> <b className="font-mono">{relTime(recent[0].updatedAt)}</b></div>}
          </div>

          {showIntro && promo && (
            <div className="mt-5 flex items-center gap-3.5 rounded-xl border p-4" style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent)", borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)" }}>
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-accent text-[18px]">✦</span>
              <span><div className="text-[14px] font-semibold">Build faster with Sparky</div><div className="text-[12.5px] text-dim">Ask the assistant to wire a chip from its part number, or fan a big board out to parallel sparks.</div></span>
              <button onClick={() => newProject()} className="ml-auto whitespace-nowrap text-[13px] font-semibold text-accent">New design →</button>
              <button onClick={() => setPromo(false)} className="ml-1.5 text-faint hover:text-text">✕</button>
            </div>
          )}

          {/* jump back in */}
          {showIntro && recent.length > 0 && (<>
            <div className="mb-3.5 mt-8 text-[15px] font-bold">Jump back in</div>
            <div className="flex gap-4 overflow-auto pb-1.5">
              {recent.map((p) => {
                const st = statusChip(p.lint);
                return (
                  <button key={p.id} onClick={() => open(p.id)} onContextMenu={(e) => openContextMenu(e, cardMenu(p))} className="w-[260px] shrink-0 overflow-hidden rounded-2xl border border-border bg-surface text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-xl">
                    <div className="h-[120px] border-b border-border bg-bg" style={{ backgroundImage: "radial-gradient(color-mix(in srgb, var(--color-text) 6%, transparent) 1.3px, transparent 1.3px)", backgroundSize: "15px 15px" }}><Thumb design={designs.get(p.id) ?? null} /></div>
                    <div className="flex items-center gap-2 px-3.5 py-2.5">
                      <span className="flex-1 truncate text-[13.5px] font-semibold">{p.name}</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold ${st.cls}`}>{st.icon}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>)}

          {/* templates */}
          {showIntro && (<>
            <div className="mb-3.5 mt-8 text-[15px] font-bold">Start something new</div>
            <div className="flex gap-3 overflow-auto pb-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.name} onClick={() => newProject(t.name === "Blank canvas" ? undefined : t.name)} className="w-[188px] shrink-0 rounded-xl border border-border bg-surface p-3.5 text-left transition hover:-translate-y-0.5 hover:border-accent">
                  <div className={`mb-2.5 grid h-[34px] w-[34px] place-items-center rounded-lg border text-[16px] ${t.cls}`}>{t.glyph}</div>
                  <div className="text-[13.5px] font-semibold">{t.name}</div><div className="mt-0.5 text-[11.5px] text-faint">{t.desc}</div>
                </button>
              ))}
            </div>
          </>)}

          {/* designs grid/list with toolbar */}
          <div className="mb-3.5 mt-8 flex flex-wrap items-center gap-3">
            <span className="text-[15px] font-bold">{navTitle}</span>
            <span className="text-[12.5px] text-faint">{mounted ? `${filtered.length} design${filtered.length === 1 ? "" : "s"}` : ""}</span>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[12px] text-faint">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-text outline-none focus:border-accent">
                  <option value="recent">Last edited</option>
                  <option value="name">Name</option>
                  <option value="issues">Open issues</option>
                </select>
              </label>
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button onClick={() => setView("grid")} title="Grid" className={`px-2 py-1 text-[13px] ${view === "grid" ? "bg-accent/15 text-accent" : "text-faint hover:text-text"}`}>▦</button>
                <button onClick={() => setView("list")} title="List" className={`px-2 py-1 text-[13px] ${view === "list" ? "bg-accent/15 text-accent" : "text-faint hover:text-text"}`}>≣</button>
              </div>
            </div>
          </div>

          {mounted && filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
              <div className="text-[15px] font-semibold">{query ? "No designs match." : nav === "starred" ? "No starred designs." : nav === "drafts" ? "No empty drafts." : "No designs yet."}</div>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-dim">{query ? "Try a different search." : nav === "starred" ? "Star a design to keep it handy here." : "Start your first board — pick a template above, or open the sample."}</p>
              {!query && nav === "recent" && <button onClick={() => newProject()} className="mt-4 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-hi">+ New design</button>}
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(258px, 1fr))" }}>
              {filtered.map((p) => {
                const st = statusChip(p.lint), blocks = blocksOf(p.id);
                return (
                  <div key={p.id} className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-accent hover:shadow-xl" onClick={() => open(p.id)} onContextMenu={(e) => openContextMenu(e, cardMenu(p))}>
                    <div className="relative h-[140px] border-b border-border bg-bg" style={{ backgroundImage: "radial-gradient(color-mix(in srgb, var(--color-text) 6%, transparent) 1.3px, transparent 1.3px)", backgroundSize: "16px 16px" }}>
                      <Thumb design={designs.get(p.id) ?? null} />
                      <button onClick={(e) => { e.stopPropagation(); toggleStar(p.id, p.starred); }} title={p.starred ? "Unstar" : "Star"}
                        className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg border border-border bg-surface/80 text-[13px] backdrop-blur transition ${p.starred ? "text-amber opacity-100" : "text-faint opacity-0 hover:text-text group-hover:opacity-100"}`}>{p.starred ? "★" : "☆"}</button>
                    </div>
                    <div className="px-3.5 pb-3 pt-3">
                      <div className="flex items-center gap-2"><span className="flex-1 truncate text-[14.5px] font-semibold">{p.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); onRename(p.id, p.name); }} title="Rename" className="text-faint opacity-0 hover:text-text group-hover:opacity-100">✎</button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(p.id, p.name); }} title="Delete" className="text-faint opacity-0 hover:text-[#e2837e] group-hover:opacity-100">🗑</button>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-faint">Edited {relTime(p.updatedAt)} · by you</div>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-dim">{blocks} block{blocks === 1 ? "" : "s"}</span>
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${st.cls}`}>{st.icon} {st.label}</span>
                        <span className="ml-auto grid h-[23px] w-[23px] place-items-center rounded-full bg-accent text-[9.5px] font-bold text-white ring-2 ring-surface">YOU</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              {filtered.map((p, i) => {
                const st = statusChip(p.lint), blocks = blocksOf(p.id);
                return (
                  <div key={p.id} className={`group flex cursor-pointer items-center gap-3 bg-surface px-4 py-2.5 transition hover:bg-surface-2 ${i ? "border-t border-border" : ""}`} onClick={() => open(p.id)} onContextMenu={(e) => openContextMenu(e, cardMenu(p))}>
                    <button onClick={(e) => { e.stopPropagation(); toggleStar(p.id, p.starred); }} title={p.starred ? "Unstar" : "Star"} className={`text-[14px] ${p.starred ? "text-amber" : "text-faint opacity-0 hover:text-text group-hover:opacity-100"}`}>{p.starred ? "★" : "☆"}</button>
                    <span className="w-[34%] min-w-0 flex-1 truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="hidden w-20 shrink-0 font-mono text-[11.5px] text-faint sm:inline">{blocks} block{blocks === 1 ? "" : "s"}</span>
                    <span className={`hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold sm:flex ${st.cls}`}>{st.icon} {st.label}</span>
                    <span className="hidden w-24 shrink-0 text-right text-[11.5px] text-faint md:inline">{relTime(p.updatedAt)}</span>
                    <button onClick={(e) => { e.stopPropagation(); onRename(p.id, p.name); }} title="Rename" className="shrink-0 text-faint opacity-0 hover:text-text group-hover:opacity-100">✎</button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(p.id, p.name); }} title="Delete" className="shrink-0 text-faint opacity-0 hover:text-[#e2837e] group-hover:opacity-100">🗑</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
