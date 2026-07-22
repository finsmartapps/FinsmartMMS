-- ============================================================
-- REMOVE EXPENSES MODULE
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor.
-- Removes the Travel Expenses module entirely:
--   • travel_expenses table + its data
--   • travel-receipts storage bucket + all uploaded receipts
--   • has_expenses column on profiles
--   • finance_manager role (reassigned to employee)
-- Nothing else (sales, marketing, warehouse, advocacy, ms_social) is touched.
-- ============================================================

begin;

-- 1. Reassign any finance_manager users to 'employee' so the tightened
--    role check constraint below won't reject existing rows.
update public.profiles
set role = 'employee'
where role = 'finance_manager';

-- 2. Drop the travel_expenses table (and its RLS policy, dropped with it).
drop table if exists public.travel_expenses cascade;

-- 3. Remove the has_expenses module flag from profiles.
alter table public.profiles
  drop column if exists has_expenses;

-- 4. Tighten the role check constraint to remove 'finance_manager'.
--    (Postgres names inline check constraints <table>_<column>_check.)
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'telecaller', 'warehouse_user', 'employee'));

-- 5. Remove the storage RLS policies for the receipts bucket.
--    NOTE: The bucket itself and its uploaded files must be removed via the
--    Storage API (not SQL) — Supabase blocks direct deletes on storage tables.
--    That step is handled separately by scripts/remove-expenses-storage.mjs.
drop policy if exists "travel_receipts_select" on storage.objects;
drop policy if exists "travel_receipts_insert" on storage.objects;
drop policy if exists "travel_receipts_update" on storage.objects;
drop policy if exists "travel_receipts_delete" on storage.objects;

commit;
