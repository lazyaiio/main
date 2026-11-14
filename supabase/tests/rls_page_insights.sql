-- Test for migration 0025 (Page Insights). Run in the Supabase SQL Editor after 0001-0025.
-- Throwaway rows inside a transaction, ROLLED BACK at the end. Success: "ALL PAGE INSIGHTS TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pi-a@example.test', '{"display_name":"PI A"}', now(), now()),
       ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pi-b@example.test', '{"display_name":"PI B"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a7'), true);

insert into public.social_accounts (workspace_id, provider, provider_account_id, display_name, status)
values (current_setting('test.ws_a')::uuid, 'facebook', 'pi-test-fb-user', 'PI Test', 'connected');
insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name, status)
select current_setting('test.ws_a')::uuid, id, '100000000000777', 'PI Page', 'connected' from public.social_accounts where provider_account_id = 'pi-test-fb-user';
select set_config('test.page_a', (select id::text from public.social_pages where provider_page_id = '100000000000777'), true);

-- The server saves a snapshot.
insert into public.page_insight_snapshots (workspace_id, social_page_id, range_days, data)
values (current_setting('test.ws_a')::uuid, current_setting('test.page_a')::uuid, 28, '{"rangeDays":28}');

-- A member of the workspace can read it, and cannot change or delete it.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.page_insight_snapshots) <> 1 then raise exception 'FAIL P1: a member cannot read their own Insights'; end if;
  begin
    update public.page_insight_snapshots set data = '{"hacked":true}';
    raise exception 'FAIL P2: a member updated an Insights snapshot';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.page_insight_snapshots;
    raise exception 'FAIL P3: a member deleted an Insights snapshot';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.page_insight_snapshots (workspace_id, social_page_id, range_days, data) values (current_setting('test.ws_a')::uuid, current_setting('test.page_a')::uuid, 7, '{}');
    raise exception 'FAIL P4: a member inserted an Insights snapshot';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Someone from another workspace sees nothing.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.page_insight_snapshots) <> 0 then raise exception 'FAIL P5: another workspace can read these Insights'; end if;
end $$;
reset role;

-- Only 7 or 28 days are allowed, and one copy per Page and range.
do $$
begin
  begin
    insert into public.page_insight_snapshots (workspace_id, social_page_id, range_days, data) values (current_setting('test.ws_a')::uuid, current_setting('test.page_a')::uuid, 14, '{}');
    raise exception 'FAIL P6: a 14-day range was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.page_insight_snapshots (workspace_id, social_page_id, range_days, data) values (current_setting('test.ws_a')::uuid, current_setting('test.page_a')::uuid, 28, '{}');
    raise exception 'FAIL P7: a second copy for the same Page and range was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.page_insight_snapshots (workspace_id, social_page_id, range_days, data) values (current_setting('test.ws_a')::uuid, current_setting('test.page_a')::uuid, 7, '[]');
    raise exception 'FAIL P8: a non-object was accepted as data';
  exception when check_violation then null;
  end;
end $$;

-- Deleting the Page removes its saved numbers.
delete from public.social_pages where id = current_setting('test.page_a')::uuid;
do $$
begin
  if exists (select 1 from public.page_insight_snapshots where social_page_id = current_setting('test.page_a')::uuid) then raise exception 'FAIL P9: Insights stayed after the Page was deleted'; end if;
end $$;

select 'ALL PAGE INSIGHTS TESTS PASSED' as result;
rollback;
