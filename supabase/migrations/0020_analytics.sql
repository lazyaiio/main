-- LazyAI migration 0020: first-party website analytics (no cookies, no stored IP addresses).
-- Run once in the Supabase SQL Editor AFTER 0001-0019.
--
--  * analytics_pageviews: one row per counted page view on the public site. Browsers cannot read or write it.
--    The server writes it (service key) and the admin report reads it through analytics_report().
--  * A "visitor" is a one-way hash that changes every day (see lib/analytics.ts), so visitors are counted per day.
--  * analytics_report(): everything the Admin -> Analytics page needs, in one call. Service role only.
--  * analytics_cleanup(): deletes old rows (the retention period is set in Admin -> Analytics).

create table if not exists public.analytics_pageviews (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null check (char_length(path) between 1 and 200),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  source text not null default 'direct' check (source in ('direct', 'search', 'social', 'email', 'paid', 'campaign', 'referral')),
  source_name text check (source_name is null or char_length(source_name) <= 120),
  utm_source text check (utm_source is null or char_length(utm_source) <= 60),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 60),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 60),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  device text not null default 'desktop' check (device in ('desktop', 'mobile', 'tablet')),
  browser text not null default 'Other' check (char_length(browser) <= 40),
  os text not null default 'Other' check (char_length(os) <= 40),
  visitor_hash text check (visitor_hash is null or visitor_hash ~ '^[0-9a-f]{32}$'),
  session_id uuid not null,
  is_entry boolean not null default false
);
create index if not exists analytics_pageviews_created_idx on public.analytics_pageviews (created_at);
create index if not exists analytics_pageviews_session_idx on public.analytics_pageviews (session_id, created_at);
create index if not exists analytics_pageviews_visitor_idx on public.analytics_pageviews (visitor_hash, created_at desc);

alter table public.analytics_pageviews enable row level security;
revoke all on public.analytics_pageviews from anon, authenticated;
-- No policies on purpose: only the server (service key) can use this table.

create or replace function public.analytics_report(p_from timestamptz, p_to timestamptz, p_bucket text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_bucket not in ('hour', 'day', 'week', 'month', 'year') then
    raise exception 'invalid bucket' using errcode = '22023';
  end if;
  if p_to <= p_from or p_to - p_from > interval '3700 days' then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  with pv as (
    select * from public.analytics_pageviews where created_at >= p_from and created_at < p_to
  ),
  inner_unit as (
    select date_trunc(case when p_bucket = 'hour' then 'hour' else 'day' end, created_at at time zone 'UTC') as d,
           count(distinct visitor_hash) as vis
    from pv group by 1
  ),
  views_series as (
    select date_trunc(p_bucket, created_at at time zone 'UTC') as t, count(*) as views, count(distinct session_id) as sessions
    from pv group by 1
  ),
  visitors_series as (
    select date_trunc(p_bucket, d) as t, sum(vis) as visitors from inner_unit group by 1
  ),
  sessions as (
    select session_id, count(*) as n from pv group by 1
  ),
  last_page as (
    select distinct on (session_id) session_id, path from pv order by session_id, created_at desc, id desc
  )
  select jsonb_build_object(
    'online_now', (select count(distinct visitor_hash) from public.analytics_pageviews where created_at > now() - interval '30 minutes'),
    'totals', jsonb_build_object(
      'pageviews', (select count(*) from pv),
      'sessions', (select count(*) from sessions),
      'visitors', (select coalesce(sum(vis), 0) from inner_unit),
      'bounced_sessions', (select count(*) from sessions where n = 1),
      'signups', (select count(*) from auth.users where created_at >= p_from and created_at < p_to),
      'payments', (select count(*) from public.payments where status in ('completed', 'refunded') and completed_at >= p_from and completed_at < p_to),
      'revenue', (select coalesce(sum(amount), 0) from public.payments where status = 'completed' and completed_at >= p_from and completed_at < p_to)
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        't', to_char(v.t, 'YYYY-MM-DD HH24:MI:SS'),
        'views', v.views, 'sessions', v.sessions, 'visitors', coalesce(s.visitors, 0)) order by v.t)
      from views_series v left join visitors_series s on s.t = v.t), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('name', path, 'count', c)) from (select path, count(*) c from pv group by 1 order by 2 desc, 1 limit 15) x), '[]'::jsonb),
    'entry_pages', coalesce((select jsonb_agg(jsonb_build_object('name', path, 'count', c)) from (select path, count(*) c from pv where is_entry group by 1 order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    'exit_pages', coalesce((select jsonb_agg(jsonb_build_object('name', path, 'count', c)) from (select path, count(*) c from last_page group by 1 order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(source_name, 'Direct'), 'kind', source, 'count', c)) from (select source, source_name, count(*) c from pv where is_entry group by 1, 2 order by 3 desc, 2 limit 12) x), '[]'::jsonb),
    'source_kinds', coalesce((select jsonb_agg(jsonb_build_object('name', source, 'count', c)) from (select source, count(*) c from pv where is_entry group by 1 order by 2 desc) x), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(jsonb_build_object('name', referrer_host, 'count', c)) from (select referrer_host, count(*) c from pv where is_entry and referrer_host is not null group by 1 order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(country, 'Unknown'), 'count', c)) from (select country, count(*) c from pv where is_entry group by 1 order by 2 desc, 1 limit 12) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('name', device, 'count', c)) from (select device, count(*) c from pv where is_entry group by 1 order by 2 desc) x), '[]'::jsonb),
    'browsers', coalesce((select jsonb_agg(jsonb_build_object('name', browser, 'count', c)) from (select browser, count(*) c from pv where is_entry group by 1 order by 2 desc, 1 limit 8) x), '[]'::jsonb),
    'systems', coalesce((select jsonb_agg(jsonb_build_object('name', os, 'count', c)) from (select os, count(*) c from pv where is_entry group by 1 order by 2 desc, 1 limit 8) x), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('name', concat_ws(' / ', utm_campaign, utm_source, utm_medium), 'count', c)) from (select utm_campaign, utm_source, utm_medium, count(*) c from pv where is_entry and (utm_campaign is not null or utm_source is not null) group by 1, 2, 3 order by 4 desc, 1 limit 10) x), '[]'::jsonb),
    'first_view_at', (select min(created_at) from public.analytics_pageviews)
  ) into result;
  return result;
end;
$$;

revoke all on function public.analytics_report(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.analytics_report(timestamptz, timestamptz, text) to service_role;

create or replace function public.analytics_cleanup(p_days int)
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
  delete from public.analytics_pageviews where created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.analytics_cleanup(int) from public, anon, authenticated;
grant execute on function public.analytics_cleanup(int) to service_role;
