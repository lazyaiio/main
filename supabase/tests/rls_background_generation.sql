-- Test for migration 0014 (background writing, automatic scheduling and images, simple posts).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0014).
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: "ALL BACKGROUND GENERATION TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bg-a@example.test', '{"display_name":"BG A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bg-b@example.test', '{"display_name":"BG B"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a6'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b6'), true);

insert into public.content_projects (id, workspace_id, name, input_type, input_value, languages)
values ('00000000-0000-0000-0000-00000000a0a6', current_setting('test.ws_a')::uuid, 'A project', 'topic', 'topic', array['en']);

-- ===== Setup as A: a started campaign with two slots =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);

do $$
declare
  camp uuid;
  item uuid;
begin
  camp := public.create_campaign_with_slots(
    current_setting('test.ws_a')::uuid,
    '00000000-0000-0000-0000-00000000a0a6',
    'Background test', 7, array['en'], '{"topic":"x","auto_image":"1"}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip'),
      jsonb_build_object('planned_at', (now() + interval '2 days')::text, 'language', 'en', 'content_format', 'tip')
    )
  );
  perform public.start_campaign(camp);
  perform set_config('test.camp', camp::text, true);
  -- Posts created now are ready to schedule (no review step).
  insert into public.content_items (workspace_id, campaign_id, project_id, language, body, content_hash)
  values (current_setting('test.ws_a')::uuid, camp, '00000000-0000-0000-0000-00000000a0a6', 'en', 'Ready post', 'hash-ready')
  returning id into item;
  perform set_config('test.item', item::text, true);
  if (select approval_status from public.content_items where id = item) <> 'approved' then
    raise exception 'FAIL N1: a new post is not ready by default';
  end if;
end $$;

-- ===== B: another person cannot use A's campaign =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.claim_campaign_slots(current_setting('test.camp')::uuid, 1, 90);
    raise exception 'FAIL B1: B claimed A slots';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Anonymous callers cannot use the helper or the system functions =====
reset role;
set local role anon;
do $$
begin
  begin
    perform public._is_service_role();
    raise exception 'FAIL X1: anon called the service role check';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ===== The service role (background writer) =====
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  camp uuid := current_setting('test.camp')::uuid;
  slot_ids uuid[];
  ok boolean;
  n int;
begin
  if not public._is_service_role() then raise exception 'FAIL S0: the service role was not recognized'; end if;

  select array_agg(id order by slot_index) into slot_ids from public.claim_campaign_slots(camp, 2, 90);
  if coalesce(cardinality(slot_ids), 0) <> 2 then raise exception 'FAIL S1: the service role could not claim slots'; end if;

  ok := public.complete_campaign_slot(slot_ids[1], current_setting('test.item')::uuid);
  if not ok then raise exception 'FAIL S2: the service role could not complete a slot'; end if;

  perform public.release_campaign_slot(slot_ids[2], 'ai_failed', true, false);
  if (select status from public.campaign_slots where id = slot_ids[2]) <> 'planned' then
    raise exception 'FAIL S3: the service role could not release a slot';
  end if;

  select count(*) into n from public.get_enabled_ai_providers();
  -- The count depends on the settings; the call must simply work for the service role.

  perform public.pause_campaign(camp);
  if (select status from public.campaigns where id = camp) <> 'paused' then
    raise exception 'FAIL S4: the service role could not pause the campaign';
  end if;

  -- Scheduling needs a connected Page; with an unknown Page it must refuse cleanly.
  begin
    perform public.system_schedule_post(ws_a, current_setting('test.item')::uuid, '00000000-0000-0000-0000-00000000dead', now() + interval '1 day');
    raise exception 'FAIL S5: scheduling on an unknown Page worked';
  exception when no_data_found then null;
  end;
  begin
    perform public.system_schedule_post(ws_a, current_setting('test.item')::uuid, '00000000-0000-0000-0000-00000000dead', now() - interval '1 day');
    raise exception 'FAIL S6: scheduling in the past worked';
  exception when invalid_parameter_value then null;
  end;

  -- A made-up file cannot be registered as an image.
  begin
    perform public.system_register_media_asset(ws_a, ws_a::text || '/00000000-0000-0000-0000-0000000000ff.jpg', null, null, '{}'::jsonb, null, 'image/jpeg', 1000, 100, 100, null);
    raise exception 'FAIL S7: an image without a file was registered';
  exception when no_data_found then null;
  end;
end $$;
reset role;

-- ===== Ordinary signed-in users cannot call the system functions =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.system_schedule_post(current_setting('test.ws_a')::uuid, current_setting('test.item')::uuid, '00000000-0000-0000-0000-00000000dead', now() + interval '1 day');
    raise exception 'FAIL U1: a signed-in user called system_schedule_post';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.system_register_media_asset(current_setting('test.ws_a')::uuid, 'x', null, null, '{}'::jsonb, null, 'image/jpeg', 1, 1, 1, null);
    raise exception 'FAIL U2: a signed-in user called system_register_media_asset';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'ALL BACKGROUND GENERATION TESTS PASSED' as result;

rollback;
