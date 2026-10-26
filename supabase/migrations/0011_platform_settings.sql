-- LazyAI migration 0011: site-wide settings (live publishing switch, scheduler heartbeat) and a queue overview.
-- Run once in the Supabase SQL Editor AFTER 0001-0010.
--
--  * The switch for real Facebook posting moves into the Admin screen (Admin -> Publishing). It is stored
--    here, readable only by platform admins, and changed only through set_live_publishing().
--  * Everybody who is signed in can ask "is live publishing on?" (a yes/no answer, nothing else).
--  * Every scheduler run leaves a heartbeat (time and counts) so the Admin screen can show whether the
--    scheduler is really running.
--  * publishing_overview() gives platform admins counts only (due now, waiting, failed, published today).

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z_]{1,60}$'),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;
create policy "platform settings: admins read" on public.platform_settings
  for select to authenticated using (public.is_platform_admin());

-- Real posting starts OFF.
insert into public.platform_settings (key, value) values ('live_publishing', '{"enabled": false}')
on conflict (key) do nothing;

create or replace function public.is_live_publishing_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'live_publishing'), false)
$$;

create or replace function public.set_live_publishing(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  insert into public.platform_settings (key, value, updated_by)
  values ('live_publishing', jsonb_build_object('enabled', p_enabled), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end;
$$;

-- Called by the scheduler endpoint (service role) after every run.
create or replace function public.record_dispatcher_run(p_summary jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' or pg_column_size(p_summary) > 2048 then
    raise exception 'invalid summary' using errcode = '22023';
  end if;
  insert into public.platform_settings (key, value)
  values ('dispatcher_heartbeat', p_summary || jsonb_build_object('at', now()))
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

create or replace function public.publishing_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'due_now', count(*) filter (where status in ('scheduled', 'retrying') and coalesce(next_attempt_at, scheduled_at) <= now()),
    'waiting', count(*) filter (where status in ('scheduled', 'retrying') and coalesce(next_attempt_at, scheduled_at) > now()),
    'publishing', count(*) filter (where status = 'publishing'),
    'failed', count(*) filter (where status = 'failed'),
    'published_24h', count(*) filter (where status = 'published' and published_at > now() - interval '24 hours'),
    'oldest_due_seconds', coalesce(
      floor(extract(epoch from now() - min(coalesce(next_attempt_at, scheduled_at)) filter (where status in ('scheduled', 'retrying') and coalesce(next_attempt_at, scheduled_at) <= now())))::int,
      0)
  ) into result
  from public.scheduled_posts;
  return result;
end;
$$;

revoke all on function
  public.is_live_publishing_enabled(),
  public.set_live_publishing(boolean),
  public.record_dispatcher_run(jsonb),
  public.publishing_overview()
from public, anon, authenticated;

grant execute on function public.is_live_publishing_enabled() to authenticated, service_role;
grant execute on function public.set_live_publishing(boolean) to authenticated;
grant execute on function public.publishing_overview() to authenticated;
grant execute on function public.record_dispatcher_run(jsonb) to service_role;
