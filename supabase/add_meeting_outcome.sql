-- Adds meeting_outcome to leads (SQL = Meeting Outcome 'Completed').
-- Run once in the Supabase SQL editor. Idempotent.
alter table public.leads
  add column if not exists meeting_outcome text default '';
