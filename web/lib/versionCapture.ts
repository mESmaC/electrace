// Version capture: shared by the designs upsert (auto checkpoints) and the versions API
// (manual snapshots, restores). Policy lives here in one place: semantic dedupe (positions
// stripped — dragging a block around is not a new version), a time floor for autos, and
// retention pruning (free keeps the newest 5, Pro a deep 200).
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_VERSION_KEEP = 5;
export const PRO_VERSION_KEEP = 200;
const AUTO_MIN_GAP_MS = 15 * 60_000; // at most one auto checkpoint per 15 min of editing

type Graph = { name?: string; blocks?: unknown[]; connections?: unknown[]; connectors?: unknown[] } & Record<string, unknown>;

/** Position-free fingerprint — the same idea as the editor's semanticKey. */
export function semanticHash(graph: Graph): string {
  const strip = (xs?: unknown[]) => (xs ?? []).map((x) => { const { pos: _p, ...rest } = (x as Record<string, unknown>) ?? {}; return rest; });
  const s = JSON.stringify({ ...graph, blocks: strip(graph.blocks), connectors: strip(graph.connectors) });
  return createHash("sha1").update(s).digest("hex");
}

export function summarize(graph: Graph): { blocks: number; connections: number; name?: string } {
  return { blocks: graph.blocks?.length ?? 0, connections: graph.connections?.length ?? 0, ...(graph.name ? { name: String(graph.name).slice(0, 120) } : {}) };
}

export async function captureVersion(
  sb: SupabaseClient,
  opts: {
    designId: string; ownerId: string; graph: Graph; pcb?: unknown; pro: boolean;
    kind?: "auto" | "manual" | "restore"; label?: string; parentId?: number | null;
  },
): Promise<{ id?: number; skipped?: string }> {
  const kind = opts.kind ?? "auto";
  const shash = semanticHash(opts.graph);

  const { data: latest } = await sb
    .from("design_versions")
    .select("id, shash, created_at, kind")
    .eq("design_id", opts.designId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (kind === "auto") {
    if (latest?.shash === shash) return { skipped: "unchanged" };
    if (latest && Date.now() - new Date(latest.created_at).getTime() < AUTO_MIN_GAP_MS) return { skipped: "debounced" };
  }

  const { data: inserted, error } = await sb
    .from("design_versions")
    .insert({
      design_id: opts.designId, owner_id: opts.ownerId,
      parent_id: opts.parentId ?? latest?.id ?? null,
      kind, label: opts.label?.slice(0, 120) || null,
      shash, summary: summarize(opts.graph),
      graph: opts.graph, ...(opts.pcb !== undefined ? { pcb: opts.pcb } : {}),
    })
    .select("id")
    .single();
  if (error || !inserted) return { skipped: "error" };

  // retention: newest N survive; count() + ranged delete keeps this one cheap query each
  const keep = opts.pro ? PRO_VERSION_KEEP : FREE_VERSION_KEEP;
  const { data: stale } = await sb
    .from("design_versions")
    .select("id")
    .eq("design_id", opts.designId)
    .order("created_at", { ascending: false })
    .range(keep, keep + 24);
  if (stale?.length) await sb.from("design_versions").delete().in("id", stale.map((r) => r.id));

  return { id: inserted.id };
}
