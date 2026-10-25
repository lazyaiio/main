-- Test for migration 0009 (data deletion records).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0009).
-- Success: a result row "ALL DATA DELETION TESTS PASSED".

begin;

insert into public.data_deletion_requests (code, source) values ('abcdefghijklmnop1234', 'facebook_deletion');

set local role authenticated;
do $$
begin
  begin
    perform count(*) from public.data_deletion_requests;
    raise exception 'FAIL 1: a signed-in user can read deletion records';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.data_deletion_requests (code, source) values ('zzzzzzzzzzzzzzzz9999', 'facebook_deletion');
    raise exception 'FAIL 2: a signed-in user can create deletion records';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role anon;
do $$
begin
  begin
    perform count(*) from public.data_deletion_requests;
    raise exception 'FAIL 3: a signed-out visitor can read deletion records';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  begin
    insert into public.data_deletion_requests (code, source) values ('short', 'facebook_deletion');
    raise exception 'FAIL 4: a short code was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.data_deletion_requests (code, source) values ('abcdefghijklmnop5678', 'somewhere_else');
    raise exception 'FAIL 5: an unknown source was accepted';
  exception when check_violation then null;
  end;
end $$;

select 'ALL DATA DELETION TESTS PASSED' as result;

rollback;
