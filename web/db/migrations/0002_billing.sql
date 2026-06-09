-- Billing: link a user to their Stripe customer so the webhook can flip plan by customer id.
-- APPLY: Supabase Dashboard → SQL Editor → paste → Run (same as 0001).
alter table public.users add column if not exists stripe_customer_id text;
create index if not exists users_stripe_customer_idx on public.users (stripe_customer_id);
