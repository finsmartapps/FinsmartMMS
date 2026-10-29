-- Account Pursuit — Agent ecosystem (Phase 1: draft + approval queue)
-- Run once in the Supabase SQL editor. Safe to re-run.

begin;

-- ── Extra columns on the message log (used by sender / reply watcher later) ──
alter table public.abm_messages add column if not exists subject         text;
alter table public.abm_messages add column if not exists rfc_message_id  text;
alter table public.abm_messages add column if not exists draft_id        uuid;

-- ── Draft + approval queue ──────────────────────────────────
create table if not exists public.abm_drafts (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid not null references public.abm_contacts(id) on delete cascade,
  account_id       uuid references public.abm_accounts(id) on delete cascade,
  owner_id         uuid references public.profiles(id) on delete set null,
  channel          text not null default 'email'
                     check (channel in ('connect_note','dm','inmail','email')),
  sequence_step    integer not null default 1,
  subject          text,
  body             text not null,                 -- full text to send (greeting + body + signature)
  status           text not null default 'pending_approval'
                     check (status in ('pending_approval','approved','rejected','sent','failed')),
  angle            text,                          -- which account fact the strategist chose
  fact_used        text,
  variant          jsonb,                         -- structure/length/cta picks (anti-template)
  qa_score         integer,
  qa_notes         jsonb,
  model            text,                          -- provider/model that wrote it
  approved_by      uuid references public.profiles(id) on delete set null,
  approved_at      timestamptz,
  sent_at          timestamptz,
  send_error       text,
  rfc_message_id   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_abm_drafts_contact on public.abm_drafts(contact_id, created_at desc);
create index if not exists idx_abm_drafts_status  on public.abm_drafts(status, created_at desc);
create index if not exists idx_abm_drafts_owner   on public.abm_drafts(owner_id, status);

create or replace trigger trg_abm_drafts_updated_at
  before update on public.abm_drafts
  for each row execute function public.handle_updated_at();

-- ── Agent settings (single row) ─────────────────────────────
create table if not exists public.abm_agent_settings (
  id              integer primary key default 1,
  mode            text    not null default 'approval' check (mode in ('approval','auto')),
  daily_cap       integer not null default 20,
  send_start_hour integer not null default 9,       -- local hour, inclusive
  send_end_hour   integer not null default 17,      -- local hour, exclusive
  timezone        text    not null default 'America/New_York',
  kill_switch     boolean not null default false,   -- true = nothing sends
  sender_name     text    not null default 'Piyush Devnani',
  sender_title    text    not null default 'Sr. Business Strategist',
  sender_company  text    not null default 'Finsmart Accounting',
  sender_email    text    default 'piyush.d@finsmartaccounting.net',
  updated_at      timestamptz not null default now(),
  constraint abm_agent_settings_singleton check (id = 1)
);

insert into public.abm_agent_settings (id) values (1) on conflict (id) do nothing;

-- ── RLS (same pattern as the rest of the module) ────────────
alter table public.abm_drafts         enable row level security;
alter table public.abm_agent_settings enable row level security;

drop policy if exists "abm_drafts manager all" on public.abm_drafts;
create policy "abm_drafts manager all" on public.abm_drafts
  for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists "abm_drafts owner" on public.abm_drafts;
create policy "abm_drafts owner" on public.abm_drafts
  for all
  using (exists (select 1 from public.abm_contacts c where c.id = contact_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.abm_contacts c where c.id = contact_id and c.owner_id = auth.uid()));

drop policy if exists "abm_agent_settings read" on public.abm_agent_settings;
create policy "abm_agent_settings read" on public.abm_agent_settings
  for select using (auth.uid() is not null);
drop policy if exists "abm_agent_settings manage" on public.abm_agent_settings;
create policy "abm_agent_settings manage" on public.abm_agent_settings
  for all using (public.is_manager()) with check (public.is_manager());

commit;
