-- Durable per-user key/value store: user-authored blocks, block-schematic drafts, settings, the
-- project index — everything the localStorage mirror holds that isn't a design (designs have
-- their own table). Replaces the ephemeral /tmp file store for signed-in users.
-- APPLY: Supabase Dashboard → SQL Editor → paste → Run (same as 0001/0002).
create table if not exists public.user_kv (
  owner_id    uuid not null references public.users(id) on delete cascade,
  k           text not null,
  v           text not null,          -- values are JSON strings straight from localStorage
  updated_at  timestamptz not null default now(),
  primary key (owner_id, k)
);
drop trigger if exists user_kv_touch on public.user_kv;
create trigger user_kv_touch before update on public.user_kv for each row execute function public.touch_updated_at();

alter table public.user_kv enable row level security;
drop policy if exists user_kv_all on public.user_kv;
create policy user_kv_all on public.user_kv
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
