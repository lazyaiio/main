-- Test for migration 0004 (source documents).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0004).
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: "ALL SOURCE TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'src-a@example.test', '{"display_name":"Src A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'src-b@example.test', '{"display_name":"Src B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'src-c@example.test', '{"display_name":"Src C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a4'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b4'), true);

-- Setup as owner: B has a project; C is a viewer in A's workspace.
insert into public.content_projects (id, workspace_id, name, input_type, input_value)
values ('00000000-0000-0000-0000-00000000b0b4', current_setting('test.ws_b')::uuid, 'B project', 'topic', 'topic');
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c4', 'viewer');

-- ===== A =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);

do $$
declare
  n int;
  ws_a uuid := current_setting('test.ws_a')::uuid;
  doc_id uuid;
  failed_id uuid;
begin
  doc_id := public.record_source_document(ws_a, null, 'https://example.com/a', 'https://example.com/a', 'example.com', 'Title', 'Site', 'Some extracted text', 'ready', null, 'hash1', '{}'::jsonb);
  if doc_id is null then raise exception 'FAIL A1: no id returned'; end if;

  select count(*) into n from public.source_documents;
  if n <> 1 then raise exception 'FAIL A2: A sees % documents (expected 1)', n; end if;

  if (select created_by from public.source_documents where id = doc_id) <> '00000000-0000-0000-0000-0000000000a4' then
    raise exception 'FAIL A3: created_by was not set from the session';
  end if;

  failed_id := public.record_source_document(ws_a, null, 'https://example.com/b', null, 'example.com', null, null, null, 'failed', 'paywall', null, '{}'::jsonb);
  if (select extracted_text from public.source_documents where id = failed_id) is not null then
    raise exception 'FAIL A4: failed documents must not store text';
  end if;

  begin
    insert into public.source_documents (workspace_id, source_url, host, status, extracted_text)
    values (ws_a, 'https://x.com', 'x.com', 'ready', 'fabricated');
    raise exception 'FAIL A5: A inserted a source document directly';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.record_source_document(ws_a, null, 'https://example.com/c', null, 'example.com', null, null, '', 'ready', null, null, '{}'::jsonb);
    raise exception 'FAIL A6: a ready document without text was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.record_source_document(ws_a, null, 'https://example.com/c', null, 'example.com', null, null, 'x', 'weird', null, null, '{}'::jsonb);
    raise exception 'FAIL A7: an unknown status was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.record_source_document(ws_a, '00000000-0000-0000-0000-00000000b0b4', 'https://example.com/d', null, 'example.com', null, null, 'x', 'ready', null, null, '{}'::jsonb);
    raise exception 'FAIL A8: a project from another workspace was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    update public.source_documents set extracted_text = 'edited' where id = doc_id;
    raise exception 'FAIL A9: A edited extracted text from the browser role';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== B (outsider) =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.source_documents;
  if n <> 0 then raise exception 'FAIL B1: B can read A sources (saw %)', n; end if;

  delete from public.source_documents;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL B2: B deleted A sources'; end if;

  begin
    perform public.record_source_document(current_setting('test.ws_a')::uuid, null, 'https://example.com/z', null, 'example.com', null, null, 'x', 'ready', null, null, '{}'::jsonb);
    raise exception 'FAIL B3: B recorded a source into workspace A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== C (viewer in A) =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.source_documents where workspace_id = current_setting('test.ws_a')::uuid;
  if n <> 2 then raise exception 'FAIL C1: viewer cannot read workspace sources (saw %)', n; end if;

  delete from public.source_documents where workspace_id = current_setting('test.ws_a')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL C2: viewer deleted sources'; end if;

  begin
    perform public.record_source_document(current_setting('test.ws_a')::uuid, null, 'https://example.com/v', null, 'example.com', null, null, 'x', 'ready', null, null, '{}'::jsonb);
    raise exception 'FAIL C3: viewer recorded a source';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== A deletes its own =====
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;

do $$
declare n int;
begin
  delete from public.source_documents;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'FAIL A10: A could not delete its own sources (deleted %)', n; end if;
end $$;

-- ===== Anonymous =====
reset role;
set local role anon;

do $$
begin
  begin
    perform count(*) from public.source_documents;
    raise exception 'FAIL D1: anon can read sources';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_source_document(gen_random_uuid(), null, 'https://example.com', null, 'example.com', null, null, 'x', 'ready', null, null, '{}'::jsonb);
    raise exception 'FAIL D2: anon can record sources';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL SOURCE TESTS PASSED' as result;

rollback;
