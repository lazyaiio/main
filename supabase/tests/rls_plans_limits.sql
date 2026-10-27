-- Test for migration 0013 (plans, limits, rate limiter).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0013).
-- Rolled back at the end. Success: a result row "ALL PLANS AND LIMITS TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-a@example.test', '{"display_name":"Plan A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-b@example.test', '{"display_name":"Plan B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plan-admin@example.test', '{"display_name":"Plan Admin"}', now(), now());
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000d1');

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a1'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b1'), true);

-- Plans exist and new workspaces start on "free"
do $$
begin
  if (select count(*) from public.plans where key in ('free', 'standard')) <> 2 then raise exception 'FAIL L0: default plans are missing'; end if;
  if (select plan from public.workspaces where id = current_setting('test.ws_a')::uuid) <> 'free' then raise exception 'FAIL L0b: new workspaces must start on free'; end if;
end $$;

-- Owner setup: small limits for workspace A, and one project.
update public.workspaces set limit_overrides = '{"content_items": 2, "social_pages": 1, "campaigns_open": 1}'::jsonb where id = current_setting('test.ws_a')::uuid;
insert into public.content_projects (id, workspace_id, name, input_type, input_value, languages)
values ('00000000-0000-0000-0000-00000000a1a1', current_setting('test.ws_a')::uuid, 'P', 'topic', 'topic', array['en']);

-- ===== A: owner of workspace A =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  ws uuid := current_setting('test.ws_a')::uuid;
  lim jsonb;
  use jsonb;
begin
  -- L1: posts are limited, even for direct inserts (the same call a browser could make)
  insert into public.content_items (workspace_id, language, body) values (ws, 'en', 'one');
  insert into public.content_items (workspace_id, language, body) values (ws, 'en', 'two');
  begin
    insert into public.content_items (workspace_id, language, body) values (ws, 'en', 'three');
    raise exception 'FAIL L1: a third post was accepted over the limit of 2';
  exception when configuration_limit_exceeded then null;
  end;

  -- L2: members see their plan and usage
  lim := public.workspace_limits(ws);
  if lim ->> 'plan' <> 'free' or (lim -> 'limits' ->> 'content_items')::int <> 2 then raise exception 'FAIL L2: limits are wrong: %', lim; end if;
  if (lim -> 'limits' ->> 'ai_generations_month')::int <> 100 then raise exception 'FAIL L2b: plan default not used'; end if;
  use := public.workspace_usage(ws);
  if (use ->> 'content_items')::int <> 2 then raise exception 'FAIL L2c: usage is wrong: %', use; end if;

  -- L3: campaigns are limited by the plan
  perform public.create_campaign_with_slots(ws, '00000000-0000-0000-0000-00000000a1a1', 'C1', 7, array['en'], '{}'::jsonb,
    jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
  begin
    perform public.create_campaign_with_slots(ws, '00000000-0000-0000-0000-00000000a1a1', 'C2', 7, array['en'], '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('planned_at', (now() + interval '1 day')::text, 'language', 'en', 'content_format', 'tip')));
    raise exception 'FAIL L3: a second open campaign was accepted over the limit of 1';
  exception when configuration_limit_exceeded then null;
  end;

  -- L4: browsers cannot change their own plan or limits
  begin
    update public.workspaces set plan = 'standard' where id = ws;
    raise exception 'FAIL L4: A changed the plan from the browser';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.workspaces set limit_overrides = '{}'::jsonb where id = ws;
    raise exception 'FAIL L4b: A changed the limits from the browser';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_workspace_plan(ws, 'standard', '{}'::jsonb);
    raise exception 'FAIL L4c: A called set_workspace_plan';
  exception when insufficient_privilege then null;
  end;

  -- L5: the limiter counts per person and action
  if not public.rate_limit_hit('test_action', 3, 60) then raise exception 'FAIL R1: hit 1 refused'; end if;
  if not public.rate_limit_hit('test_action', 3, 60) then raise exception 'FAIL R2: hit 2 refused'; end if;
  if not public.rate_limit_hit('test_action', 3, 60) then raise exception 'FAIL R3: hit 3 refused'; end if;
  if public.rate_limit_hit('test_action', 3, 60) then raise exception 'FAIL R4: hit 4 was allowed'; end if;
  if not public.rate_limit_hit('other_action', 3, 60) then raise exception 'FAIL R5: a different action shares the counter'; end if;
  begin
    perform public.rate_limit_hit('Bad Action!', 3, 60);
    raise exception 'FAIL R6: a bad action name was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.rate_limit_hit('x', 3, 5);
    raise exception 'FAIL R7: a tiny window was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform count(*) from public.rate_limits;
    raise exception 'FAIL R8: the counter table is readable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== B: another workspace is not affected and cannot peek =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
do $$
begin
  insert into public.content_items (workspace_id, language, body) values (current_setting('test.ws_b')::uuid, 'en', 'b one');
  insert into public.content_items (workspace_id, language, body) values (current_setting('test.ws_b')::uuid, 'en', 'b two');
  insert into public.content_items (workspace_id, language, body) values (current_setting('test.ws_b')::uuid, 'en', 'b three');
  begin
    perform public.workspace_limits(current_setting('test.ws_a')::uuid);
    raise exception 'FAIL B1: B read A''s limits';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.workspace_usage(current_setting('test.ws_a')::uuid);
    raise exception 'FAIL B2: B read A''s usage';
  exception when insufficient_privilege then null;
  end;
  if not public.rate_limit_hit('test_action', 3, 60) then raise exception 'FAIL B3: B shares A''s counter'; end if;
end $$;

-- ===== Platform admin changes the plan =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
do $$
declare
  ws uuid := current_setting('test.ws_a')::uuid;
begin
  begin
    perform public.set_workspace_plan(ws, 'nonexistent', '{}'::jsonb);
    raise exception 'FAIL P1: an unknown plan was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_workspace_plan(ws, 'standard', '{"made_up": 5}'::jsonb);
    raise exception 'FAIL P2: an unknown limit name was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_workspace_plan(ws, 'standard', '{"content_items": -1}'::jsonb);
    raise exception 'FAIL P3: a negative limit was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_workspace_plan(ws, 'standard', '{"content_items": "many"}'::jsonb);
    raise exception 'FAIL P4: a non-number limit was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.set_workspace_plan(ws, 'standard', '{}'::jsonb);
end $$;

-- ===== A again: the standard plan lifts the limit =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  insert into public.content_items (workspace_id, language, body) values (current_setting('test.ws_a')::uuid, 'en', 'three now');
  if (public.workspace_limits(current_setting('test.ws_a')::uuid) ->> 'plan') <> 'standard' then raise exception 'FAIL P5: plan not changed'; end if;
end $$;

-- ===== Signed out =====
reset role;
set local role anon;
do $$
begin
  begin
    perform public.rate_limit_hit('x_action', 3, 60);
    raise exception 'FAIL D1: anon used the rate limiter';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ===== Page limit (owner inserts, since browsers cannot) =====
update public.workspaces set plan = 'free', limit_overrides = '{"social_pages": 1}'::jsonb where id = current_setting('test.ws_a')::uuid;
insert into public.social_accounts (id, workspace_id, provider_account_id) values ('00000000-0000-0000-0000-00000000a1b1', current_setting('test.ws_a')::uuid, 'plan-fb');
insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name) values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000a1b1', 'plan-page-1', 'One');
do $$
begin
  begin
    insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name) values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000a1b1', 'plan-page-2', 'Two');
    raise exception 'FAIL L6: a second connected Page was accepted over the limit of 1';
  exception when configuration_limit_exceeded then null;
  end;
  insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name, status) values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000a1b1', 'plan-page-3', 'Three', 'disconnected');
end $$;

select 'ALL PLANS AND LIMITS TESTS PASSED' as result;

rollback;
