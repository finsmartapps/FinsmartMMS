-- ============================================================
-- ACCOUNT PURSUIT — warm connections on accounts
-- Run ONCE in the Supabase SQL editor. Idempotent.
-- Stores, per target account, how many of your LinkedIn connections
-- already work there (populated by the Connections CSV sync).
-- ============================================================

alter table public.abm_accounts
  add column if not exists warm_connection_count integer not null default 0;

alter table public.abm_accounts
  add column if not exists warm_connections jsonb not null default '[]'::jsonb;
