-- Test for migration 0005 (campaign planner).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0005).
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: "ALL CAMPAIGN PLANNER TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'camp-a@example.test', '{"display_name":"Camp A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'camp-b@example.test', '{"display_name":"Camp B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'camp-c@example.test', '{"display_name":"Camp C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a5'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b5'), true);

-- Setup as owner: A has an English+Bengali project, B has a project, C is a viewer in A's workspace.
insert into public.content_projects (id, workspace_id, name, input_type, input_value, languages)
values
  ('00000000-0000-0000-0000-00000000a0a5', current_setting('test.ws_a')::uuid, 'A project', 'topic', 'topic', array['en', 'bn']),
  ('00000000-0000-0000-0000-00000000b0b5', current_setting('test.ws_b')::uuid, 'B project', 'topic', 'topic', array['en']);
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c5', 'viewer');

-- ===== A: owner =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  proj uuid := '00000000-0000-0000-0000-00000000a0a5';
  camp uuid;
  slots jsonb;
  n int;
  claimed int;
  slot_ids uuid[];
  item1 uuid;
  ok boolean;
  st text;
begin
  slots := jsonb_build_array(
    jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip', 'theme', 'Angle one'),
    jsonb_build_object('planned_at', (now() + interval '2 days')::text, 'language', 'bn', 'content_format', 'tip'),
    jsonb_build_object('planned_at', (now() + interval '3 days')::text, 'language', 'en', 'content_format', 'checklist')
  );

  -- A1: create a campaign with three slots
  camp := public.create_campaign_with_slots(ws_a, proj, 'Test campaign', 7, array['en', 'bn'], '{"topic":"x"}'::jsonb, slots);
  if camp is null then raise exception 'FAIL A1: no id returned'; end if;
  select status into st from public.campaigns where id = camp;
  if st <> 'draft' then raise exception 'FAIL A1b: new campaign status is %, expected draft', st; end if;
  select count(*) into n from public.campaign_slots where campaign_id = camp;
  if n <> 3 then raise exception 'FAIL A1c: % slots stored (expected 3)', n; end if;
  if (select requested_item_count from public.campaigns where id = camp) <> 3 then
    raise exception 'FAIL A1d: requested_item_count is not the slot count';
  end if;
  if (select created_by from public.campaigns where id = camp) <> '00000000-0000-0000-0000-0000000000a5' then
    raise exception 'FAIL A1e: created_by was not taken from the session';
  end if;

  -- A2: browsers cannot write slots or change campaign status directly
  begin
    insert into public.campaign_slots (workspace_id, campaign_id, slot_index, planned_at, language, content_format)
    values (ws_a, camp, 50, now(), 'en', 'tip');
    raise exception 'FAIL A2: A inserted a slot directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.campaigns set status = 'generating' where id = camp;
    raise exception 'FAIL A3: A changed campaign status directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.campaign_slots set status = 'done' where campaign_id = camp;
    raise exception 'FAIL A4: A updated a slot directly';
  exception when insufficient_privilege then null;
  end;

  -- A5: nothing is handed out before the campaign is started
  select count(*) into claimed from public.claim_campaign_slots(camp, 3, 90);
  if claimed <> 0 then raise exception 'FAIL A5: slots were claimed from a draft campaign'; end if;

  -- A6: start, then claim two slots
  perform public.start_campaign(camp);
  select status into st from public.campaigns where id = camp;
  if st <> 'generating' then raise exception 'FAIL A6: status is %, expected generating', st; end if;

  select array_agg(id order by slot_index) into slot_ids from public.claim_campaign_slots(camp, 2, 90);
  if coalesce(cardinality(slot_ids), 0) <> 2 then raise exception 'FAIL A6b: expected 2 claimed slots'; end if;
  if (select min(attempts) from public.campaign_slots where id = any (slot_ids)) <> 1 then
    raise exception 'FAIL A6c: attempts not incremented';
  end if;

  -- A7: a second claim only gets the remaining slot (no double hand-out)
  select count(*) into claimed from public.claim_campaign_slots(camp, 5, 90);
  if claimed <> 1 then raise exception 'FAIL A7: second claim returned % slots (expected 1)', claimed; end if;
  select count(*) into claimed from public.claim_campaign_slots(camp, 5, 90);
  if claimed <> 0 then raise exception 'FAIL A7b: a fully leased campaign handed out slots again'; end if;

  -- A8: complete slot 1 with a real post; completing twice returns false
  insert into public.content_items (workspace_id, campaign_id, project_id, language, body, content_hash)
  values (ws_a, camp, proj, 'en', 'Post one', 'hash-one')
  returning id into item1;
  ok := public.complete_campaign_slot(slot_ids[1], item1);
  if not ok then raise exception 'FAIL A8: completing a claimed slot returned false'; end if;
  ok := public.complete_campaign_slot(slot_ids[1], item1);
  if ok then raise exception 'FAIL A8b: completing the same slot twice returned true'; end if;
  if (select content_item_id from public.campaign_slots where id = slot_ids[1]) <> item1 then
    raise exception 'FAIL A8c: post not linked to slot';
  end if;

  -- A9: a post from another campaign or workspace cannot be linked
  begin
    perform public.complete_campaign_slot(slot_ids[2], '00000000-0000-0000-0000-00000000dead');
    raise exception 'FAIL A9: an unknown post was linked';
  exception when invalid_parameter_value then null;
  end;

  -- A10: release slot 2 for retry (goes back to planned), then claim it again (attempt 2)
  perform public.release_campaign_slot(slot_ids[2], 'ai_failed', true, false);
  if (select status from public.campaign_slots where id = slot_ids[2]) <> 'planned' then
    raise exception 'FAIL A10: released slot is not planned again';
  end if;
  select count(*) into claimed from public.claim_campaign_slots(camp, 1, 90);
  if claimed <> 1 or (select attempts from public.campaign_slots where id = slot_ids[2]) <> 2 then
    raise exception 'FAIL A10b: retry claim did not count the second attempt';
  end if;

  -- A11: a refunded release does not count an attempt
  perform public.release_campaign_slot(slot_ids[2], 'rate_limited', true, true);
  if (select attempts from public.campaign_slots where id = slot_ids[2]) <> 1 then
    raise exception 'FAIL A11: refund did not restore the attempt';
  end if;

  -- A12: a bad error code is rejected
  begin
    perform public.release_campaign_slot(slot_ids[2], 'Bad Code!', true, false);
    raise exception 'FAIL A12: an invalid error code was accepted';
  exception when invalid_parameter_value then null;
  end;

  -- A13: pause stops hand-out; start resumes
  perform public.claim_campaign_slots(camp, 1, 90);              -- slot 2 is generating again
  perform public.pause_campaign(camp);
  if (select status from public.campaigns where id = camp) <> 'paused' then raise exception 'FAIL A13: not paused'; end if;
  select count(*) into claimed from public.claim_campaign_slots(camp, 5, 90);
  if claimed <> 0 then raise exception 'FAIL A13b: a paused campaign handed out slots'; end if;
  perform public.start_campaign(camp);

  -- A14: permanent failure of slot 2 (no retry); progress counts it; finish slot 3
  perform public.release_campaign_slot(slot_ids[2], 'ai_failed', false, false);
  if (select status from public.campaign_slots where id = slot_ids[2]) <> 'failed' then
    raise exception 'FAIL A14: slot did not fail';
  end if;
  if (select (generation_progress ->> 'failed')::int from public.campaigns where id = camp) <> 1 then
    raise exception 'FAIL A14b: progress does not show the failure';
  end if;
  -- slot 3 is still leased from A7; complete it with a second post
  declare
    third uuid;
    item3 uuid;
  begin
    select id into third from public.campaign_slots where campaign_id = camp and slot_index = 2;
    insert into public.content_items (workspace_id, campaign_id, project_id, language, body, content_hash)
    values (ws_a, camp, proj, 'en', 'Post three', 'hash-three')
    returning id into item3;
    ok := public.complete_campaign_slot(third, item3);
    if not ok then raise exception 'FAIL A14c: slot 3 could not be completed'; end if;
  end;

  -- A15: nothing left to do, so the campaign is finished (ready) with 2 done and 1 failed
  select status into st from public.campaigns where id = camp;
  if st <> 'ready' then raise exception 'FAIL A15: campaign status is %, expected ready', st; end if;
  if (select (generation_progress ->> 'completed')::int from public.campaigns where id = camp) <> 2 then
    raise exception 'FAIL A15b: completed count is wrong';
  end if;

  -- A16: duplicate wording inside one campaign is blocked by the unique index
  begin
    insert into public.content_items (workspace_id, campaign_id, project_id, language, body, content_hash)
    values (ws_a, camp, proj, 'en', 'Another', 'hash-one');
    raise exception 'FAIL A16: a duplicate content hash was accepted within a campaign';
  exception when unique_violation then null;
  end;

  -- A17: retry failed slots puts them back and resumes generating
  n := public.retry_failed_slots(camp);
  if n <> 1 then raise exception 'FAIL A17: retry reset % slots (expected 1)', n; end if;
  if (select status from public.campaigns where id = camp) <> 'generating' then
    raise exception 'FAIL A17b: campaign did not resume';
  end if;
  if (select attempts from public.campaign_slots where id = slot_ids[2]) <> 0 then
    raise exception 'FAIL A17c: attempts were not reset';
  end if;

  -- A18: cancel skips open slots but keeps finished work
  perform public.cancel_campaign(camp);
  if (select status from public.campaigns where id = camp) <> 'cancelled' then raise exception 'FAIL A18: not cancelled'; end if;
  if (select count(*) from public.campaign_slots where campaign_id = camp and status = 'skipped') <> 1 then
    raise exception 'FAIL A18b: open slot was not skipped';
  end if;
  if (select count(*) from public.campaign_slots where campaign_id = camp and status = 'done') <> 2 then
    raise exception 'FAIL A18c: finished slots were lost';
  end if;
  begin
    perform public.cancel_campaign(camp);
    raise exception 'FAIL A18d: a canceled campaign was canceled again';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.start_campaign(camp);
    raise exception 'FAIL A18e: a canceled campaign was started';
  exception when invalid_parameter_value then null;
  end;

  -- A19: validation of the plan itself
  begin
    perform public.create_campaign_with_slots(ws_a, proj, 'x', 7, array['en'], '{}'::jsonb, '[]'::jsonb);
    raise exception 'FAIL A19: an empty plan was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_campaign_with_slots(
      ws_a, proj, 'x', 30, array['en'], '{}'::jsonb,
      (select jsonb_agg(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')) from generate_series(1, 91)));
    raise exception 'FAIL A19b: 91 slots were accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_campaign_with_slots(
      ws_a, proj, 'x', 7, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'bn', 'content_format', 'tip')));
    raise exception 'FAIL A19c: a slot in a language the campaign does not use was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_campaign_with_slots(
      ws_a, proj, 'x', 7, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() - interval '30 days')::text, 'language', 'en', 'content_format', 'tip')));
    raise exception 'FAIL A19d: a slot far in the past was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_campaign_with_slots(
      ws_a, proj, 'x', 120, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
    raise exception 'FAIL A19e: a 120-day duration was accepted';
  exception when invalid_parameter_value then null;
  end;

  -- A20: a project from another workspace cannot be used
  begin
    perform public.create_campaign_with_slots(
      ws_a, '00000000-0000-0000-0000-00000000b0b5', 'x', 7, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
    raise exception 'FAIL A20: a project from another workspace was accepted';
  exception when no_data_found then null;
  end;

  perform set_config('test.camp_a', camp::text, true);
end $$;

-- A21: an expired lease hands the slot out again (the table owner moves the clock back)
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  proj uuid := '00000000-0000-0000-0000-00000000a0a5';
  camp uuid;
  slot_id uuid;
  claimed int;
begin
  camp := public.create_campaign_with_slots(
    ws_a, proj, 'Lease test', 7, array['en'], '{}'::jsonb,
    jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
  perform public.start_campaign(camp);
  select id into slot_id from public.claim_campaign_slots(camp, 1, 30);
  perform set_config('test.lease_camp', camp::text, true);
  perform set_config('test.lease_slot', slot_id::text, true);
end $$;

reset role;
update public.campaign_slots
set lease_expires_at = now() - interval '1 minute'
where id = current_setting('test.lease_slot')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

do $$
declare
  camp uuid := current_setting('test.lease_camp')::uuid;
  slot_id uuid := current_setting('test.lease_slot')::uuid;
  claimed int;
begin
  select count(*) into claimed from public.claim_campaign_slots(camp, 1, 30);
  if claimed <> 1 then raise exception 'FAIL A21: an expired lease was not handed out again'; end if;
  if (select attempts from public.campaign_slots where id = slot_id) <> 2 then
    raise exception 'FAIL A21b: the second hand-out did not count as attempt 2';
  end if;
end $$;

-- A22: after 3 expired leases the slot fails for good (timeout)
reset role;
update public.campaign_slots
set lease_expires_at = now() - interval '1 minute', attempts = 3
where id = current_setting('test.lease_slot')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);

do $$
declare
  camp uuid := current_setting('test.lease_camp')::uuid;
  slot_id uuid := current_setting('test.lease_slot')::uuid;
  claimed int;
begin
  select count(*) into claimed from public.claim_campaign_slots(camp, 1, 30);
  if claimed <> 0 then raise exception 'FAIL A22: a slot with 3 attempts was handed out again'; end if;
  if (select status from public.campaign_slots where id = slot_id) <> 'failed'
     or (select last_error_code from public.campaign_slots where id = slot_id) <> 'timeout' then
    raise exception 'FAIL A22b: the exhausted slot did not fail with timeout';
  end if;
  if (select status from public.campaigns where id = camp) <> 'failed' then
    raise exception 'FAIL A22c: a campaign with no finished posts should be failed';
  end if;
end $$;

-- ===== B: another workspace =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}', true);

do $$
declare
  camp uuid := current_setting('test.camp_a')::uuid;
  n int;
begin
  select count(*) into n from public.campaigns;
  if n <> 0 then raise exception 'FAIL B1: B sees % of A''s campaigns', n; end if;
  select count(*) into n from public.campaign_slots;
  if n <> 0 then raise exception 'FAIL B2: B sees % of A''s slots', n; end if;

  begin
    perform public.start_campaign(camp);
    raise exception 'FAIL B3: B started A''s campaign';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cancel_campaign(camp);
    raise exception 'FAIL B4: B canceled A''s campaign';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_campaign_slots(camp, 1, 30);
    raise exception 'FAIL B5: B claimed A''s slots';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.retry_failed_slots(camp);
    raise exception 'FAIL B6: B retried A''s slots';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_campaign_with_slots(
      current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000a0a5', 'x', 7, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
    raise exception 'FAIL B7: B created a campaign in A''s workspace';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== C: viewer in A's workspace (read-only) =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}', true);

do $$
declare
  camp uuid := current_setting('test.camp_a')::uuid;
  n int;
begin
  select count(*) into n from public.campaigns where id = camp;
  if n <> 1 then raise exception 'FAIL C1: the viewer cannot read the campaign'; end if;
  select count(*) into n from public.campaign_slots where campaign_id = camp;
  if n <> 3 then raise exception 'FAIL C2: the viewer sees % slots (expected 3)', n; end if;

  begin
    perform public.start_campaign(camp);
    raise exception 'FAIL C3: a viewer started a campaign';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.retry_failed_slots(camp);
    raise exception 'FAIL C4: a viewer retried slots';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_campaign_with_slots(
      current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000a0a5', 'x', 7, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
    raise exception 'FAIL C5: a viewer created a campaign';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Signed out =====
reset role;
set local role anon;
do $$
begin
  begin
    perform public.start_campaign('00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL D1: anon could call start_campaign';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin raise notice 'ALL CAMPAIGN PLANNER TESTS PASSED'; end $$;
rollback;
