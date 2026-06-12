-- Version history (DECISIONS #3, Pro-card promise). Git-SHAPED, not git machinery:
-- every version has a parent_id, so storage is a commit DAG from day one — restore creates a
-- NEW version whose parent is the restored one (history is never rewritten). Branching later
-- is a UI feature (naming heads), zero schema change. Merge is deliberately out of scope.
-- RLS: owners read/write their own rows AS themselves (the designs routes run as the user).
-- APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run (same as 0001-0006).
create table if not exists public.design_versions (
  id          bigint generated always as identity primary key,
  design_id   text not null references public.designs(id) on delete cascade,
  owner_id    uuid not null references public.users(id) on delete cascade,
  parent_id   bigint references public.design_versions(id) on delete set null,
  kind        text not null default 'auto' check (kind in ('auto','manual','restore')),
  label       text,                -- the user's name for a manual snapshot
  shash       text,                -- semantic hash (positions stripped) — dedupes no-op autosaves
  summary     jsonb,               -- {blocks, connections, name} for list display without the graph
  graph       jsonb not null,
  pcb         jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists design_versions_design_idx on public.design_versions (design_id, created_at desc);
alter table public.design_versions enable row level security;
create policy "versions are owner-readable" on public.design_versions
  for select using (owner_id = auth.uid());
create policy "versions are owner-writable" on public.design_versions
  for insert with check (owner_id = auth.uid());
create policy "versions are owner-deletable" on public.design_versions
  for delete using (owner_id = auth.uid());
