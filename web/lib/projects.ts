// Client-side projects. A "project" is just a Design (blocks + connections) saved under
// electrace:design:<id>, exactly the key the editor already autosaves to — plus a lightweight
// index (electrace:projects) so the dashboard can list them. Maps cleanly onto a backend later.
import type { Design } from "@electrace/core";

const INDEX = "electrace:projects";
const designKey = (id: string) => `electrace:design:${id}`;

export interface LintSummary { error: number; warn: number }
export interface ProjectMeta { id: string; name: string; updatedAt: number; lint?: LintSummary; starred?: boolean }

const read = <T,>(k: string, fb: T): T => {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

/** All projects, most-recently-updated first. */
export function listProjects(): ProjectMeta[] {
  return read<ProjectMeta[]>(INDEX, []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDesign(id: string): Design | null {
  return read<Design | null>(designKey(id), null);
}

function upsertMeta(meta: ProjectMeta) {
  write(INDEX, [meta, ...read<ProjectMeta[]>(INDEX, []).filter((p) => p.id !== meta.id)]);
}

/** Create a project (optionally seeded from a base design, e.g. a template) and return its meta. */
export function createProject(name?: string, base?: Design): ProjectMeta {
  const id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const nm = (name ?? "").trim() || "Untitled project";
  const design: Design = { ...(base ?? { blocks: [], connections: [] }), id, name: nm };
  write(designKey(id), design);
  const meta = { id, name: nm, updatedAt: Date.now() };
  upsertMeta(meta);
  return meta;
}

/** Mark a project as just-edited (called by the editor's autosave). Carries the latest lint summary so
 *  the dashboard can show a per-design status without re-running analyze (it has no block library). */
export function touchProject(id: string, name?: string, lint?: LintSummary): void {
  const cur = read<ProjectMeta[]>(INDEX, []).find((p) => p.id === id);
  if (!cur && !getDesign(id)) return; // don't index a non-existent project
  upsertMeta({ id, name: name ?? cur?.name ?? "Untitled project", updatedAt: stamp(), lint: lint ?? cur?.lint, starred: cur?.starred });
}

/** Toggle a design's starred flag without bumping its edited time. */
export function setStar(id: string, starred: boolean): void {
  const cur = read<ProjectMeta[]>(INDEX, []).find((p) => p.id === id);
  if (!cur) return;
  upsertMeta({ ...cur, starred });
}

export function renameProject(id: string, name: string): void {
  const nm = name.trim() || "Untitled project";
  const d = getDesign(id);
  if (d) { d.name = nm; write(designKey(id), d); }
  touchProject(id, nm);
}

export function deleteProject(id: string): void {
  write(INDEX, read<ProjectMeta[]>(INDEX, []).filter((p) => p.id !== id));
  try { localStorage.removeItem(designKey(id)); localStorage.removeItem(`electrace:pcb:${id}`); } catch { /* ignore */ }
}

// a render-safe timestamp (Date.now is fine in the browser; guarded for SSR)
const stamp = () => (typeof window === "undefined" ? 0 : Date.now());
