-- AI Visibility tracker (Marketing > AI Visibility).
-- Asks free AI models a list of buyer questions every week and records which brands they name,
-- watches competitor sitemaps for new pages, checks our site's AI readiness, and stores
-- Search Console snapshots. Run once in the Supabase SQL editor. Safe to re-run.

begin;

-- Helper: does the signed-in user have the Marketing module?
create or replace function public.has_marketing_access()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select has_marketing from public.profiles where id = auth.uid()), false)
$$;

-- Brands we track: us + competitors.
create table if not exists public.aiv_brands (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  domain        text not null unique,              -- e.g. finsmartaccounting.com (no scheme, no www)
  aliases       text[] not null default '{}',      -- lower-case phrases that count as a mention
  exclude       text[] not null default '{}',      -- phrases removed before matching (look-alike names)
  is_us         boolean not null default false,
  track_site    boolean not null default true,     -- read sitemap + readiness checks
  active        boolean not null default true,
  sites_checked_at timestamptz,
  sitemap_baselined boolean not null default false, -- first sitemap read only sets the baseline
  created_at    timestamptz not null default now()
);

-- Questions we ask the AI models.
create table if not exists public.aiv_questions (
  id          uuid primary key default gen_random_uuid(),
  question    text not null unique,
  topic       text not null default 'general',
  source      text not null default 'manual' check (source in ('manual','seed','gsc','ai')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One run per week.
create table if not exists public.aiv_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running','done')),
  engines      text[] not null default '{}',
  note         text
);

-- One answer per question per engine per run.
create table if not exists public.aiv_answers (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.aiv_runs(id) on delete cascade,
  question_id  uuid not null references public.aiv_questions(id) on delete cascade,
  engine       text not null,             -- provider family, e.g. gemini / groq / openrouter
  model        text,
  status       text not null default 'ok' check (status in ('ok','error')),
  answer       text,
  brands_named jsonb not null default '[]'::jsonb,   -- [{name, website}] as the model listed them
  mentions     jsonb not null default '{}'::jsonb,   -- {brand_id: position (1 = first named) or 0 = named but unranked}
  urls         text[] not null default '{}',
  error        text,
  created_at   timestamptz not null default now(),
  unique (run_id, question_id, engine)
);
create index if not exists idx_aiv_answers_run on public.aiv_answers(run_id);

-- Every sitemap URL seen per brand.
create table if not exists public.aiv_pages (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.aiv_brands(id) on delete cascade,
  url         text not null,
  lastmod     text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  changed_at  timestamptz,
  removed_at  timestamptz,
  baseline    boolean not null default false,
  unique (brand_id, url)
);
create index if not exists idx_aiv_pages_new on public.aiv_pages(brand_id, first_seen desc);

-- AI readiness checks per brand.
create table if not exists public.aiv_readiness (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.aiv_brands(id) on delete cascade,
  checked_at  timestamptz not null default now(),
  passed      int not null default 0,
  total       int not null default 0,
  results     jsonb not null default '[]'::jsonb    -- [{key, label, ok, detail}]
);
create index if not exists idx_aiv_readiness_brand on public.aiv_readiness(brand_id, checked_at desc);

-- Search Console page snapshot: last 28 days vs the 28 days before.
create table if not exists public.aiv_gsc_pages (
  id             uuid primary key default gen_random_uuid(),
  snapshot_date  date not null,
  page           text not null,
  clicks         int not null default 0,
  impressions    int not null default 0,
  position       numeric,
  prev_clicks    int not null default 0,
  prev_impressions int not null default 0,
  prev_position  numeric,
  unique (snapshot_date, page)
);

-- Search Console question-style queries (last 28 days).
create table if not exists public.aiv_gsc_queries (
  id             uuid primary key default gen_random_uuid(),
  snapshot_date  date not null,
  query          text not null,
  clicks         int not null default 0,
  impressions    int not null default 0,
  position       numeric,
  top_page       text,
  unique (snapshot_date, query)
);

-- New questions waiting for a human to add or dismiss.
create table if not exists public.aiv_suggestions (
  id          uuid primary key default gen_random_uuid(),
  question    text not null unique,
  reason      text,
  source      text not null check (source in ('gsc','ai')),
  status      text not null default 'pending' check (status in ('pending','added','dismissed')),
  created_at  timestamptz not null default now()
);

-- RLS: Marketing users read and edit; cron uses the service role.
do $$
declare t text;
begin
  foreach t in array array['aiv_brands','aiv_questions','aiv_runs','aiv_answers','aiv_pages','aiv_readiness','aiv_gsc_pages','aiv_gsc_queries','aiv_suggestions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s marketing" on public.%I', t, t);
    execute format('create policy "%s marketing" on public.%I for all using (public.has_marketing_access()) with check (public.has_marketing_access())', t, t);
  end loop;
end $$;

-- Seed brands.
insert into public.aiv_brands (name, domain, aliases, exclude, is_us) values
  ('Finsmart Accounting', 'finsmartaccounting.com', array['finsmart accounting','finsmartaccounting','finsmart'], array['finsmart financial solutions','finsmart financial'], true),
  ('MyCPE ONE / Entigrity', 'my-cpe.com', array['mycpe','my-cpe','my cpe','mycpe one','entigrity'], '{}', false),
  ('QX Accounting Services', 'qxaccounting.com', array['qx accounting','qxaccounting','qxas','qx global'], '{}', false)
on conflict (domain) do nothing;

-- Seed questions: what a US CPA firm owner or small business might ask an AI assistant.
insert into public.aiv_questions (question, topic, source) values
  ('What are the best outsourced accounting firms for US CPA firms?', 'outsourcing', 'seed'),
  ('Which companies provide dedicated offshore accountants for US CPA firms?', 'offshore staffing', 'seed'),
  ('What are the best offshore staffing companies for accounting firms in 2026?', 'offshore staffing', 'seed'),
  ('How much does it cost to hire an offshore accountant from India for a CPA firm?', 'pricing', 'seed'),
  ('Which offshore accounting providers publish their pricing?', 'pricing', 'seed'),
  ('Who offers offshore tax preparers for US CPA firms during tax season?', 'tax', 'seed'),
  ('What are the best outsourced tax preparation services for CPA firms?', 'tax', 'seed'),
  ('How can a small CPA firm outsource 1040 tax return preparation safely?', 'tax', 'seed'),
  ('What are the best white-label accounting services for CPA firms?', 'outsourcing', 'seed'),
  ('What are the best offshore bookkeeping services for accounting firms?', 'bookkeeping', 'seed'),
  ('Which companies offer outsourced bookkeeping for US small businesses?', 'bookkeeping', 'seed'),
  ('Who are good QuickBooks bookkeeping outsourcing partners for accounting firms?', 'bookkeeping', 'seed'),
  ('Which companies offer outsourced accounts payable services for US businesses?', 'ap/ar', 'seed'),
  ('What are alternatives to hiring in-house staff accountants for a growing CPA firm?', 'staffing', 'seed'),
  ('How can a CPA firm scale without hiring locally?', 'staffing', 'seed'),
  ('Is it safe to outsource accounting work to India? Which providers are ISO 27001 certified?', 'security', 'seed'),
  ('What is a dedicated offshore accounting staff model and which companies offer it?', 'offshore staffing', 'seed'),
  ('Which offshore accounting firms let CPA firms hire one dedicated full-time accountant?', 'offshore staffing', 'seed'),
  ('What are the best outsourced CFO services for small businesses in the US?', 'cfo', 'seed'),
  ('Which outsourced accounting companies work with US CPA firms on Xero and QuickBooks?', 'software', 'seed'),
  ('What is Finsmart Accounting and is it a good choice for CPA firms?', 'brand', 'seed'),
  ('How does Finsmart Accounting compare with QX Accounting Services and MyCPE ONE?', 'brand', 'seed')
on conflict do nothing;

commit;
