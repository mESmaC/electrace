-- Sparky usage metering: one append-only row per assistant run (main loop + sparks combined).
-- Powers the monthly fair-use budget gate (SPARKY_MONTHLY_BUDGET_USD — unset/0 = unlimited, which
-- is the early-adopter default). Append-only: no increments, no race conditions, full audit trail.
-- APPLY: Supabase Dashboard → SQL Editor → paste → Run (same as 0001-0003).
create table if not exists public.sparky_usage (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references public.users(id) on delete cascade,
  model       text not null,
  in_full     bigint not null default 0,   -- uncached input tokens (full price)
  in_cached   bigint not null default 0,   -- cache-read input tokens (~0.1x)
  in_write    bigint not null default 0,   -- cache-write input tokens (1.25x on Anthropic)
  out_tokens  bigint not null default 0,
  cost_usd    numeric(10, 6) not null default 0,  -- computed at insert from the model's price card
  created_at  timestamptz not null default now()
);
create index if not exists sparky_usage_owner_time_idx on public.sparky_usage (owner_id, created_at);

alter table public.sparky_usage enable row level security;
drop policy if exists sparky_usage_select on public.sparky_usage;
create policy sparky_usage_select on public.sparky_usage for select using (owner_id = auth.uid());
drop policy if exists sparky_usage_insert on public.sparky_usage;
create policy sparky_usage_insert on public.sparky_usage for insert with check (owner_id = auth.uid());
