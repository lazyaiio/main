-- Test for migration 0010 (scheduling and the publishing queue).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0010).
-- Throwaway data inside a transaction, ROLLED BACK at the end. Success: a result row "ALL SCHEDULING TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sched-a@example.test', '{"display_name":"Sched A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sched-b@example.test', '{"display_name":"Sched B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sched-c@example.test', '{"display_name":"Sched C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a9'), true);
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c9', 'viewer');

-- Owner setup: one connected Page where posting is allowed, one disconnected, one view-only; items in several states.
insert into public.social_accounts (id, workspace_id, provider_account_id) values ('00000000-0000-0000-0000-00000000bb01', current_setting('test.ws_a')::uuid, 'fb-sched-1');
insert into public.social_pages (id, workspace_id, social_account_id, provider_page_id, name, status, capabilities) values
  ('00000000-0000-0000-0000-00000000bb11', current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000bb01', 'sched-page-1', 'Good Page', 'connected', '{"can_publish":true}'),
  ('00000000-0000-0000-0000-00000000bb12', current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000bb01', 'sched-page-2', 'Disconnected Page', 'disconnected', '{"can_publish":true}'),
  ('00000000-0000-0000-0000-00000000bb13', current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000bb01', 'sched-page-3', 'View-only Page', 'connected', '{"can_publish":false}');
insert into public.content_items (id, workspace_id, language, body, approval_status) values
  ('00000000-0000-0000-0000-00000000cc01', current_setting('test.ws_a')::uuid, 'en', 'Approved post one', 'approved'),
  ('00000000-0000-0000-0000-00000000cc02', current_setting('test.ws_a')::uuid, 'en', 'Draft post', 'draft'),
  ('00000000-0000-0000-0000-00000000cc03', current_setting('test.ws_a')::uuid, 'en', 'Approved post three', 'approved'),
  ('00000000-0000-0000-0000-00000000cc04', current_setting('test.ws_a')::uuid, 'en', 'Approved post four', 'approved'),
  ('00000000-0000-0000-0000-00000000cc05', current_setting('test.ws_a')::uuid, 'en', 'Approved post five', 'approved'),
  ('00000000-0000-0000-0000-00000000cc06', current_setting('test.ws_a')::uuid, 'en', 'Approved post six', 'approved'),
  ('00000000-0000-0000-0000-00000000cc07', current_setting('test.ws_a')::uuid, 'en', 'Approved post seven', 'approved');

-- ===== A: owner =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);

do $$
declare
  ws uuid := current_setting('test.ws_a')::uuid;
  page uuid := '00000000-0000-0000-0000-00000000bb11';
  sp uuid;
  n int;
begin
  -- S1: schedule an approved post
  sp := public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc01', page, now() + interval '2 hours');
  if (select status from public.scheduled_posts where id = sp) <> 'scheduled' then raise exception 'FAIL S1: not scheduled'; end if;
  if (select idempotency_key from public.scheduled_posts where id = sp) is null then raise exception 'FAIL S1b: no idempotency key'; end if;

  -- S2: the same post and Page cannot be scheduled twice
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc01', page, now() + interval '3 hours');
    raise exception 'FAIL S2: a duplicate schedule was accepted';
  exception when unique_violation then null;
  end;

  -- S3: rules
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc02', page, now() + interval '2 hours');
    raise exception 'FAIL S3: an unapproved post was scheduled';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc03', page, now() - interval '1 hour');
    raise exception 'FAIL S3b: a time in the past was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc03', page, now() + interval '400 days');
    raise exception 'FAIL S3c: a time over a year ahead was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000bb12', now() + interval '2 hours');
    raise exception 'FAIL S3d: a disconnected Page was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000bb13', now() + interval '2 hours');
    raise exception 'FAIL S3e: a view-only Page was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000dead', page, now() + interval '2 hours');
    raise exception 'FAIL S3f: an unknown post was accepted';
  exception when no_data_found then null;
  end;

  -- S4: browsers cannot write the queue or call the dispatcher functions
  begin
    insert into public.scheduled_posts (workspace_id, content_item_id, social_page_id, scheduled_at, idempotency_key)
    values (ws, '00000000-0000-0000-0000-00000000cc03', page, now() + interval '2 hours', 'x');
    raise exception 'FAIL S4: a direct insert into scheduled_posts worked';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.scheduled_posts set status = 'published' where id = sp;
    raise exception 'FAIL S4b: a direct update of scheduled_posts worked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.claim_due_posts(5, 120);
    raise exception 'FAIL S4c: a browser called claim_due_posts';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.finish_post_published(sp, 'x');
    raise exception 'FAIL S4d: a browser called finish_post_published';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.release_post(sp);
    raise exception 'FAIL S4e: a browser called release_post';
  exception when insufficient_privilege then null;
  end;

  -- S5: change the time, cancel, and schedule again
  perform public.reschedule_post(sp, now() + interval '5 hours');
  if (select scheduled_at from public.scheduled_posts where id = sp) < now() + interval '4 hours' then raise exception 'FAIL S5: time not changed'; end if;
  perform public.cancel_scheduled_post(sp);
  if (select status from public.scheduled_posts where id = sp) <> 'cancelled' then raise exception 'FAIL S5b: not canceled'; end if;
  begin
    perform public.cancel_scheduled_post(sp);
    raise exception 'FAIL S5c: a canceled post was canceled again';
  exception when invalid_parameter_value then null;
  end;
  perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc01', page, now() + interval '6 hours');

  perform set_config('test.sp1', (select id::text from public.scheduled_posts where status = 'scheduled' and content_item_id = '00000000-0000-0000-0000-00000000cc01'), true);

  -- Posts for the dispatcher tests
  perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc03', page, now() + interval '2 hours'); -- p3: normal
  perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc04', page, now() + interval '2 hours'); -- p4: canceled before due
  perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc05', page, now() + interval '2 hours'); -- p5: lease expires
  perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc06', page, now() + interval '2 hours'); -- p6: too late
  perform public.schedule_post(ws, '00000000-0000-0000-0000-00000000cc07', page, now() + interval '2 hours'); -- p7: release and max attempts
  perform public.cancel_scheduled_post((select id from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc04' and status = 'scheduled'));
  select count(*) into n from public.scheduled_posts where status = 'scheduled';
  if n <> 5 then raise exception 'FAIL S6: expected 5 scheduled posts, found %', n; end if;
end $$;

-- B and the viewer C cannot touch A's schedule
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.cancel_scheduled_post(current_setting('test.sp1')::uuid);
    raise exception 'FAIL B1: B canceled A''s post';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reschedule_post(current_setting('test.sp1')::uuid, now() + interval '9 hours');
    raise exception 'FAIL B2: B rescheduled A''s post';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.schedule_post(current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000cc05', '00000000-0000-0000-0000-00000000bb11', now() + interval '9 hours');
    raise exception 'FAIL B3: B scheduled into A''s workspace';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.scheduled_posts) <> 0 then raise exception 'FAIL B4: B can see A''s schedule'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.scheduled_posts) < 5 then raise exception 'FAIL C1: the viewer cannot see the schedule'; end if;
  begin
    perform public.schedule_post(current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000cc05', '00000000-0000-0000-0000-00000000bb11', now() + interval '9 hours');
    raise exception 'FAIL C2: a viewer scheduled a post';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cancel_scheduled_post(current_setting('test.sp1')::uuid);
    raise exception 'FAIL C3: a viewer canceled a post';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Make posts due (owner of the database moves the clock back) =====
reset role;
update public.scheduled_posts
set scheduled_at = now() - interval '1 minute', next_attempt_at = now() - interval '1 minute'
where content_item_id in ('00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000cc04', '00000000-0000-0000-0000-00000000cc05', '00000000-0000-0000-0000-00000000cc07');
update public.scheduled_posts
set scheduled_at = now() - interval '7 hours', next_attempt_at = now() - interval '7 hours'
where content_item_id = '00000000-0000-0000-0000-00000000cc06';

-- ===== Dispatcher (service role) =====
set local role service_role;

do $$
declare
  claimed int;
  first_id uuid;
  r record;
  st text;
begin
  -- D1: due posts are claimed once. p3, p5 and p7 are due and active; p4 was canceled; p6 is too late.
  select count(*) into claimed from public.claim_due_posts(10, 120);
  if claimed <> 3 then raise exception 'FAIL D1: claimed % posts (expected 3: canceled and too-late posts must be skipped)', claimed; end if;
  if (select status from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc04') <> 'cancelled' then
    raise exception 'FAIL D1b: a canceled post changed state';
  end if;
  if (select last_error from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc06') <> 'missed_window' then
    raise exception 'FAIL D1c: a post 7 hours late was not marked missed_window';
  end if;

  -- D2: running the dispatcher again does not hand out the same posts (no duplicates)
  select count(*) into claimed from public.claim_due_posts(10, 120);
  if claimed <> 0 then raise exception 'FAIL D2: a second run claimed % posts again', claimed; end if;
  if exists (select 1 from public.scheduled_posts where status = 'publishing' and attempt_count <> 1) then
    raise exception 'FAIL D2b: an attempt was counted twice';
  end if;

  -- D3: temporary problem -> retrying with a delay, not due yet
  select id into first_id from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc03';
  st := public.finish_post_retry(first_id, 'rate_limited', 300, 5);
  if st <> 'retrying' then raise exception 'FAIL D3: expected retrying, got %', st; end if;
  select count(*) into claimed from public.claim_due_posts(10, 120);
  if claimed <> 0 then raise exception 'FAIL D3b: a post in its retry delay was claimed'; end if;

  -- D4: success is recorded once
  select id into first_id from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc05';
  if not public.finish_post_published(first_id, '123_456') then raise exception 'FAIL D4: could not record a success'; end if;
  if public.finish_post_published(first_id, '123_456') then raise exception 'FAIL D4b: a success was recorded twice'; end if;
  if (select provider_post_id from public.scheduled_posts where id = first_id) <> '123_456' then raise exception 'FAIL D4c: post id not stored'; end if;

  -- D5: permanent failure and bad codes
  select id into first_id from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc07';
  begin
    perform public.finish_post_failed(first_id, 'Bad Code!');
    raise exception 'FAIL D5: an invalid error code was accepted';
  exception when invalid_parameter_value then null;
  end;
  -- D6: release hands the post back without using an attempt
  if not public.release_post(first_id) then raise exception 'FAIL D6: release failed'; end if;
  select * into r from public.scheduled_posts where id = first_id;
  if r.status <> 'scheduled' or r.attempt_count <> 0 then raise exception 'FAIL D6b: release did not restore the post (% / %)', r.status, r.attempt_count; end if;
end $$;

-- D7: retry delay passes -> claimed again as attempt 2; after the maximum number of attempts it fails for good
reset role;
update public.scheduled_posts set next_attempt_at = now() - interval '1 second' where content_item_id = '00000000-0000-0000-0000-00000000cc03';
set local role service_role;
do $$
declare
  claimed int;
  first_id uuid;
begin
  select count(*) into claimed from public.claim_due_posts(10, 120);
  if claimed < 1 then raise exception 'FAIL D7: a retrying post was not claimed after its delay'; end if;
  select id into first_id from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc03';
  if (select attempt_count from public.scheduled_posts where id = first_id) <> 2 then raise exception 'FAIL D7b: the retry was not counted as attempt 2'; end if;
  if public.finish_post_retry(first_id, 'rate_limited', 60, 2) <> 'failed' then raise exception 'FAIL D7c: the maximum attempts did not end in failure'; end if;
end $$;

-- D8: a publish attempt that never reported back is uncertain, never retried automatically
reset role;
update public.scheduled_posts set status = 'publishing', lease_expires_at = now() - interval '1 minute', attempt_count = 1
where content_item_id = '00000000-0000-0000-0000-00000000cc07';
set local role service_role;
do $$
declare
  claimed int;
begin
  select count(*) into claimed from public.claim_due_posts(10, 120);
  if claimed <> 0 then raise exception 'FAIL D8: an uncertain post was claimed again (risk of a duplicate post)'; end if;
  if (select last_error from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc07') <> 'uncertain_result' then
    raise exception 'FAIL D8b: the post was not marked uncertain_result';
  end if;
end $$;
reset role;

-- ===== People resolve failed posts =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
do $$
declare
  uncertain uuid;
  late uuid;
begin
  select id into uncertain from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc07';
  select id into late from public.scheduled_posts where content_item_id = '00000000-0000-0000-0000-00000000cc06';

  -- E1: "mark as published" only works for uncertain results
  begin
    perform public.mark_post_published_manually(late);
    raise exception 'FAIL E1: a missed post was marked published';
  exception when invalid_parameter_value then null;
  end;
  perform public.mark_post_published_manually(uncertain);
  if (select status from public.scheduled_posts where id = uncertain) <> 'published' then raise exception 'FAIL E1b: not published'; end if;

  -- E2: retry puts a failed post back in the queue; a published one cannot be retried
  perform public.retry_failed_post(late);
  if (select status from public.scheduled_posts where id = late) <> 'scheduled' then raise exception 'FAIL E2: retry did not requeue'; end if;
  begin
    perform public.retry_failed_post(uncertain);
    raise exception 'FAIL E2b: a published post was retried';
  exception when invalid_parameter_value then null;
  end;
end $$;

reset role;
select 'ALL SCHEDULING TESTS PASSED' as result;

rollback;
