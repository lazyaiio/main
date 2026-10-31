-- Test for migration 0019 (email verification). Run in the Supabase SQL Editor after 0001-0019.
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: "ALL EMAIL VERIFICATION TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ev-a@example.test', '{"display_name":"EV A"}', now(), now()),
       ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ev-b@example.test', '{"display_name":"EV B"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a9'), true);

-- A new account has no verification row, so it is not verified and cannot write.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);

do $$
begin
  if public.is_email_verified() then raise exception 'FAIL V1: a new account counts as verified'; end if;
  if public.can_write_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL V2: an unverified account may write'; end if;
  if not public.can_read_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL V3: an unverified account cannot even read its workspace'; end if;
  begin
    insert into public.content_projects (workspace_id, name, input_type, input_value) values (current_setting('test.ws_a')::uuid, 'x', 'topic', 'x');
    raise exception 'FAIL V4: an unverified account created a project';
  exception when insufficient_privilege or check_violation then null;
  end;
  -- The token columns are not readable from a browser.
  begin
    perform token_hash from public.user_email_verification;
    raise exception 'FAIL V5: a browser could read the token column';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- The server marks the account verified.
insert into public.user_email_verification (user_id, verified_at) values ('00000000-0000-0000-0000-0000000000a9', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
do $$
begin
  if not public.is_email_verified() then raise exception 'FAIL V6: a verified account is not recognized'; end if;
  if not public.can_write_workspace(current_setting('test.ws_a')::uuid) then raise exception 'FAIL V7: a verified owner cannot write'; end if;
end $$;

-- Another person cannot see A's verification row.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.user_email_verification where user_id = '00000000-0000-0000-0000-0000000000a9') then
    raise exception 'FAIL V8: B can see A''s verification row';
  end if;
end $$;
reset role;

select 'ALL EMAIL VERIFICATION TESTS PASSED' as result;
rollback;
