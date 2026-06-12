-- Client error monitoring: uncaught exceptions + unhandled rejections from real browsers,
-- written by /api/client-error (service role). RLS enabled with NO policies — write-only
-- through the route, readable only via dashboard/SQL (same posture as bug_reports).
-- APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run (same as 0001-0005).
create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  message     text not null,
  stack       text,                -- first ~4 KB of the stack, if any
  url         text,                -- page where it happened (path only, no query)
  user_agent  text,
  email       text,                -- signed-in user, if any (to reach out / reproduce)
  meta        jsonb,               -- viewport, release hints, anything small
  created_at  timestamptz not null default now()
);
alter table public.client_errors enable row level security;

-- Read it back (dashboard SQL):
--   select created_at, message, url, email from public.client_errors order by created_at desc limit 50;
-- Top offenders:
--   select message, count(*), max(created_at) as last_seen from public.client_errors
--   group by message order by count(*) desc limit 20;
