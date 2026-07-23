-- ============================================================
-- ACCOUNT PURSUIT MODULE  (ABM: LinkedIn account-based outreach)
-- ------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Idempotent — safe to re-run.
-- Adds: has_account_pursuit flag + 5 tables (accounts, contacts,
-- messages, templates, offer context) with RLS, indexes, seed.
-- ============================================================

begin;

-- Module access flag on profiles
alter table public.profiles
  add column if not exists has_account_pursuit boolean not null default false;

-- ── Target accounts (aggregator firms) ──────────────────────
create table if not exists public.abm_accounts (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  website               text,
  linkedin_url          text,
  industry              text,
  targeted_industry     text,                 -- vertical angle we pitch this firm
  revenue_text          text,                 -- raw e.g. "$10.6M"
  revenue_usd           numeric(14,2),        -- parsed
  employee_size         integer,
  tier                  text    check (tier in ('A','B','C')),
  fit_score             integer check (fit_score between 0 and 100),
  status                text    not null default 'target'
                          check (status in ('target','engaged','in_conversation','opportunity','won','lost','on_hold')),
  compelling_event      text,                 -- "why now" trigger
  pain_hypothesis       text,                 -- the problem we believe they have
  state                 text,
  country               text,
  address               text,
  associations          text,
  software_partnerships text,
  offshore_presence     text,
  other_industries      text,
  next_action           text,                 -- account-level strategic next move
  next_action_date      date,
  owner_id              uuid references public.profiles(id) on delete set null,
  source                text default 'manual',
  notes                 text,
  last_activity_at      timestamptz,          -- for stalled-account detection
  stage_changed_at      timestamptz,
  closed_at             timestamptz,
  loss_reason           text,                 -- learning loop on won/lost
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Contacts (buying committee) under each account ──────────
create table if not exists public.abm_contacts (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.abm_accounts(id) on delete cascade,
  first_name         text not null,
  last_name          text,
  job_title          text,
  committee_role     text not null default 'unknown'
                       check (committee_role in ('decision_maker','champion','influencer','gatekeeper','unknown')),
  linkedin_url       text,
  email              text,
  office_number      text,
  direct_number      text,
  mutual_connections text,                    -- raw "Common Connection" text
  has_mutuals        boolean not null default false,  -- warm-path signal
  connection_status  text not null default 'not_sent'
                       check (connection_status in ('not_sent','request_sent','accepted','no_response','declined')),
  request_sent_at    timestamptz,
  connected_at       timestamptz,
  conversation_stage text not null default 'no_contact'
                       check (conversation_stage in ('no_contact','opener_sent','replied','in_conversation','meeting_booked','cold')),
  next_action        text,
  next_action_date   date,
  last_touch_at      timestamptz,
  touch_count        integer not null default 0,
  do_not_contact     boolean not null default false,
  owner_id           uuid references public.profiles(id) on delete set null,
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Reusable message templates ──────────────────────────────
create table if not exists public.abm_message_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  body       text not null,
  channel    text default 'dm' check (channel in ('connect_note','dm','inmail','email')),
  is_active  boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Message thread (sent + received) ────────────────────────
create table if not exists public.abm_messages (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.abm_contacts(id) on delete cascade,
  account_id   uuid references public.abm_accounts(id) on delete cascade,
  direction    text not null check (direction in ('sent','received')),
  channel      text not null default 'dm' check (channel in ('connect_note','dm','inmail','email')),
  body         text not null,
  template_id  uuid references public.abm_message_templates(id) on delete set null,
  occurred_at  timestamptz not null default now(),
  logged_by    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ── Offer context (single row) feeding AI drafts ────────────
create table if not exists public.abm_offer_context (
  id         integer primary key default 1,
  value_prop text default '',
  icp        text default '',
  tone       text default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint abm_offer_context_singleton check (id = 1)
);

insert into public.abm_offer_context (id, value_prop, icp, tone) values (
  1,
  'Finsmart provides offshore accounting talent and managed staffing to US CPA and accounting firms — expanding their capacity and margins without local hiring cost or overhead.',
  'US-based CPA / accounting firms and aggregators, especially multi-location regional firms ($10M+ revenue) that need capacity, offshore leverage, or help scaling during busy season.',
  'Warm, peer-to-peer, concise, value-first. Never hard-pitch on the first touch; lead with relevance and a reason to talk.'
) on conflict (id) do nothing;

-- ── Indexes ─────────────────────────────────────────────────
create index if not exists idx_abm_accounts_owner_status on public.abm_accounts(owner_id, status);
create index if not exists idx_abm_accounts_tier         on public.abm_accounts(tier);
create index if not exists idx_abm_contacts_account      on public.abm_contacts(account_id);
create index if not exists idx_abm_contacts_owner_due    on public.abm_contacts(owner_id, next_action_date);
create index if not exists idx_abm_contacts_connection   on public.abm_contacts(connection_status);
create index if not exists idx_abm_contacts_linkedin     on public.abm_contacts(lower(linkedin_url));
create index if not exists idx_abm_messages_contact_time on public.abm_messages(contact_id, occurred_at desc);

-- ── updated_at triggers ─────────────────────────────────────
create or replace trigger trg_abm_accounts_updated_at
  before update on public.abm_accounts
  for each row execute function public.handle_updated_at();
create or replace trigger trg_abm_contacts_updated_at
  before update on public.abm_contacts
  for each row execute function public.handle_updated_at();
create or replace trigger trg_abm_message_templates_updated_at
  before update on public.abm_message_templates
  for each row execute function public.handle_updated_at();

-- ── Row Level Security ──────────────────────────────────────
-- Pattern: managers/admins manage everything; owners manage their own.
alter table public.abm_accounts          enable row level security;
alter table public.abm_contacts          enable row level security;
alter table public.abm_messages          enable row level security;
alter table public.abm_message_templates enable row level security;
alter table public.abm_offer_context     enable row level security;

drop policy if exists "abm_accounts manager all" on public.abm_accounts;
create policy "abm_accounts manager all" on public.abm_accounts
  for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists "abm_accounts owner" on public.abm_accounts;
create policy "abm_accounts owner" on public.abm_accounts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "abm_contacts manager all" on public.abm_contacts;
create policy "abm_contacts manager all" on public.abm_contacts
  for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists "abm_contacts owner" on public.abm_contacts;
create policy "abm_contacts owner" on public.abm_contacts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "abm_messages manager all" on public.abm_messages;
create policy "abm_messages manager all" on public.abm_messages
  for all using (public.is_manager()) with check (public.is_manager());
drop policy if exists "abm_messages owner" on public.abm_messages;
create policy "abm_messages owner" on public.abm_messages
  for all
  using (exists (select 1 from public.abm_contacts c where c.id = contact_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.abm_contacts c where c.id = contact_id and c.owner_id = auth.uid()));

drop policy if exists "abm_templates read" on public.abm_message_templates;
create policy "abm_templates read" on public.abm_message_templates
  for select using (auth.uid() is not null);
drop policy if exists "abm_templates manage" on public.abm_message_templates;
create policy "abm_templates manage" on public.abm_message_templates
  for all using (public.is_manager() or created_by = auth.uid())
  with check (public.is_manager() or created_by = auth.uid());

drop policy if exists "abm_offer read" on public.abm_offer_context;
create policy "abm_offer read" on public.abm_offer_context
  for select using (auth.uid() is not null);
drop policy if exists "abm_offer manage" on public.abm_offer_context;
create policy "abm_offer manage" on public.abm_offer_context
  for all using (public.is_manager()) with check (public.is_manager());

commit;
