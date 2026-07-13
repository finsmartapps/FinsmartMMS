-- ============================================================
-- FinsmartMMS — Unified Supabase Schema
-- One Supabase project for: Sales CRM + Marketing Dashboard + Expenses
--
-- HOW TO USE:
-- 1. Create a new Supabase project at https://supabase.com
-- 2. Go to SQL Editor > New query
-- 3. Paste this entire file and run it
-- 4. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
--    SUPABASE_SERVICE_ROLE_KEY in .env.local
-- ============================================================

-- ============================================================
-- HELPERS
-- ============================================================

-- handle_updated_at must come first (no dependencies)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- SHARED: PROFILES
-- Unified user table. role = NULL for non-sales users.
-- NOTE: profiles must be created BEFORE is_manager() because
--       is_manager() references public.profiles in its body.
-- ============================================================

create table public.profiles (
  id            uuid        references auth.users(id) on delete cascade primary key,
  name          text        not null,
  email         text        not null unique,
  role          text        check (role in ('admin', 'manager', 'telecaller', 'finance_manager', 'warehouse_user', 'employee')),
  has_sales     boolean     not null default false,
  has_marketing boolean     not null default false,
  has_expenses  boolean     not null default false,
  has_warehouse boolean     not null default false,
  has_advocacy  boolean     not null default false,
  has_ms_social boolean     not null default false,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- is_manager() must come AFTER profiles table so its body can resolve the reference
create or replace function public.is_manager()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

alter table public.profiles enable row level security;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "manager read all"   on public.profiles for select using (public.is_manager());
create policy "manager insert"     on public.profiles for insert with check (public.is_manager());
create policy "manager update"     on public.profiles for update using (public.is_manager());
create policy "manager delete"     on public.profiles for delete using (public.is_manager());

-- ============================================================
-- SALES MODULE
-- ============================================================

-- Role-based module permissions
create table public.role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role       text not null,
  module     text not null,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(role, module)
);

alter table public.role_permissions enable row level security;
create policy "read permissions" on public.role_permissions for select using (auth.uid() is not null);
create policy "manager manage permissions" on public.role_permissions for all using (public.is_manager());

-- Activities (call/email/meeting types)
create table public.activities (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  description   text,
  is_active     boolean     not null default true,
  display_order integer     not null default 0,
  created_by    uuid        references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_activities_updated_at
  before update on public.activities
  for each row execute function public.handle_updated_at();

alter table public.activities enable row level security;
create policy "read active activities" on public.activities for select using (is_active = true or public.is_manager());
create policy "manager manage activities" on public.activities for all using (public.is_manager());

-- Targets
create table public.targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  activity_id    uuid not null references public.activities(id) on delete cascade,
  min_value      integer not null check (min_value >= 0),
  effective_from date not null default current_date,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  unique(user_id, activity_id, effective_from)
);

alter table public.targets enable row level security;
create policy "own targets read" on public.targets for select using (user_id = auth.uid() or public.is_manager());
create policy "manager manage targets" on public.targets for all using (public.is_manager());

-- Daily logs
create table public.daily_logs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  log_date     date        not null,
  is_submitted boolean     not null default false,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(user_id, log_date)
);

create trigger trg_daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.handle_updated_at();

alter table public.daily_logs enable row level security;
create policy "own logs" on public.daily_logs for all using (user_id = auth.uid() or public.is_manager());

-- Daily log entries
create table public.daily_log_entries (
  id             uuid    primary key default gen_random_uuid(),
  log_id         uuid    not null references public.daily_logs(id) on delete cascade,
  activity_id    uuid    not null references public.activities(id) on delete cascade,
  value          integer not null default 0 check (value >= 0),
  deficit_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(log_id, activity_id)
);

create trigger trg_daily_log_entries_updated_at
  before update on public.daily_log_entries
  for each row execute function public.handle_updated_at();

alter table public.daily_log_entries enable row level security;
create policy "own entries" on public.daily_log_entries for all
  using (exists(select 1 from public.daily_logs dl where dl.id = log_id and (dl.user_id = auth.uid() or public.is_manager())));

-- Holidays
create table public.holidays (
  id           uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label        text not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

alter table public.holidays enable row level security;
create policy "read holidays" on public.holidays for select using (true);
create policy "manager manage holidays" on public.holidays for all using (public.is_manager());

-- Settings (sales module)
create table public.settings (
  key        text primary key,
  value      text not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;
create policy "authenticated read settings" on public.settings for select using (auth.role() = 'authenticated');
create policy "managers update settings" on public.settings for update using (public.is_manager());
create policy "managers insert settings" on public.settings for insert with check (public.is_manager());

-- Meetings
create table public.meetings (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  first_name   text        not null,
  last_name    text        not null,
  company_name text        not null,
  company_size text,
  meeting_date date        not null,
  meeting_time time        not null,
  timezone     text        not null default 'IST',
  notes        text,
  lead_source  text,
  outcome      text        check (outcome in ('completed', 'cancelled', 'rescheduled')),
  result       text        check (result in ('converted_opportunity', 'future_followup', 'lost')),
  contact_id   uuid,
  created_at   timestamptz not null default now()
);

alter table public.meetings enable row level security;
create policy "own meetings" on public.meetings for all using (auth.uid() = user_id);
create policy "manager view all meetings" on public.meetings for select using (public.is_manager());
create policy "manager manage all meetings" on public.meetings for all using (public.is_manager());

-- Follow-ups
create table public.follow_ups (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  first_name     text        not null,
  last_name      text        not null,
  company_name   text,
  phone          text,
  email          text,
  follow_up_date date        not null,
  notes          text,
  status         text        not null default 'pending' check (status in ('pending', 'done')),
  contact_id     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_follow_ups_updated_at
  before update on public.follow_ups
  for each row execute function public.handle_updated_at();

alter table public.follow_ups enable row level security;
create policy "own followups" on public.follow_ups for all using (auth.uid() = user_id);
create policy "manager view all followups" on public.follow_ups for select using (public.is_manager());
create policy "manager manage all followups" on public.follow_ups for all using (public.is_manager());

-- LinkedIn contacts
create table public.linkedin_contacts (
  id               uuid        primary key default gen_random_uuid(),
  assigned_to      uuid        references public.profiles(id) on delete set null,
  first_name       text        not null,
  last_name        text,
  email            text,
  phone            text,
  company_name     text,
  job_title        text,
  linkedin_url     text,
  lead_source      text,
  city             text,
  country          text,
  status           text        not null default 'queued' check (status in ('queued', 'request_sent')),
  queue_date       date,
  request_sent_at  timestamptz,
  generated_message text,
  pipeline_status  text        default 'new' check (pipeline_status in ('new', 'contacted', 'interested', 'won', 'lost')),
  notes            text,
  created_by       uuid        references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index linkedin_contacts_email_idx on public.linkedin_contacts (lower(email)) where email is not null;
create index linkedin_contacts_assigned_queue_idx on public.linkedin_contacts (assigned_to, queue_date, status);
create index linkedin_contacts_owner_status_idx on public.linkedin_contacts (assigned_to, status);

create trigger trg_linkedin_contacts_updated_at
  before update on public.linkedin_contacts
  for each row execute function public.handle_updated_at();

alter table public.linkedin_contacts enable row level security;
create policy "manager manage all contacts" on public.linkedin_contacts for all using (public.is_manager());
create policy "telecaller own contacts" on public.linkedin_contacts for all using (assigned_to = auth.uid());

-- LinkedIn message templates
create table public.linkedin_message_templates (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  body       text        not null,
  is_active  boolean     not null default true,
  created_by uuid        references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_linkedin_message_templates_updated_at
  before update on public.linkedin_message_templates
  for each row execute function public.handle_updated_at();

alter table public.linkedin_message_templates enable row level security;
create policy "manager manage templates" on public.linkedin_message_templates for all using (public.is_manager());
create policy "telecaller read active templates" on public.linkedin_message_templates for select using (is_active = true);

-- LinkedIn contact activity log
create table public.linkedin_contact_activity (
  id         uuid        primary key default gen_random_uuid(),
  contact_id uuid        not null references public.linkedin_contacts(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id),
  action     text        not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index idx_lca_contact_time on public.linkedin_contact_activity(contact_id, created_at desc);

alter table public.linkedin_contact_activity enable row level security;
create policy "managers view linkedin activity" on public.linkedin_contact_activity for select using (public.is_manager());
create policy "telecallers view own linkedin activity" on public.linkedin_contact_activity for select
  using (exists(select 1 from public.linkedin_contacts where id = contact_id and assigned_to = auth.uid()));
create policy "telecallers insert linkedin activity" on public.linkedin_contact_activity for insert with check (user_id = auth.uid());
create policy "manager manage linkedin activity" on public.linkedin_contact_activity for all using (public.is_manager());

-- LinkedIn lists
create table public.linkedin_lists (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  created_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.linkedin_lists enable row level security;
create policy "authenticated view lists" on public.linkedin_lists for select using (auth.uid() is not null);
create policy "authenticated create lists" on public.linkedin_lists for insert with check (auth.uid() is not null);
create policy "owner or manager update lists" on public.linkedin_lists for update using (auth.uid() = created_by or public.is_manager());
create policy "owner or manager delete lists" on public.linkedin_lists for delete using (auth.uid() = created_by or public.is_manager());

-- LinkedIn list contacts (junction)
create table public.linkedin_list_contacts (
  list_id    uuid        not null references public.linkedin_lists(id) on delete cascade,
  contact_id uuid        not null references public.linkedin_contacts(id) on delete cascade,
  added_by   uuid        references public.profiles(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (list_id, contact_id)
);

alter table public.linkedin_list_contacts enable row level security;
create policy "authenticated view list contacts" on public.linkedin_list_contacts for select using (auth.uid() is not null);
create policy "manager manage list contacts" on public.linkedin_list_contacts for all using (public.is_manager()) with check (public.is_manager());
create policy "telecaller manage own contacts in lists" on public.linkedin_list_contacts for all
  using (exists(select 1 from public.linkedin_contacts lc where lc.id = contact_id and lc.assigned_to = auth.uid()))
  with check (exists(select 1 from public.linkedin_contacts lc where lc.id = contact_id and lc.assigned_to = auth.uid()));

-- Contact calls (on LinkedIn contacts)
create table public.contact_calls (
  id           uuid        primary key default gen_random_uuid(),
  contact_id   uuid        not null references public.linkedin_contacts(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id),
  call_date    date        not null,
  call_time    time,
  duration_mins integer,
  outcome      text        check (outcome in ('connected', 'no_answer', 'busy', 'voicemail', 'left_message')),
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.contact_calls enable row level security;
create policy "manager view all calls" on public.contact_calls for all using (public.is_manager());
create policy "telecaller own calls" on public.contact_calls for all
  using (exists(select 1 from public.linkedin_contacts lc where lc.id = contact_id and lc.assigned_to = auth.uid()));

-- Contact tasks
create table public.contact_tasks (
  id           uuid        primary key default gen_random_uuid(),
  contact_id   uuid        not null references public.linkedin_contacts(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id),
  title        text        not null,
  due_date     date,
  priority     text        default 'medium' check (priority in ('low', 'medium', 'high')),
  status       text        not null default 'pending' check (status in ('pending', 'completed')),
  notes        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.contact_tasks enable row level security;
create policy "manager view all tasks" on public.contact_tasks for all using (public.is_manager());
create policy "telecaller own tasks" on public.contact_tasks for all
  using (exists(select 1 from public.linkedin_contacts lc where lc.id = contact_id and lc.assigned_to = auth.uid()));

-- ============================================================
-- MARKETING MODULE
-- (table 'settings' renamed to 'marketing_settings' to avoid conflict)
-- ============================================================

create table public.marketing_settings (
  id                        uuid          primary key default gen_random_uuid(),
  annual_seats_target       int           not null default 100,
  avg_deal_value            int           not null default 3000,
  sql_seat_conversion       decimal(4,2)  not null default 0.25,
  event_sql_target          int           not null default 150,
  digital_mql_sql_conversion decimal(4,2) not null default 0.30,
  meeting_sql_conversion    decimal(4,2)  not null default 1.0,
  updated_at                timestamptz   default now()
);

create table public.segments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  annual_seats_target int  not null default 0,
  avg_deal_value      int  not null default 3000,
  primary_channel     text default '',
  sort_order          int  not null default 0
);

create table public.channels (
  id                 uuid         primary key default gen_random_uuid(),
  name               text         not null,
  monthly_mql_target int          not null default 0,
  mql_sql_conversion decimal(4,2) not null default 0.0,
  planning_notes     text         default '',
  owner_role         text         default '',
  sort_order         int          not null default 0
);

create table public.plan_events (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  quarter         text default '',
  sql_target_min  int  default 0,
  sql_target_max  int  default 0,
  meetings_target int  default 0,
  primary_segment text default '',
  owner_role      text default 'Events Lead',
  notes           text default '',
  sort_order      int  not null default 0
);

create table public.weekly_actuals (
  id                  uuid        primary key default gen_random_uuid(),
  week_start          date        not null unique,
  week_end            date        not null,
  mql_actual          int         default 0,
  sql_actual          int         default 0,
  meetings_actual     int         default 0,
  pipeline_created    int         default 0,
  wins                text        default '',
  concerns            text        default '',
  decisions_needed    text        default '',
  founder_support     text        default '',
  channel_snapshot    jsonb       default '[]',
  segment_performance jsonb       default '[]',
  sdr_productivity    jsonb       default '[]',
  submitted_by        uuid        references auth.users(id),
  submitted_at        timestamptz default now(),
  updated_at          timestamptz default now()
);

create table public.monthly_actuals (
  id                     uuid        primary key default gen_random_uuid(),
  month                  date        not null unique,
  seats_closed           int         default 0,
  channel_data           jsonb       default '[]',
  segment_data           jsonb       default '[]',
  event_data             jsonb       default '[]',
  pipeline_30d_closures  int         default 0,
  pipeline_30d_sqls      int         default 0,
  pipeline_30d_value     int         default 0,
  pipeline_60d_closures  int         default 0,
  pipeline_60d_sqls      int         default 0,
  pipeline_60d_value     int         default 0,
  pipeline_90d_closures  int         default 0,
  pipeline_90d_sqls      int         default 0,
  pipeline_90d_value     int         default 0,
  top_wins               text        default '',
  top_blockers           text        default '',
  big_experiment         text        default '',
  founder_support_needed text        default '',
  submitted_by           uuid        references auth.users(id),
  submitted_at           timestamptz default now(),
  updated_at             timestamptz default now()
);

create table public.leads (
  id               uuid    primary key default gen_random_uuid(),
  sr_no            bigint  generated always as identity,
  lead_date        date    not null default current_date,
  name             text    not null,
  email            text    default '',
  phone            text    default '',
  website_url      text    default '',
  company_name     text    default '',
  industry         text    default '',
  service_required text    default '',
  data_source      text    default '',
  lead_from        text    default '',
  lead_source      text    default '',
  state            text    default '',
  country          text    default '',
  comment          text    default '',
  assigned_to      text    default '',
  lead_status      text    default 'Active',
  became_sql_date  date,
  lead_stage       text    default 'New',
  customer_type    text    default '',
  category         text    default '',
  closed_hours     numeric default 0,
  mrr_value        numeric default 0,
  one_time_revenue    numeric default 0,
  seat_type           text    default '',
  successful_meetings boolean default false,
  closed_date         date,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create unique index leads_email_unique on public.leads (lower(email)) where email != '';
create index leads_lead_date_idx   on public.leads (lead_date desc);
create index leads_lead_source_idx on public.leads (lead_source);
create index leads_lead_stage_idx  on public.leads (lead_stage);
create index leads_closed_date_idx on public.leads (closed_date);

-- Marketing RLS
alter table public.marketing_settings enable row level security;
alter table public.segments           enable row level security;
alter table public.channels           enable row level security;
alter table public.plan_events        enable row level security;
alter table public.weekly_actuals     enable row level security;
alter table public.monthly_actuals    enable row level security;
alter table public.leads              enable row level security;

create policy "auth marketing_settings" on public.marketing_settings for all using (auth.role() = 'authenticated');
create policy "auth segments"           on public.segments           for all using (auth.role() = 'authenticated');
create policy "auth channels"           on public.channels           for all using (auth.role() = 'authenticated');
create policy "auth plan_events"        on public.plan_events        for all using (auth.role() = 'authenticated');
create policy "auth weekly_actuals"     on public.weekly_actuals     for all using (auth.role() = 'authenticated');
create policy "auth monthly_actuals"    on public.monthly_actuals    for all using (auth.role() = 'authenticated');
create policy "auth leads"              on public.leads              for all using (auth.role() = 'authenticated');

-- ============================================================
-- EXPENSES MODULE
-- ============================================================

create table public.travel_expenses (
  id             uuid        primary key default gen_random_uuid(),
  description    text        not null,
  category       text        not null,
  amount         numeric(10,2) not null check (amount > 0),
  currency       text        not null check (currency in ('USD', 'INR')),
  expense_date   date        not null,
  city           text        not null check (city in ('lv', 'or', 'tx', 'nj')),
  notes          text        default '',
  receipt_urls   text[]      default '{}',
  inr_equivalent numeric(12,2),
  added_by       text        not null,
  status         text        not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at     timestamptz not null default now()
);

alter table public.travel_expenses enable row level security;
create policy "authenticated manage expenses" on public.travel_expenses for all using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public)
values ('travel-receipts', 'travel-receipts', true)
on conflict (id) do nothing;

create policy "travel_receipts_select" on storage.objects for select using (bucket_id = 'travel-receipts');
create policy "travel_receipts_insert" on storage.objects for insert with check (bucket_id = 'travel-receipts');
create policy "travel_receipts_update" on storage.objects for update using (bucket_id = 'travel-receipts');
create policy "travel_receipts_delete" on storage.objects for delete using (bucket_id = 'travel-receipts');

-- ============================================================
-- MS SOCIAL MODULE
-- ============================================================

create table public.ms_social_posts (
  id             uuid        primary key default gen_random_uuid(),
  description    text        not null,
  image_url      text,
  publish_date   date        not null,
  platform       text        not null default 'LinkedIn',
  status         text        not null default 'pending'
                             check (status in ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  created_by     uuid        not null references public.profiles(id) on delete cascade,
  reviewed_by    uuid        references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);

create trigger trg_ms_social_posts_updated_at
  before update on public.ms_social_posts
  for each row execute function public.handle_updated_at();

alter table public.ms_social_posts enable row level security;
create policy "authenticated manage ms_social_posts" on public.ms_social_posts
  for all using (auth.uid() is not null);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Sales: default activities
insert into public.activities (name, description, display_order) values
  ('Total Calls',          'Total outbound calls made during the shift',       1),
  ('Connected',            'Calls where the prospect answered',                2),
  ('Right Person Contact', 'Calls reaching the actual decision maker',         3),
  ('No Answers',           'Calls with no response',                           4),
  ('Wrong Numbers',        'Calls to incorrect/disconnected numbers',          5),
  ('Meetings Booked',      'Demos or discovery calls successfully scheduled',  6),
  ('Follow Ups',           'Follow-up calls or messages completed',            7),
  ('Emails Sent',          'Total emails sent during the shift',               8);

update public.activities set is_active = false where name in ('Follow Ups', 'Emails Sent');

-- Sales: default settings
insert into public.settings (key, value) values
  ('submission_deadline',    '05:00'),
  ('day_reset_time',         '15:00'),
  ('submission_always_open', 'false'),
  ('linkedin_daily_quota',   '15')
on conflict (key) do nothing;

-- Sales: default module permissions
insert into public.role_permissions (role, module, enabled) values
  ('manager',    'dashboard',  true),
  ('manager',    'contacts',   true),
  ('manager',    'meetings',   true),
  ('manager',    'callbacks',  true),
  ('manager',    'reports',    true),
  ('manager',    'activities', true),
  ('manager',    'targets',    true),
  ('manager',    'users',      true),
  ('manager',    'holidays',   true),
  ('manager',    'settings',   true),
  ('manager',    'linkedin',   true),
  ('telecaller', 'dashboard',  true),
  ('telecaller', 'contacts',   true),
  ('telecaller', 'meetings',   true),
  ('telecaller', 'callbacks',  true),
  ('telecaller', 'reports',    false),
  ('telecaller', 'linkedin',   true)
on conflict (role, module) do nothing;

-- Marketing: seed settings
insert into public.marketing_settings (annual_seats_target, avg_deal_value, sql_seat_conversion, event_sql_target, digital_mql_sql_conversion, meeting_sql_conversion)
values (100, 3000, 0.25, 150, 0.30, 1.0);

-- Marketing: seed segments
insert into public.segments (name, annual_seats_target, avg_deal_value, primary_channel, sort_order) values
  ('Small Accounting Firms', 30, 3000, 'Content + inbound + webinar',   1),
  ('CPA Firms – Tax Seats',  30, 3500, 'Events + nurture',               2),
  ('Global Corporates',      20, 3250, 'Outbound + partnerships',        3),
  ('Upgrades + Referrals',   20, 3000, 'Client marketing + referrals',   4);

-- Marketing: seed channels
insert into public.channels (name, monthly_mql_target, mql_sql_conversion, planning_notes, owner_role, sort_order) values
  ('Inbound / Website',          24, 0.40, 'High-intent website & demo traffic',   'SEO / Web',            1),
  ('Outbound SDR',               18, 0.65, 'Booked meetings and accepted outreach', 'SDR Lead',             2),
  ('Webinars / Podcasts',        15, 0.20, 'Educational top-funnel; nurture heavy', 'Content / Demand Gen', 3),
  ('Social / LinkedIn / Video',   8, 0.25, 'Founder-led social and brand pull',    'Social / Video',       4),
  ('Founder-led Social',          5, 0.30, 'Social/brand pull',                    'Content / Demand Gen', 5),
  ('Email / Nurture / HubSpot',   0, 0.00, 'Database activation and nurture',      'HubSpot Specialist',   6);

-- Marketing: seed events
insert into public.plan_events (name, quarter, sql_target_min, sql_target_max, meetings_target, primary_segment, owner_role, notes, sort_order) values
  ('Scaling New Heights',        'Q2',    50, 60, 75, 'CPA Firms',  'Events Lead', 'Largest conference for Finsmart', 1),
  ('AICPA Engage',               'Q2',    20, 20, 30, 'CPA Firms',  'Events Lead', 'Strong accounting firm audience', 2),
  ('NJCPA',                      'Q3',    10, 15, 18, 'CPA Firms',  'Events Lead', 'Smaller but targeted event',      3),
  ('Xerocon',                    'Q3',    15, 20, 25, 'Small Firms','Events Lead', 'SMB / app ecosystem fit',         4),
  ('Intuit Connect / Tax / TR',  'Q3–Q4', 40, 50, 60, 'Mixed',      'Events Lead', 'Tax and ecosystem conferences',   5);

