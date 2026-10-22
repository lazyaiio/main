-- RLS/function test for migration 0003 (admin + AI settings + usage recording).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0003).
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: "ALL ADMIN/AI TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm-a@example.test', '{"display_name":"Adm A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm-b@example.test', '{"display_name":"Adm B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm-c@example.test', '{"display_name":"Adm C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a3'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b3'), true);

-- Setup as database owner: A is a platform admin; C is a viewer in A's workspace.
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a3');
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c3', 'viewer');

-- ===== A: platform admin and workspace owner =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
  ws_b uuid := current_setting('test.ws_b')::uuid;
begin
  if not public.is_platform_admin() then raise exception 'FAIL A1: admin not recognized'; end if;

  select count(*) into n from public.ai_provider_settings;
  if n <> 4 then raise exception 'FAIL A2: admin sees % provider rows (expected 4)', n; end if;

  update public.ai_provider_settings set enabled = true, model = 'test-model' where provider = 'anthropic';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL A3: admin could not update a provider'; end if;

  if (select updated_by from public.ai_provider_settings where provider = 'anthropic') <> '00000000-0000-0000-0000-0000000000a3' then
    raise exception 'FAIL A4: updated_by was not set from the session';
  end if;

  begin
    update public.ai_provider_settings set provider = 'openai' where provider = 'gemini';
    raise exception 'FAIL A5: admin changed a provider id';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.platform_admins;
    raise exception 'FAIL A6: browser role can read platform_admins';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000b3');
    raise exception 'FAIL A7: browser role can add platform admins';
  exception when insufficient_privilege then null;
  end;

  perform public.record_ai_usage(ws_a, 'ai.generate_post', 'anthropic', 'test-model', 420);
  select count(*) into n from public.usage_records where action_type = 'ai.generate_post' and user_id = '00000000-0000-0000-0000-0000000000a3';
  if n <> 1 then raise exception 'FAIL A8: usage was not recorded with the real user (saw %)', n; end if;

  begin
    perform public.record_ai_usage(ws_a, 'not valid', 'x', 'x', 1);
    raise exception 'FAIL A9: malformed usage action accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.record_ai_usage(ws_a, 'ai.generate_post', 'x', 'x', -5);
    raise exception 'FAIL A10: negative usage accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.record_ai_usage(ws_b, 'ai.generate_post', 'x', 'x', 1);
    raise exception 'FAIL A11: usage recorded into another workspace';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== B: normal user (not an admin) =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
begin
  if public.is_platform_admin() then raise exception 'FAIL B1: non-admin reported as admin'; end if;

  select count(*) into n from public.ai_provider_settings;
  if n <> 0 then raise exception 'FAIL B2: non-admin can read provider settings (saw %)', n; end if;

  update public.ai_provider_settings set enabled = true;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B3: non-admin changed provider settings'; end if;

  select count(*) into n from public.get_enabled_ai_providers();
  if n <> 1 then raise exception 'FAIL B4: expected 1 enabled provider via the function, saw %', n; end if;

  begin
    perform public.record_ai_usage(ws_a, 'ai.generate_post', 'x', 'x', 1);
    raise exception 'FAIL B5: outsider recorded usage in workspace A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== C: viewer in workspace A =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    perform public.record_ai_usage(current_setting('test.ws_a')::uuid, 'ai.generate_post', 'x', 'x', 1);
    raise exception 'FAIL C1: viewer recorded usage';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Anonymous =====
reset role;
set local role anon;

do $$
begin
  begin
    perform public.is_platform_admin();
    raise exception 'FAIL D1: anon can call is_platform_admin';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_enabled_ai_providers();
    raise exception 'FAIL D2: anon can list enabled providers';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.ai_provider_settings;
    raise exception 'FAIL D3: anon can read provider settings';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL ADMIN/AI TESTS PASSED' as result;

rollback;
