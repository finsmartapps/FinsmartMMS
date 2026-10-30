-- Account Pursuit — Researcher agent: verified facts about a firm / contact.
-- Run once in the Supabase SQL editor. Safe to re-run.

begin;

create table if not exists public.abm_research (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.abm_accounts(id) on delete cascade,
  contact_id  uuid references public.abm_contacts(id) on delete cascade,
  owner_id    uuid references public.profiles(id) on delete set null,
  facts       jsonb not null default '[]'::jsonb,   -- verified facts, each with a verbatim quote + source URL
  sources     jsonb not null default '[]'::jsonb,   -- every page / article that was read
  status      text  not null default 'ok' check (status in ('ok','partial','empty','failed')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_abm_research_account on public.abm_research(account_id, created_at desc);
create index if not exists idx_abm_research_contact on public.abm_research(contact_id, created_at desc);

alter table public.abm_research enable row level security;

drop policy if exists "abm_research manager all" on public.abm_research;
create policy "abm_research manager all" on public.abm_research
  for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists "abm_research owner" on public.abm_research;
create policy "abm_research owner" on public.abm_research
  for all
  using (exists (select 1 from public.abm_accounts a where a.id = account_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.abm_accounts a where a.id = account_id and a.owner_id = auth.uid()));

commit;
