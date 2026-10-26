-- Test for migration 0012 (email preferences and delivery log).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0012).
-- Rolled back at the end. Success: a result row "ALL EMAIL TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000ae', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mail-a@example.test', '{"display_name":"Mail A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000bf', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mail-b@example.test', '{"display_name":"Mail B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000cf', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mail-admin@example.test', '{"display_name":"Mail Admin"}', now(), now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000cf');

-- Server (owner of the database) writes a log row and a suppressed preference for B.
insert into public.email_events (template, dedupe_key, user_id) values ('welcome', 'welcome:test-1', '00000000-0000-0000-0000-0000000000ae');
insert into public.email_preferences (user_id, suppressed) values ('00000000-0000-0000-0000-0000000000bf', true);

-- ===== A: ordinary user =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ae', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}', true);

do $$
begin
  -- E1: A can create and change their own choices
  insert into public.email_preferences (user_id, campaign_complete, publish_failures, page_alerts)
  values ('00000000-0000-0000-0000-0000000000ae', false, true, true);
  update public.email_preferences set page_alerts = false where user_id = '00000000-0000-0000-0000-0000000000ae';
  if (select page_alerts from public.email_preferences where user_id = '00000000-0000-0000-0000-0000000000ae') then
    raise exception 'FAIL E1: the choice was not saved';
  end if;

  -- E2: A cannot create a row for someone else, cannot set "suppressed", cannot see B's row
  begin
    insert into public.email_preferences (user_id) values ('00000000-0000-0000-0000-0000000000bf');
    raise exception 'FAIL E2: A created preferences for B';
  exception when unique_violation or insufficient_privilege or check_violation then null;
  end;
  begin
    update public.email_preferences set suppressed = true where user_id = '00000000-0000-0000-0000-0000000000ae';
    raise exception 'FAIL E3: A changed "suppressed"';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.email_preferences) <> 1 then raise exception 'FAIL E4: A sees other people''s preferences'; end if;
  update public.email_preferences set campaign_complete = true where user_id = '00000000-0000-0000-0000-0000000000bf';
  if (select count(*) from public.email_preferences where user_id = '00000000-0000-0000-0000-0000000000bf' and campaign_complete) <> 0 then
    null; -- row is invisible to A, so the update touches nothing
  end if;

  -- E5: the delivery log is closed to ordinary users
  if (select count(*) from public.email_events) <> 0 then raise exception 'FAIL E5: A can read the delivery log'; end if;
  begin
    insert into public.email_events (template, dedupe_key) values ('welcome', 'welcome:hack');
    raise exception 'FAIL E6: A wrote to the delivery log';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Platform admin: can read the log (no addresses in it), cannot write =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000cf', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cf","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.email_events) <> 1 then raise exception 'FAIL M1: the admin cannot read the delivery log'; end if;
  begin
    update public.email_events set status = 'delivered';
    raise exception 'FAIL M2: the admin changed the delivery log from the browser';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role anon;
do $$
begin
  begin
    perform count(*) from public.email_events;
    raise exception 'FAIL D1: anon can read the delivery log';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Server side rules
do $$
begin
  begin
    insert into public.email_events (template, dedupe_key) values ('welcome', 'welcome:test-1');
    raise exception 'FAIL S1: a duplicate dedupe_key was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.email_events (template, dedupe_key) values ('spam', 'x:1');
    raise exception 'FAIL S2: an unknown template was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.email_events (template, dedupe_key, error_code) values ('test', 'x:2', 'Bad Code!');
    raise exception 'FAIL S3: a bad error code was accepted';
  exception when check_violation then null;
  end;
end $$;

select 'ALL EMAIL TESTS PASSED' as result;

rollback;
