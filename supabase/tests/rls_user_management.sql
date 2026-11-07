-- Test for migration 0024 (user management). Run in the Supabase SQL Editor after 0001-0024.
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: "ALL USER MANAGEMENT TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'um-a@example.test', '{"display_name":"UM A"}', now(), now()),
       ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'um-b@example.test', '{"display_name":"UM B"}', now(), now());

insert into public.user_email_verification (user_id, verified_at)
values ('00000000-0000-0000-0000-0000000000a8', now()), ('00000000-0000-0000-0000-0000000000b8', now())
on conflict (user_id) do update set verified_at = excluded.verified_at;

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a8'), true);

-- A verified, not suspended owner can write.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
do $$
begin
  if public.is_suspended() then raise exception 'FAIL U1: a new account counts as suspended'; end if;
  if not public.can_write_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL U2: a normal owner cannot write'; end if;
end $$;
reset role;

-- The server suspends A.
insert into public.account_suspensions (user_id, reason) values ('00000000-0000-0000-0000-0000000000a8', 'test reason');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
do $$
begin
  if not public.is_suspended() then raise exception 'FAIL U3: a suspended account is not recognized'; end if;
  if public.can_write_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL U4: a suspended account may write'; end if;
  if not public.can_read_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL U5: a suspended account cannot read its own workspace'; end if;
  begin
    insert into public.content_projects (workspace_id, name, input_type, input_value) values (current_setting('test.ws_a')::uuid, 'x', 'topic', 'x');
    raise exception 'FAIL U6: a suspended account created a project';
  exception when insufficient_privilege or check_violation then null;
  end;
  -- The person can see THAT they are suspended, never WHY.
  if not exists (select 1 from public.account_suspensions where user_id = '00000000-0000-0000-0000-0000000000a8') then raise exception 'FAIL U7: A cannot see their own suspension row'; end if;
  begin
    perform reason from public.account_suspensions;
    raise exception 'FAIL U8: a browser could read the reason column';
  exception when insufficient_privilege then null;
  end;
  -- A browser cannot lift its own suspension.
  begin
    delete from public.account_suspensions where user_id = '00000000-0000-0000-0000-0000000000a8';
    if not exists (select 1 from public.account_suspensions where user_id = '00000000-0000-0000-0000-0000000000a8') then raise exception 'FAIL U9: a browser deleted its own suspension'; end if;
  exception when insufficient_privilege then null;
  end;
  -- The people search is not open to browsers.
  begin
    perform * from public.admin_list_users(null, 5, 0);
    raise exception 'FAIL U10: a browser called admin_list_users';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B cannot see A's suspension.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.account_suspensions where user_id = '00000000-0000-0000-0000-0000000000a8') then
    raise exception 'FAIL U11: B can see A''s suspension';
  end if;
  if public.is_suspended() then raise exception 'FAIL U12: B counts as suspended'; end if;
end $$;
reset role;

-- The service role can search, and the answer carries the right state.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  r record;
begin
  select * into r from public.admin_list_users('um-a@', 10, 0);
  if r.out_user_id is null then raise exception 'FAIL U13: the search did not find A by email'; end if;
  if not r.out_suspended then raise exception 'FAIL U14: the search does not show A as suspended'; end if;
  if not r.out_email_verified then raise exception 'FAIL U15: the search does not show A as verified'; end if;
  if r.out_plan <> 'free' then raise exception 'FAIL U16: the search shows the wrong plan'; end if;
  select * into r from public.admin_list_users('UM B', 10, 0);
  if r.out_user_id <> '00000000-0000-0000-0000-0000000000b8' then raise exception 'FAIL U17: the search did not find B by name'; end if;
  -- A percent sign is searched for literally, not as a wildcard.
  if exists (select 1 from public.admin_list_users('%', 10, 0)) then raise exception 'FAIL U18: a lone percent sign matched everyone'; end if;
end $$;
reset role;

-- Restoring: the row is deleted by the server and writing works again.
delete from public.account_suspensions where user_id = '00000000-0000-0000-0000-0000000000a8';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
do $$
begin
  if not public.can_write_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL U19: a restored account cannot write'; end if;
end $$;
reset role;

-- The email log accepts the new templates.
do $$
begin
  insert into public.email_events (user_id, template, dedupe_key, status) values ('00000000-0000-0000-0000-0000000000a8', 'payment_receipt', 'um-test-1', 'sent');
  insert into public.email_events (user_id, template, dedupe_key, status) values ('00000000-0000-0000-0000-0000000000a8', 'plan_ending_soon', 'um-test-2', 'sent');
  insert into public.email_events (user_id, template, dedupe_key, status) values ('00000000-0000-0000-0000-0000000000a8', 'plan_ended', 'um-test-3', 'sent');
exception when check_violation then
  raise exception 'FAIL U20: the email log does not accept a new template';
end $$;

select 'ALL USER MANAGEMENT TESTS PASSED' as result;
rollback;
