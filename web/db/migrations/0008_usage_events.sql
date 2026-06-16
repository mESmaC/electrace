-- Product-usage telemetry: which FEATURES real visitors reach for, and on which plan — the signal
-- that anchors the audience bet (pros vs hobbyists?) and the pricing call. Written by /api/usage
-- (service role). Anonymous by design: an event name + plan tag + a per-session id, NO design
-- contents and no new PII (email is captured only when the user is already signed in, same posture
-- as client_errors / bug_reports). RLS enabled with NO policies — write-only through the route,
-- readable only via dashboard/SQL.
-- APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run (same as 0001-0007).
create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  event       text not null,       -- the action, e.g. "block.add", "design.lint", "sparky.open", "bom.cart"
  plan        text,                -- "anon" | "hobby" | "pro" — the audience signal
  session     text,                -- opaque per-session id (sessionStorage), NOT a user id
  url         text,                -- path only, no query
  email       text,                -- signed-in user, if any (lets you tie features to a known account)
  meta        jsonb,               -- small structured extras (never design contents)
  created_at  timestamptz not null default now()
);
alter table public.usage_events enable row level security;
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);
create index if not exists usage_events_event_idx on public.usage_events (event);

-- ── reads (dashboard SQL) ───────────────────────────────────────────────────────────────────────
-- Who's using it, by plan, last 7 days:
--   select plan, count(*) from public.usage_events
--   where created_at > now() - interval '7 days' group by plan order by count(*) desc;
-- Top features this week:
--   select event, count(*) from public.usage_events
--   where created_at > now() - interval '7 days' group by event order by count(*) desc limit 25;
-- Feature mix by plan (the audience-vs-feature crosstab):
--   select plan, event, count(*) from public.usage_events
--   where created_at > now() - interval '30 days' group by plan, event order by plan, count(*) desc;
-- Distinct sessions per day (rough active-use trend):
--   select date_trunc('day', created_at) d, count(distinct session) sessions
--   from public.usage_events group by d order by d desc limit 30;
