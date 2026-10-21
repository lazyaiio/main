-- RLS test for migration 0002 (core data model).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after migration 0002).
-- Uses throwaway users inside a transaction and ROLLS BACK. Success: "ALL CORE RLS TESTS PASSED".
-- Any failure raises an error starting with "FAIL".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'core-a@example.test', '{"display_name":"Core A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'core-b@example.test', '{"display_name":"Core B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'core-c@example.test', '{"display_name":"Core C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a1'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b1'), true);

-- Setup as the database owner: B owns a project and a post; C is a VIEWER in workspace A.
insert into public.content_projects (id, workspace_id, name, input_type, input_value)
values ('00000000-0000-0000-0000-00000000b0b0', current_setting('test.ws_b')::uuid, 'B project', 'topic', 'b topic');

insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c1', 'viewer');

-- ===== User A (owner of workspace A) =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
  ws_b uuid := current_setting('test.ws_b')::uuid;
  proj_a uuid;
  camp_a uuid;
begin
  -- A can create and read own project
  insert into public.content_projects (workspace_id, name, input_type, input_value)
  values (ws_a, 'A project', 'topic', 'a topic') returning id into proj_a;

  select count(*) into n from public.content_projects;
  if n <> 1 then raise exception 'FAIL A1: A sees % projects (expected 1)', n; end if;

  -- created_by is set by the database, not the client
  if (select created_by from public.content_projects where id = proj_a) <> '00000000-0000-0000-0000-0000000000a1' then
    raise exception 'FAIL A2: created_by was not set from the session';
  end if;

  -- A cannot read or modify B's project
  select count(*) into n from public.content_projects where id = '00000000-0000-0000-0000-00000000b0b0';
  if n <> 0 then raise exception 'FAIL A3: A can read B project'; end if;

  update public.content_projects set name = 'hacked' where id = '00000000-0000-0000-0000-00000000b0b0';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL A4: A updated B project'; end if;

  delete from public.content_projects where id = '00000000-0000-0000-0000-00000000b0b0';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL A5: A deleted B project'; end if;

  -- A cannot insert into B's workspace
  begin
    insert into public.content_projects (workspace_id, name, input_type, input_value) values (ws_b, 'x', 'topic', 'x');
    raise exception 'FAIL A6: A inserted a project into workspace B';
  exception when insufficient_privilege then null;
  end;

  -- A cannot move a project to another workspace (column not updatable)
  begin
    update public.content_projects set workspace_id = ws_b where id = proj_a;
    raise exception 'FAIL A7: A changed workspace_id of a project';
  exception when insufficient_privilege then null;
  end;

  -- Cross-workspace reference is rejected by the composite foreign key
  begin
    insert into public.campaigns (workspace_id, project_id, name, duration_days, requested_item_count)
    values (ws_a, '00000000-0000-0000-0000-00000000b0b0', 'bad', 7, 7);
    raise exception 'FAIL A8: campaign pointed at a project from another workspace';
  exception when foreign_key_violation then null;
  end;

  -- A valid campaign and content item work
  -- (browsers may not choose row ids: the id column is not insertable, the database generates it)
  insert into public.campaigns (workspace_id, project_id, name, duration_days, requested_item_count)
  values (ws_a, proj_a, 'A campaign', 7, 7) returning id into camp_a;
  insert into public.content_items (workspace_id, campaign_id, project_id, language, body)
  values (ws_a, camp_a, proj_a, 'en', 'Hello');

  begin
    insert into public.campaigns (id, workspace_id, project_id, name, duration_days, requested_item_count)
    values (gen_random_uuid(), ws_a, proj_a, 'chosen id', 7, 7);
    raise exception 'FAIL A8b: A chose a campaign id from the browser role';
  exception when insufficient_privilege then null;
  end;

  -- Server-controlled tables are not writable from the browser role
  begin
    insert into public.audit_events (workspace_id, action, entity_type) values (ws_a, 'x', 'x');
    raise exception 'FAIL A9: A wrote audit_events directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.usage_records (workspace_id, action_type) values (ws_a, 'x');
    raise exception 'FAIL A10: A wrote usage_records directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.job_queue (workspace_id, job_type) values (ws_a, 'x');
    raise exception 'FAIL A11: A wrote job_queue directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.scheduled_posts (workspace_id, content_item_id, social_page_id, scheduled_at, idempotency_key)
    values (ws_a, gen_random_uuid(), gen_random_uuid(), now(), 'k');
    raise exception 'FAIL A12: A wrote scheduled_posts directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name)
    values (ws_a, gen_random_uuid(), 'p1', 'x');
    raise exception 'FAIL A13: A wrote social_pages directly';
  exception when insufficient_privilege then null;
  end;

  -- job payload and locks are hidden from browsers
  begin
    perform payload from public.job_queue limit 1;
    raise exception 'FAIL A14: A can select job_queue.payload';
  exception when insufficient_privilege then null;
  end;

  -- The audit function records the real actor and respects the workspace
  perform public.log_audit_event(ws_a, 'project.created', 'project', proj_a, '{"name":"A project"}'::jsonb);
  select count(*) into n from public.audit_events;
  if n <> 1 then raise exception 'FAIL A15: expected 1 audit event, saw %', n; end if;
  if (select actor_user_id from public.audit_events limit 1) <> '00000000-0000-0000-0000-0000000000a1' then
    raise exception 'FAIL A16: audit actor was not taken from the session';
  end if;

  begin
    perform public.log_audit_event(ws_b, 'project.created', 'project', null, '{}'::jsonb);
    raise exception 'FAIL A17: A wrote an audit event into workspace B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== User B (owner of workspace B) =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare n int;
begin
  select count(*) into n from public.content_projects;
  if n <> 1 then raise exception 'FAIL B1: B sees % projects (expected only its own)', n; end if;
  select count(*) into n from public.campaigns;
  if n <> 0 then raise exception 'FAIL B2: B can read A campaigns'; end if;
  select count(*) into n from public.content_items;
  if n <> 0 then raise exception 'FAIL B3: B can read A content'; end if;
  select count(*) into n from public.audit_events;
  if n <> 0 then raise exception 'FAIL B4: B can read A audit events'; end if;
end $$;

-- ===== User C (VIEWER in workspace A) =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
begin
  select count(*) into n from public.content_projects where workspace_id = ws_a;
  if n <> 1 then raise exception 'FAIL C1: viewer cannot read workspace projects (saw %)', n; end if;

  begin
    insert into public.content_projects (workspace_id, name, input_type, input_value) values (ws_a, 'v', 'topic', 'v');
    raise exception 'FAIL C2: viewer inserted a project';
  exception when insufficient_privilege then null;
  end;

  update public.content_projects set name = 'viewer edit' where workspace_id = ws_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL C3: viewer updated a project'; end if;

  delete from public.content_items where workspace_id = ws_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL C4: viewer deleted content'; end if;

  begin
    perform public.log_audit_event(ws_a, 'x', 'x', null, '{}'::jsonb);
    raise exception 'FAIL C5: viewer wrote an audit event';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Anonymous =====
reset role;
set local role anon;

do $$
begin
  begin
    perform count(*) from public.content_projects;
    raise exception 'FAIL D1: anon can read projects';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.audit_events;
    raise exception 'FAIL D2: anon can read audit events';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL CORE RLS TESTS PASSED' as result;

rollback;
