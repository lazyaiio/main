-- Test for migration 0020 (analytics). Run in the Supabase SQL Editor after 0001-0020.
-- Inserts a few fake page views inside a transaction and ROLLS BACK. Success: "ALL ANALYTICS TESTS PASSED".

begin;

-- Browsers cannot read or write the table.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f0","role":"authenticated"}', true);
do $$
begin
  begin
    perform 1 from public.analytics_pageviews limit 1;
    raise exception 'FAIL A1: a browser role could read page views';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.analytics_pageviews (path, session_id) values ('/', gen_random_uuid());
    raise exception 'FAIL A2: a browser role could write page views';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.analytics_report(now() - interval '1 day', now(), 'day');
    raise exception 'FAIL A3: a browser role could run the report';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Fake data: two sessions yesterday-ish (relative to now), one with two pages.
insert into public.analytics_pageviews (created_at, path, source, source_name, referrer_host, country, device, browser, os, visitor_hash, session_id, is_entry) values
  (now() - interval '2 hours',  '/',        'search', 'Google', 'google.com', 'BD', 'mobile',  'Chrome', 'Android', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '00000000-0000-0000-0000-00000000aaa1', true),
  (now() - interval '119 minutes', '/pricing', 'direct', null, null, 'BD', 'mobile',  'Chrome', 'Android', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '00000000-0000-0000-0000-00000000aaa1', false),
  (now() - interval '1 hour',   '/about',   'social', 'Facebook', 'facebook.com', 'US', 'desktop', 'Firefox', 'Linux', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '00000000-0000-0000-0000-00000000aaa2', true);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  r jsonb;
begin
  r := public.analytics_report(now() - interval '1 day', now() + interval '1 minute', 'day');
  if (r -> 'totals' ->> 'pageviews')::int <> 3 then raise exception 'FAIL B1: expected 3 page views, got %', r -> 'totals' ->> 'pageviews'; end if;
  if (r -> 'totals' ->> 'sessions')::int <> 2 then raise exception 'FAIL B2: expected 2 sessions'; end if;
  if (r -> 'totals' ->> 'visitors')::int <> 2 then raise exception 'FAIL B3: expected 2 visitors'; end if;
  if (r -> 'totals' ->> 'bounced_sessions')::int <> 1 then raise exception 'FAIL B4: expected 1 bounced session'; end if;
  if (r -> 'exit_pages' -> 0 ->> 'count')::int < 1 then raise exception 'FAIL B5: no exit pages'; end if;
  if jsonb_array_length(r -> 'entry_pages') <> 2 then raise exception 'FAIL B6: expected 2 entry pages'; end if;
  begin
    perform public.analytics_report(now(), now() - interval '1 day', 'day');
    raise exception 'FAIL B7: a backwards range was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.analytics_cleanup(5);
    raise exception 'FAIL B8: a tiny retention was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

select 'ALL ANALYTICS TESTS PASSED' as result;
rollback;
