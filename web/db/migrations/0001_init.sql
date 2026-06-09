-- Electrace P1 storage (storage.md): users + designs, with Row-Level Security doing the real
-- enforcement. Matches web/db/schema.ts exactly.
--
-- HOW TO APPLY (the one human step): Supabase Dashboard → SQL Editor → paste this file → Run.
-- (Or `npx drizzle-kit push` once DATABASE_URL is in web/.env.local.)

-- ── tables ────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key,
  email       text not null,
  name        text,
  plan        text not null default 'free' check (plan in ('free','pro')),
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.designs (
  id          text primary key,            -- client-generated ("proj-…"); offline-first, upsert by id
  owner_id    uuid not null references public.users(id) on delete cascade,
  name        text not null default 'Untitled project',
  visibility  text not null default 'unlisted' check (visibility in ('public','unlisted','private')),
  graph       jsonb not null,
  pcb         jsonb,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists designs_owner_idx on public.designs (owner_id);
create index if not exists designs_visibility_idx on public.designs (visibility);

-- ── keep updated_at honest ───────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users for each row execute function public.touch_updated_at();
drop trigger if exists designs_touch on public.designs;
create trigger designs_touch before update on public.designs for each row execute function public.touch_updated_at();

-- ── auth.users → public.users mirror (row appears on signup) ────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- backfill anyone who signed up before this migration
insert into public.users (id, email, name)
select id, coalesce(email, ''), raw_user_meta_data ->> 'name' from auth.users
on conflict (id) do nothing;

-- ── Row-Level Security: the enforcement layer ────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.designs enable row level security;

-- users: you can see and edit only your own row (plan changes come later via billing webhooks
-- using the service role, which bypasses RLS)
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select using (id = auth.uid());
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- a user is pro iff their users row says so — used by the private-visibility gate below
create or replace function public.is_pro() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.users where id = auth.uid() and plan = 'pro') $$;

-- designs: public/unlisted are readable by anyone (unlisted = you need the link; it is not
-- listed anywhere — the gist model); private only by the owner
drop policy if exists designs_select on public.designs;
create policy designs_select on public.designs for select
  using (visibility in ('public','unlisted') or owner_id = auth.uid());

-- writes: owner only, and PRIVATE requires pro (the paywall, enforced in Postgres itself)
drop policy if exists designs_insert on public.designs;
create policy designs_insert on public.designs for insert
  with check (owner_id = auth.uid() and (visibility <> 'private' or public.is_pro()));
drop policy if exists designs_update on public.designs;
create policy designs_update on public.designs for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (visibility <> 'private' or public.is_pro()));
drop policy if exists designs_delete on public.designs;
create policy designs_delete on public.designs for delete using (owner_id = auth.uid());
