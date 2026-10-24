-- Test for migration 0006 (media library).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0006).
-- Throwaway users inside a transaction, ROLLED BACK at the end. Success: a result row "ALL MEDIA TESTS PASSED".
-- Note: Supabase blocks direct deletes from storage tables, so removing files is covered by the app's
-- own flow, not by this script.

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-a@example.test', '{"display_name":"Media A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-b@example.test', '{"display_name":"Media B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'media-c@example.test', '{"display_name":"Media C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a6'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b6'), true);

insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c6', 'viewer');

-- Owner setup: the bucket must be private with the right limits.
do $$
declare
  b record;
begin
  select public, file_size_limit, allowed_mime_types into b from storage.buckets where id = 'media';
  if not found then raise exception 'FAIL M0: bucket "media" does not exist'; end if;
  if b.public then raise exception 'FAIL M0b: the media bucket is PUBLIC'; end if;
  if b.file_size_limit is distinct from 4194304 then raise exception 'FAIL M0c: wrong size limit %', b.file_size_limit; end if;
  if 'image/svg+xml' = any (b.allowed_mime_types) or 'text/html' = any (b.allowed_mime_types) then
    raise exception 'FAIL M0d: the bucket allows a risky file type';
  end if;
end $$;

-- Path helper
do $$
declare
  ws uuid := current_setting('test.ws_a')::uuid;
begin
  if public.media_object_workspace(ws || '/11111111-1111-4111-8111-111111111111.png') is distinct from ws then
    raise exception 'FAIL M1: a valid path was not recognized';
  end if;
  if public.media_object_workspace(ws || '/11111111-1111-4111-8111-111111111111.svg') is not null then raise exception 'FAIL M1b: .svg accepted'; end if;
  if public.media_object_workspace(ws || '/evil.png') is not null then raise exception 'FAIL M1c: a user-chosen name was accepted'; end if;
  if public.media_object_workspace(ws || '/sub/11111111-1111-4111-8111-111111111111.png') is not null then raise exception 'FAIL M1d: a sub-folder was accepted'; end if;
  if public.media_object_workspace('../' || ws || '/11111111-1111-4111-8111-111111111111.png') is not null then raise exception 'FAIL M1e: path traversal accepted'; end if;
  if public.media_object_workspace('11111111-1111-4111-8111-111111111111.png') is not null then raise exception 'FAIL M1f: a path without a workspace folder was accepted'; end if;
end $$;

-- A file in B's folder, added by the owner (setup), to prove A cannot see or register it.
insert into storage.objects (bucket_id, name)
values ('media', current_setting('test.ws_b') || '/22222222-2222-4222-8222-222222222222.png');

-- ===== A: owner =====
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  ws_b uuid := current_setting('test.ws_b')::uuid;
  path_a text := current_setting('test.ws_a') || '/11111111-1111-4111-8111-111111111111.png';
  path_a2 text := current_setting('test.ws_a') || '/33333333-3333-4333-8333-333333333333.png';
  path_b text := current_setting('test.ws_b') || '/22222222-2222-4222-8222-222222222222.png';
  asset uuid;
  item uuid;
  n int;
begin
  -- A1: A can add a file to their own folder
  insert into storage.objects (bucket_id, name) values ('media', path_a);

  -- A2: A cannot add files to B's folder, use bad names, or use another bucket's rules
  begin
    insert into storage.objects (bucket_id, name) values ('media', ws_b || '/44444444-4444-4444-8444-444444444444.png');
    raise exception 'FAIL A2: A added a file to B''s folder';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('media', ws_a || '/evil.svg');
    raise exception 'FAIL A3: a bad file name was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('media', ws_a || '/sub/55555555-5555-4555-8555-555555555555.png');
    raise exception 'FAIL A3b: a sub-folder path was accepted';
  exception when insufficient_privilege then null;
  end;

  -- A4: A sees their own file but not B's
  select count(*) into n from storage.objects where bucket_id = 'media' and name = path_a;
  if n <> 1 then raise exception 'FAIL A4: A cannot read their own file'; end if;
  select count(*) into n from storage.objects where bucket_id = 'media' and name = path_b;
  if n <> 0 then raise exception 'FAIL A4b: A can see B''s file'; end if;

  -- A5: registering creates a ready library entry
  asset := public.register_media_asset(ws_a, path_a, null, '{"credit_text":"Own photo"}'::jsonb, '  A red door  ', 'image/png', 1000, 800, 600);
  if (select processing_status from public.media_assets where id = asset) <> 'ready' then raise exception 'FAIL A5: not ready'; end if;
  if (select alt_text from public.media_assets where id = asset) <> 'A red door' then raise exception 'FAIL A5b: alt text not trimmed'; end if;
  if (select created_by from public.media_assets where id = asset) <> '00000000-0000-0000-0000-0000000000a6' then raise exception 'FAIL A5c: created_by'; end if;

  -- A6: the same file cannot be registered twice
  begin
    perform public.register_media_asset(ws_a, path_a, null, '{}'::jsonb, null, 'image/png', 1000, 800, 600);
    raise exception 'FAIL A6: a file was registered twice';
  exception when unique_violation then null;
  end;

  -- A7: browsers cannot insert library rows directly
  begin
    insert into public.media_assets (workspace_id, storage_path, mime_type, byte_size, width, height)
    values (ws_a, path_a2, 'image/png', 10, 10, 10);
    raise exception 'FAIL A7: a direct insert into media_assets worked';
  exception when insufficient_privilege then null;
  end;

  -- A8: registration checks
  begin
    perform public.register_media_asset(ws_a, path_a2, null, '{}'::jsonb, null, 'image/png', 1000, 800, 600);
    raise exception 'FAIL A8: a missing file was registered';
  exception when no_data_found then null;
  end;
  begin
    perform public.register_media_asset(ws_a, path_b, null, '{}'::jsonb, null, 'image/png', 1000, 800, 600);
    raise exception 'FAIL A8b: B''s file was registered in A''s workspace';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, path_a, null, '{}'::jsonb, null, 'image/jpeg', 1000, 800, 600);
    raise exception 'FAIL A8c: a type that does not match the extension was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, path_a, null, '{}'::jsonb, null, 'image/png', 5000000, 800, 600);
    raise exception 'FAIL A8d: an oversized file was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, path_a, null, '{}'::jsonb, null, 'image/png', 1000, 9000, 600);
    raise exception 'FAIL A8e: huge dimensions were accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, path_a, null, '[]'::jsonb, null, 'image/png', 1000, 800, 600);
    raise exception 'FAIL A8f: a non-object attribution was accepted';
  exception when invalid_parameter_value then null;
  end;

  -- A9: alt text and credit can be edited; the file path cannot
  update public.media_assets set alt_text = 'New alt', attribution = '{"credit_text":"Edited"}'::jsonb where id = asset;
  begin
    update public.media_assets set storage_path = path_a2 where id = asset;
    raise exception 'FAIL A9: storage_path was changed from the browser';
  exception when insufficient_privilege then null;
  end;

  -- A10: attach to a post; deleting the library entry removes the link
  insert into public.content_items (workspace_id, language, body) values (ws_a, 'en', 'Post with image') returning id into item;
  insert into public.content_item_media (workspace_id, content_item_id, media_asset_id) values (ws_a, item, asset);
  delete from public.media_assets where id = asset;
  select count(*) into n from public.content_item_media where content_item_id = item;
  if n <> 0 then raise exception 'FAIL A10: the post kept a link to a deleted image'; end if;

  -- A11: usage types
  perform public.record_ai_usage(ws_a, 'image.search', 'pexels', 'search', 1);
  begin
    perform public.record_ai_usage(ws_a, 'foo.bar', 'x', 'y', 1);
    raise exception 'FAIL A11: an unknown usage prefix was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.record_ai_usage(ws_a, 'ai.generate_post', 'x', 'y', 1);
end $$;

-- ===== B: another workspace =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  path_a text := current_setting('test.ws_a') || '/11111111-1111-4111-8111-111111111111.png';
  n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'media' and name = path_a;
  if n <> 0 then raise exception 'FAIL B1: B can see A''s file'; end if;
  select count(*) into n from storage.objects where bucket_id = 'media';
  if n <> 1 then raise exception 'FAIL B1b: B sees % media files (expected only their own 1)', n; end if;
  begin
    perform public.register_media_asset(ws_a, path_a, null, '{}'::jsonb, null, 'image/png', 1000, 10, 10);
    raise exception 'FAIL B2: B registered a file in A''s workspace';
  exception when insufficient_privilege then null;
  end;
  if public.can_write_workspace(public.media_object_workspace(path_a)) then
    raise exception 'FAIL B3: B may remove A''s files';
  end if;
end $$;

-- ===== C: viewer in A's workspace (read-only) =====
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  path_a text := current_setting('test.ws_a') || '/11111111-1111-4111-8111-111111111111.png';
  n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'media' and name = path_a;
  if n <> 1 then raise exception 'FAIL C1: the viewer cannot read the workspace''s files'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('media', ws_a || '/66666666-6666-4666-8666-666666666666.png');
    raise exception 'FAIL C2: a viewer uploaded a file';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.register_media_asset(ws_a, path_a, null, '{}'::jsonb, null, 'image/png', 1000, 10, 10);
    raise exception 'FAIL C3: a viewer registered a file';
  exception when insufficient_privilege then null;
  end;
  if public.can_write_workspace(public.media_object_workspace(path_a)) then
    raise exception 'FAIL C4: a viewer may remove files';
  end if;
end $$;

-- ===== Signed out =====
reset role;
set local role anon;
do $$
declare
  n int := 0;
begin
  begin
    select count(*) into n from storage.objects where bucket_id = 'media';
  exception when insufficient_privilege then n := 0;
  end;
  if n <> 0 then raise exception 'FAIL D1: a signed-out visitor can see media files'; end if;
  begin
    perform public.register_media_asset(current_setting('test.ws_a')::uuid, 'x', null, '{}'::jsonb, null, 'image/png', 1, 1, 1);
    raise exception 'FAIL D2: anon could register media';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ===== Library size limit (owner fills the workspace, then A tries one more) =====
insert into public.media_assets (workspace_id, storage_path, mime_type, byte_size, width, height, processing_status)
select current_setting('test.ws_a')::uuid, null, 'image/png', 10, 10, 10, 'ready' from generate_series(1, 100);
insert into storage.objects (bucket_id, name)
values ('media', current_setting('test.ws_a') || '/77777777-7777-4777-8777-777777777777.png');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);

do $$
begin
  begin
    perform public.register_media_asset(
      current_setting('test.ws_a')::uuid,
      current_setting('test.ws_a') || '/77777777-7777-4777-8777-777777777777.png',
      null, '{}'::jsonb, null, 'image/png', 1000, 10, 10);
    raise exception 'FAIL L1: the library limit was not enforced';
  exception when configuration_limit_exceeded then null;
  end;
end $$;

reset role;
select 'ALL MEDIA TESTS PASSED' as result;

rollback;
