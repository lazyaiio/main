-- Test for migration 0023 (support inbox). Run in the Supabase SQL Editor after 0001-0023.
-- Uses fake messages inside a transaction and ROLLS BACK. Success: "ALL SUPPORT TESTS PASSED".

begin;

-- Browsers cannot read or write the table or run the helper functions.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
do $$
begin
  begin
    perform 1 from public.support_messages limit 1;
    raise exception 'FAIL A1: a browser role could read support messages';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.support_messages (name, email, message) values ('A', 'a@example.com', 'Hello, this is a test message.');
    raise exception 'FAIL A2: a browser role could write support messages';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.support_can_submit('x', 'a@example.com');
    raise exception 'FAIL A3: a browser role could run the spam guard';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.support_cleanup(90);
    raise exception 'FAIL A4: a browser role could run the cleanup';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role anon;
do $$
begin
  begin
    perform 1 from public.support_messages limit 1;
    raise exception 'FAIL A5: the anonymous role could read support messages';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Server side (service role).
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  i int;
  n bigint;
begin
  -- Constraints.
  begin
    insert into public.support_messages (name, email, message) values ('', 'a@example.com', 'Long enough message here.');
    raise exception 'FAIL B1: an empty name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.support_messages (name, email, message) values ('Ann', 'a@example.com', 'short');
    raise exception 'FAIL B2: a too-short message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.support_messages (name, email, message, topic) values ('Ann', 'a@example.com', 'Long enough message here.', 'spam');
    raise exception 'FAIL B3: an unknown topic was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.support_messages (name, email, message, status) values ('Ann', 'a@example.com', 'Long enough message here.', 'weird');
    raise exception 'FAIL B4: an unknown status was accepted';
  exception when check_violation then null;
  end;

  -- Spam guard: five messages from one label are fine, the sixth is refused.
  for i in 1..5 loop
    if not public.support_can_submit('hashhashhashhash1', 'person' || i || '@example.com') then
      raise exception 'FAIL C1: message % was refused too early', i;
    end if;
    insert into public.support_messages (name, email, message, ip_hash)
      values ('Ann', 'person' || i || '@example.com', 'This is test message number ' || i, 'hashhashhashhash1');
  end loop;
  if public.support_can_submit('hashhashhashhash1', 'someone-new@example.com') then
    raise exception 'FAIL C2: the sixth message in an hour from one label was accepted';
  end if;
  -- A different label is not affected.
  if not public.support_can_submit('hashhashhashhash2', 'fresh@example.com') then
    raise exception 'FAIL C3: a different sender was refused';
  end if;
  -- Three per address per day.
  for i in 1..3 loop
    insert into public.support_messages (name, email, message, ip_hash)
      values ('Bob', 'Bob@Example.com', 'Bob test message ' || i, 'hashhashhashhash3');
  end loop;
  if public.support_can_submit('hashhashhashhash9', 'bob@example.com') then
    raise exception 'FAIL C4: a fourth message from one address in a day was accepted (case must not matter)';
  end if;

  -- Cleanup: only closed and old messages are removed.
  insert into public.support_messages (name, email, message, status, updated_at)
    values ('Old', 'old@example.com', 'An old closed message.', 'closed', now() - interval '200 days'),
           ('Old', 'old2@example.com', 'An old open message.', 'open', now() - interval '200 days'),
           ('New', 'new@example.com', 'A recent closed message.', 'closed', now() - interval '2 days');
  n := public.support_cleanup(90);
  if n <> 1 then raise exception 'FAIL D1: expected 1 deleted message, got %', n; end if;
  if not exists (select 1 from public.support_messages where email = 'old2@example.com') then
    raise exception 'FAIL D2: an old open message was deleted';
  end if;
  if not exists (select 1 from public.support_messages where email = 'new@example.com') then
    raise exception 'FAIL D3: a recent closed message was deleted';
  end if;
  begin
    perform public.support_cleanup(5);
    raise exception 'FAIL D4: a tiny retention was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

do $$ begin raise notice 'ALL SUPPORT TESTS PASSED'; end $$;
rollback;
