-- Test for migration 0008 (Facebook connections).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0008).
-- Rolled back at the end. Success: a result row "ALL SOCIAL TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-a@example.test', '{"display_name":"Social A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-b@example.test', '{"display_name":"Social B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-c@example.test', '{"display_name":"Social C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a8'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b8'), true);
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c8', 'viewer');

-- No token-like column may exist on the tables browsers can read.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('social_accounts', 'social_pages')
      and column_name ~* '(token|secret)' and column_name <> 'token_expires_at'
  ) then
    raise exception 'FAIL S0: a token or secret column exists on a browser-readable table';
  end if;
end $$;

-- Owner setup: a connected Page in workspace A with a stored (fake) encrypted token and an open attempt.
insert into public.social_accounts (id, workspace_id, provider_account_id, display_name)
values ('00000000-0000-0000-0000-00000000aa01', current_setting('test.ws_a')::uuid, 'fb-user-1', 'Test User');
insert into public.social_pages (id, workspace_id, social_account_id, provider_page_id, name)
values ('00000000-0000-0000-0000-00000000aa02', current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-00000000aa01', 'page-100', 'Test Page');
insert into public.social_page_tokens (social_page_id, workspace_id, token_ciphertext)
values ('00000000-0000-0000-0000-00000000aa02', current_setting('test.ws_a')::uuid, 'v1.aaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccc');
insert into public.social_oauth_flows (workspace_id, user_id, state_hash, expires_at)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000a8', repeat('a', 64), now() + interval '10 minutes');

-- ===== A: owner =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  n int;
begin
  select count(*) into n from public.social_pages;
  if n <> 1 then raise exception 'FAIL A1: A sees % connected Pages (expected 1)', n; end if;
  select count(*) into n from public.social_accounts;
  if n <> 1 then raise exception 'FAIL A2: A sees % accounts (expected 1)', n; end if;

  -- The tokens and the OAuth attempts are invisible and untouchable for browsers.
  begin
    perform count(*) from public.social_page_tokens;
    raise exception 'FAIL A3: A can read the token table';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.social_page_tokens (social_page_id, workspace_id, token_ciphertext)
    values ('00000000-0000-0000-0000-00000000aa02', ws_a, 'v1.aaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccc');
    raise exception 'FAIL A4: A wrote to the token table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.social_oauth_flows;
    raise exception 'FAIL A5: A can read OAuth attempts';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.social_oauth_flows (workspace_id, user_id, state_hash, expires_at)
    values (ws_a, '00000000-0000-0000-0000-0000000000a8', repeat('b', 64), now() + interval '10 minutes');
    raise exception 'FAIL A6: A created an OAuth attempt from the browser';
  exception when insufficient_privilege then null;
  end;

  -- Browsers cannot create or change connections either.
  begin
    insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name)
    values (ws_a, '00000000-0000-0000-0000-00000000aa01', 'page-200', 'Fake');
    raise exception 'FAIL A7: A created a Page connection from the browser';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.social_pages set status = 'connected', name = 'Renamed' where id = '00000000-0000-0000-0000-00000000aa02';
    raise exception 'FAIL A8: A changed a Page connection from the browser';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.social_accounts (workspace_id, provider_account_id) values (ws_a, 'fb-user-2');
    raise exception 'FAIL A9: A created an account connection from the browser';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.social_pages where id = '00000000-0000-0000-0000-00000000aa02';
    raise exception 'FAIL A10: A deleted a Page connection from the browser';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== B: another workspace =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  select count(*) into n from public.social_pages;
  if n <> 0 then raise exception 'FAIL B1: B sees A''s Pages'; end if;
  select count(*) into n from public.social_accounts;
  if n <> 0 then raise exception 'FAIL B2: B sees A''s accounts'; end if;
end $$;

-- ===== C: viewer in A's workspace: can see the Pages, never the tokens =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c8', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c8","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  select count(*) into n from public.social_pages;
  if n <> 1 then raise exception 'FAIL C1: the viewer cannot see the connected Page'; end if;
  begin
    perform count(*) from public.social_page_tokens;
    raise exception 'FAIL C2: the viewer can read tokens';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== Signed out =====
reset role;
set local role anon;
do $$
begin
  begin
    perform count(*) from public.social_pages;
    raise exception 'FAIL D1: anon can read Pages';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.social_page_tokens;
    raise exception 'FAIL D2: anon can read tokens';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- The Page can be connected in only one workspace (also enforced by the unique provider_page_id).
do $$
begin
  begin
    insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name)
    select current_setting('test.ws_b')::uuid, a.id, 'page-100', 'Same Page elsewhere'
    from (select id from public.social_accounts limit 1) a;
    raise exception 'FAIL E1: the same Facebook Page was connected twice';
  exception when unique_violation or foreign_key_violation then null;
  end;
end $$;

select 'ALL SOCIAL TESTS PASSED' as result;

rollback;
