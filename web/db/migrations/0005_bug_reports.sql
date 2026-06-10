-- Bug reports: written by the /api/feedback route (service role) when a user explicitly sends
-- one from the Report dialog. RLS is enabled with NO policies — nothing is readable or writable
-- through the public API; the founder reads via the dashboard/SQL.
-- APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run (same as 0001-0004).
create table if not exists public.bug_reports (
  id          bigint generated always as identity primary key,
  email       text,                -- signed-in reporter, if any
  description text not null,
  events      jsonb,               -- the local capture buffer the user chose to attach
  design      jsonb,               -- design snapshot, if the user left the box checked
  meta        jsonb,               -- page, browser
  created_at  timestamptz not null default now()
);
alter table public.bug_reports enable row level security;
