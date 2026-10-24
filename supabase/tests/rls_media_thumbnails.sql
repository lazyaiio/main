-- Test for migration 0007 (media thumbnails).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0007).
-- Rolled back at the end. Success: a result row "ALL THUMBNAIL TESTS PASSED".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'thumb-a@example.test', '{"display_name":"Thumb A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'thumb-b@example.test', '{"display_name":"Thumb B"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'thumb-c@example.test', '{"display_name":"Thumb C"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a7'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b7'), true);
insert into public.workspace_members (workspace_id, user_id, role)
values (current_setting('test.ws_a')::uuid, '00000000-0000-0000-0000-0000000000c7', 'viewer');

-- Files (owner setup): two originals and thumbnails in A's folder, one thumbnail in B's folder.
insert into storage.objects (bucket_id, name) values
  ('media', current_setting('test.ws_a') || '/a1111111-1111-4111-8111-111111111111.jpg'),
  ('media', current_setting('test.ws_a') || '/a1111111-1111-4111-8111-1111111111aa.webp'),
  ('media', current_setting('test.ws_a') || '/a2222222-2222-4222-8222-222222222222.png'),
  ('media', current_setting('test.ws_a') || '/a2222222-2222-4222-8222-2222222222aa.webp'),
  ('media', current_setting('test.ws_a') || '/a3333333-3333-4333-8333-333333333333.jpg'),
  ('media', current_setting('test.ws_a') || '/a3333333-3333-4333-8333-3333333333aa.png'),
  ('media', current_setting('test.ws_b') || '/b1111111-1111-4111-8111-1111111111aa.webp');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);

do $$
declare
  ws_a uuid := current_setting('test.ws_a')::uuid;
  p1 text := current_setting('test.ws_a') || '/a1111111-1111-4111-8111-111111111111.jpg';
  t1 text := current_setting('test.ws_a') || '/a1111111-1111-4111-8111-1111111111aa.webp';
  p2 text := current_setting('test.ws_a') || '/a2222222-2222-4222-8222-222222222222.png';
  t2 text := current_setting('test.ws_a') || '/a2222222-2222-4222-8222-2222222222aa.webp';
  p3 text := current_setting('test.ws_a') || '/a3333333-3333-4333-8333-333333333333.jpg';
  t3_png text := current_setting('test.ws_a') || '/a3333333-3333-4333-8333-3333333333aa.png';
  tb text := current_setting('test.ws_b') || '/b1111111-1111-4111-8111-1111111111aa.webp';
  asset uuid;
  old_asset uuid;
begin
  -- T1: register with a thumbnail
  asset := public.register_media_asset(ws_a, p1, null, '{}'::jsonb, 'Alt', 'image/jpeg', 5000, 800, 600, t1);
  if (select thumb_path from public.media_assets where id = asset) is distinct from t1 then
    raise exception 'FAIL T1: the thumbnail path was not stored';
  end if;

  -- T2: the thumbnail rules
  begin
    perform public.register_media_asset(ws_a, p3, null, '{}'::jsonb, null, 'image/jpeg', 5000, 800, 600, t3_png);
    raise exception 'FAIL T2: a non-WebP thumbnail was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, p3, null, '{}'::jsonb, null, 'image/jpeg', 5000, 800, 600, tb);
    raise exception 'FAIL T3: a thumbnail from another workspace was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, p3, null, '{}'::jsonb, null, 'image/jpeg', 5000, 800, 600, current_setting('test.ws_a') || '/a9999999-9999-4999-8999-999999999999.webp');
    raise exception 'FAIL T4: a missing thumbnail file was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_media_asset(ws_a, p3, null, '{}'::jsonb, null, 'image/jpeg', 5000, 800, 600, t1);
    raise exception 'FAIL T5: one thumbnail file was used twice';
  exception when unique_violation then null;
  end;

  -- T6: the original form still works and creates an image without a thumbnail
  old_asset := public.register_media_asset(ws_a, p2, null, '{}'::jsonb, null, 'image/png', 5000, 800, 600);
  if (select thumb_path from public.media_assets where id = old_asset) is not null then
    raise exception 'FAIL T6: an old-style image has a thumbnail';
  end if;

  -- T7: add a thumbnail to the older image, but only once and only valid ones
  begin
    perform public.set_media_thumbnail(old_asset, tb);
    raise exception 'FAIL T7: a thumbnail from another workspace was added';
  exception when invalid_parameter_value then null;
  end;
  perform public.set_media_thumbnail(old_asset, t2);
  if (select thumb_path from public.media_assets where id = old_asset) is distinct from t2 then
    raise exception 'FAIL T7b: the thumbnail was not set';
  end if;
  perform public.set_media_thumbnail(old_asset, t1); -- ignored: already has one
  if (select thumb_path from public.media_assets where id = old_asset) is distinct from t2 then
    raise exception 'FAIL T7c: an existing thumbnail was replaced';
  end if;

  -- T8: browsers cannot change thumb_path directly
  begin
    update public.media_assets set thumb_path = t1 where id = old_asset;
    raise exception 'FAIL T8: thumb_path was changed from the browser';
  exception when insufficient_privilege then null;
  end;

  perform set_config('test.asset_a', asset::text, true);
end $$;

-- B cannot touch A's images
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.set_media_thumbnail(current_setting('test.asset_a')::uuid, current_setting('test.ws_b') || '/b1111111-1111-4111-8111-1111111111aa.webp');
    raise exception 'FAIL B1: B changed A''s image';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A viewer cannot add thumbnails
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c7', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.set_media_thumbnail(current_setting('test.asset_a')::uuid, current_setting('test.ws_a') || '/a1111111-1111-4111-8111-1111111111aa.webp');
    raise exception 'FAIL C1: a viewer changed an image';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'ALL THUMBNAIL TESTS PASSED' as result;

rollback;
