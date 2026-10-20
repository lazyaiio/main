-- RLS tenant-isolation test for migration 0001.
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> paste this whole file -> Run (on the DEV project).
-- It creates two throwaway users inside a transaction and ROLLS BACK at the end (nothing is kept).
-- Success: the last result shows "ALL RLS TESTS PASSED". Any failure raises an error starting with "FAIL".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.test', '{"display_name":"Test A"}', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.test', '{"display_name":"Test B"}', now(), now());

-- 0. Signup trigger created profile, workspace and owner membership for both users.
do $$
begin
  if (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) <> 2 then
    raise exception 'FAIL 0a: signup trigger did not create both profiles';
  end if;
  if (select count(*) from public.workspaces where owner_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) <> 2 then
    raise exception 'FAIL 0b: signup trigger did not create both workspaces';
  end if;
  if (select count(*) from public.workspace_members where role = 'owner' and user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) <> 2 then
    raise exception 'FAIL 0c: signup trigger did not create both owner memberships';
  end if;
end $$;

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-00000000000a'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-00000000000b'), true);

-- ===== Act as user A =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
  ws_b uuid := current_setting('test.ws_b')::uuid;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL A1: user A sees % profiles (expected 1)', n; end if;

  select count(*) into n from public.workspaces;
  if n <> 1 then raise exception 'FAIL A2: user A sees % workspaces (expected 1)', n; end if;

  select count(*) into n from public.workspace_members;
  if n <> 1 then raise exception 'FAIL A3: user A sees % memberships (expected 1)', n; end if;

  select count(*) into n from public.workspaces where id = ws_b;
  if n <> 0 then raise exception 'FAIL A4: user A can read workspace B'; end if;

  update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL A5: user A updated profile B'; end if;

  update public.workspaces set name = 'hacked' where id = ws_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL A6: user A updated workspace B'; end if;

  update public.profiles set display_name = 'Test A renamed' where id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL A7: user A cannot update own profile'; end if;

  update public.workspaces set name = 'A workspace renamed' where id = ws_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL A8: user A cannot rename own workspace'; end if;

  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_b, '00000000-0000-0000-0000-00000000000a', 'owner');
    raise exception 'FAIL A9: user A inserted a membership into workspace B';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.workspaces set owner_id = '00000000-0000-0000-0000-00000000000a' where id = ws_a;
    raise exception 'FAIL A10: user A changed workspace owner_id from the browser role';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.workspace_members set role = 'viewer' where workspace_id = ws_a;
    raise exception 'FAIL A11: user A changed a membership role from the browser role';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.workspaces where id = ws_a;
    raise exception 'FAIL A12: user A deleted a workspace from the browser role';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Act as user B =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL B1: user B sees % profiles (expected 1)', n; end if;

  select count(*) into n from public.workspaces where id = ws_a;
  if n <> 0 then raise exception 'FAIL B2: user B can read workspace A'; end if;

  select count(*) into n from public.workspace_members where workspace_id = ws_a;
  if n <> 0 then raise exception 'FAIL B3: user B can read memberships of workspace A'; end if;

  select count(*) into n from public.profiles where display_name = 'hacked';
  if n <> 0 then raise exception 'FAIL B4: a cross-tenant write reached profile B'; end if;
end $$;

-- ===== Anonymous (not signed in) =====
reset role;
set local role anon;

do $$
begin
  begin
    perform count(*) from public.profiles;
    raise exception 'FAIL C1: anon can read profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.workspaces;
    raise exception 'FAIL C2: anon can read workspaces';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL RLS TESTS PASSED' as result;

rollback;
