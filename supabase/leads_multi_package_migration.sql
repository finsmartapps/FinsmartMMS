-- Allow one client (same email) to have several closed packages (different seat type / date).
-- Before: one lead per email. After: one lead per email + closed date + seat type.
drop index if exists public.leads_email_unique;
create unique index if not exists leads_email_package_unique
  on public.leads (lower(email), coalesce(closed_date, date '1900-01-01'), coalesce(seat_type, ''))
  where email != '';
