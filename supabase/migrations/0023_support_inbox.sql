-- LazyAI migration 0023: support inbox (messages from the public Contact form).
-- Run once in the Supabase SQL Editor AFTER 0001-0022.
--
-- Only the server (service key) can read or write this table. Browsers get no access at all.
-- The announcement banner and maintenance mode need no table: they live in platform_settings (key 'site_notice').

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 5 and 254),
  topic text not null default 'support' check (topic in ('support', 'privacy', 'report', 'business', 'other')),
  subject text not null default '' check (char_length(subject) <= 120),
  message text not null check (char_length(message) between 10 and 4000),
  -- Set when the sender was signed in. Never trusted for permissions.
  user_id uuid references auth.users (id) on delete set null,
  -- A one-way label that changes every day (no raw IP address is stored). Used only to limit spam.
  ip_hash text not null default '' check (char_length(ip_hash) <= 64),
  status text not null default 'new' check (status in ('new', 'open', 'closed')),
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  replied_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);

create index if not exists support_messages_status_created_idx on public.support_messages (status, created_at desc);
create index if not exists support_messages_ip_idx on public.support_messages (ip_hash, created_at desc);
create index if not exists support_messages_email_idx on public.support_messages (lower(email), created_at desc);

alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon, authenticated;
-- No policies on purpose: browsers get no access.

-- Spam guard for the public form (service role only): at most 5 messages per hour from one day-label,
-- and at most 3 per day for one email address. Returns true when one more message may be saved.
create or replace function public.support_can_submit(p_ip_hash text, p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  by_ip int;
  by_email int;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(p_ip_hash, '') <> '' then
    select count(*) into by_ip from public.support_messages
      where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
    if by_ip >= 5 then return false; end if;
  end if;
  select count(*) into by_email from public.support_messages
    where lower(email) = lower(coalesce(p_email, '')) and created_at > now() - interval '1 day';
  return by_email < 3;
end;
$$;

revoke all on function public.support_can_submit(text, text) from public, anon, authenticated;
grant execute on function public.support_can_submit(text, text) to service_role;

-- Deletes closed messages older than p_days days (service role only). The scheduler calls this once a day.
create or replace function public.support_cleanup(p_days int)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_days is null or p_days < 30 or p_days > 3650 then
    raise exception 'invalid retention' using errcode = '22023';
  end if;
  delete from public.support_messages where status = 'closed' and updated_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.support_cleanup(int) from public, anon, authenticated;
grant execute on function public.support_cleanup(int) to service_role;
