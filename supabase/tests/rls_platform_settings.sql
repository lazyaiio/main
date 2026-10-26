-- Test for migration 0011 (site-wide settings and the publishing switch).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0011).
-- Rolled back at the end. Success: a result row "ALL PLATFORM SETTINGS TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ps-admin@example.test', '{"display_name":"PS Admin"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000be', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ps-user@example.test', '{"display_name":"PS User"}', now(), now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

-- Starts OFF
do $$
begin
  if public.is_live_publishing_enabled() then raise exception 'FAIL P0: live publishing should start switched off'; end if;
end $$;

-- ===== Ordinary user =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000be', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000be","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.platform_settings) <> 0 then raise exception 'FAIL P1: an ordinary user can read platform settings'; end if;
  begin
    perform public.set_live_publishing(true);
    raise exception 'FAIL P2: an ordinary user switched live publishing on';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publishing_overview();
    raise exception 'FAIL P3: an ordinary user read the publishing overview';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_settings (key, value) values ('live_publishing', '{"enabled": true}');
    raise exception 'FAIL P4: an ordinary user wrote platform settings directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_dispatcher_run('{}'::jsonb);
    raise exception 'FAIL P5: an ordinary user wrote a scheduler heartbeat';
  exception when insufficient_privilege then null;
  end;
  -- anyone signed in may ask the yes/no question
  if public.is_live_publishing_enabled() then raise exception 'FAIL P6: the switch is on for an ordinary user'; end if;
end $$;

-- ===== Platform admin =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
do $$
declare
  o jsonb;
begin
  if (select count(*) from public.platform_settings where key = 'live_publishing') <> 1 then raise exception 'FAIL A1: the admin cannot read the setting'; end if;
  perform public.set_live_publishing(true);
  if not public.is_live_publishing_enabled() then raise exception 'FAIL A2: the switch did not turn on'; end if;
  perform public.set_live_publishing(false);
  if public.is_live_publishing_enabled() then raise exception 'FAIL A3: the switch did not turn off'; end if;
  begin
    perform public.set_live_publishing(null);
    raise exception 'FAIL A4: a null value was accepted';
  exception when invalid_parameter_value then null;
  end;
  o := public.publishing_overview();
  if o -> 'due_now' is null or o -> 'published_24h' is null or o -> 'failed' is null then raise exception 'FAIL A5: the overview is missing counts'; end if;
end $$;

-- ===== Scheduler (service role) =====
reset role;
set local role service_role;
do $$
begin
  perform public.record_dispatcher_run('{"claimed": 2, "published": 1}'::jsonb);
  if (select value ->> 'at' from public.platform_settings where key = 'dispatcher_heartbeat') is null then
    raise exception 'FAIL S1: the heartbeat has no time';
  end if;
  begin
    perform public.record_dispatcher_run('[]'::jsonb);
    raise exception 'FAIL S2: a non-object summary was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- ===== Signed out =====
set local role anon;
do $$
begin
  begin
    perform public.is_live_publishing_enabled();
    raise exception 'FAIL D1: anon asked about the switch';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'ALL PLATFORM SETTINGS TESTS PASSED' as result;

rollback;
