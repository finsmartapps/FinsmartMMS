-- Account Pursuit — Reply watcher (Phase 3). Run once in the Supabase SQL editor. Safe to re-run.

begin;

-- What kind of reply it was, plus a one-line summary written by the classifier.
alter table public.abm_messages add column if not exists classification text;
alter table public.abm_messages add column if not exists summary        text;

-- Set to 'bounced' when the address does not work, so nothing is ever sent to it again.
alter table public.abm_contacts add column if not exists email_status text not null default 'ok';

-- When the mailbox was last checked for replies.
alter table public.abm_agent_settings add column if not exists last_mail_check timestamptz;

create index if not exists idx_abm_messages_rfc_message_id on public.abm_messages(rfc_message_id);

commit;
