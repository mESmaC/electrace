"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listProjects, createProject, deleteProject, renameProject, getDesign, type ProjectMeta } from "@/lib/projects";

function relTime(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [mounted, setMounted] = useState(false);
  const refresh = () => setProjects(listProjects());
  useEffect(() => { setMounted(true); refresh(); }, []);

  const onNew = () => {
    const name = window.prompt("Name your project", "Untitled project");
    if (name === null) return;
    router.push(`/editor?p=${createProject(name).id}`);
  };
  const onOpen = (id: string) => router.push(`/editor?p=${id}`);
  const onRename = (id: string, cur: string) => { const n = window.prompt("Rename project", cur); if (n !== null) { renameProject(id, n); refresh(); } };
  const onDelete = (id: string, name: string) => { if (window.confirm(`Delete “${name}”? This can't be undone.`)) { deleteProject(id); refresh(); } };

  return (
    <main className="mx-auto max-w-5xl px-7 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-dim">Start a new design, or pick up where you left off.</p>
        </div>
        <button onClick={onNew} className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-white transition-colors hover:bg-accent-hi">+ New project</button>
      </div>

      {!mounted ? (
        <div className="mt-16 text-center text-faint">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-bg2/40 px-6 py-16 text-center">
          <div className="text-3xl">⚡</div>
          <h2 className="mt-3 text-lg font-semibold">No projects yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-dim">A project is a full design — blocks, wiring, power budget, PCB. Create one to get started.</p>
          <button onClick={onNew} className="mt-5 rounded-xl bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-hi">Create your first project</button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const d = getDesign(p.id);
            const blocks = d?.blocks.length ?? 0, conns = d?.connections.length ?? 0;
            return (
              <div key={p.id} className="group flex flex-col rounded-xl border border-border bg-surface transition-colors hover:border-accent">
                <button onClick={() => onOpen(p.id)} className="flex-1 rounded-t-xl p-4 text-left">
                  <div className="flex items-start gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/40 bg-accent/15 text-accent">▦</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text">{p.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-faint">edited {relTime(p.updatedAt)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3 font-mono text-[11px] text-dim">
                    <span>{blocks} block{blocks === 1 ? "" : "s"}</span>
                    <span className="text-border-strong">·</span>
                    <span>{conns} net{conns === 1 ? "" : "s"}</span>
                  </div>
                </button>
                <div className="flex items-center gap-1 border-t border-border px-3 py-2 text-[12px]">
                  <button onClick={() => onOpen(p.id)} className="rounded px-2 py-1 font-medium text-accent hover:bg-accent/10">Open →</button>
                  <button onClick={() => onRename(p.id, p.name)} className="ml-auto rounded px-2 py-1 text-faint hover:bg-surface-2 hover:text-text">Rename</button>
                  <button onClick={() => onDelete(p.id, p.name)} className="rounded px-2 py-1 text-faint hover:bg-[#3a1c20] hover:text-[#e2837e]">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
