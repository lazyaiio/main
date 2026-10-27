-- Test for account deletion (database side).
-- HOW TO RUN: Supabase SQL Editor -> paste the whole file -> Run (DEV project, after 0001-0013).
-- Proves that deleting a sign-in account removes its workspace and EVERYTHING inside it (no leftovers, no
-- blocked deletes), and leaves other people's data alone. Rolled back at the end.
-- Success: a result row "ALL ACCOUNT DELETION TESTS PASSED".
-- (Image files in Storage are removed by the app before the account is deleted; they are not part of this test.)

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-a@example.test', '{"display_name":"Del A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-b@example.test', '{"display_name":"Del B"}', now(), now());

select set_config('test.ws_a', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a2'), true);
select set_config('test.ws_b', (select workspace_id::text from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b2'), true);

-- Fill workspace A with data in every kind of table.
do $$
declare
  ws uuid := current_setting('test.ws_a')::uuid;
  u uuid := '00000000-0000-0000-0000-0000000000a2';
  camp uuid;
  item uuid;
  media uuid;
  acct uuid;
  page uuid;
begin
  insert into public.content_projects (id, workspace_id, name, input_type, input_value, languages)
  values ('00000000-0000-0000-0000-00000000d1a1', ws, 'Project', 'topic', 'topic', array['en']);

  insert into public.campaigns (workspace_id, project_id, name, duration_days, requested_item_count, status, languages, approval_mode, generation_progress, brief)
  values (ws, '00000000-0000-0000-0000-00000000d1a1', 'Camp', 7, 1, 'draft', array['en'], 'manual', '{"total":1,"completed":0,"failed":0}', '{}')
  returning id into camp;
  insert into public.campaign_slots (workspace_id, campaign_id, slot_index, planned_at, language, content_format)
  values (ws, camp, 0, now() + interval '1 day', 'en', 'tip');

  insert into public.content_items (workspace_id, campaign_id, project_id, language, body, content_hash, approval_status)
  values (ws, camp, '00000000-0000-0000-0000-00000000d1a1', 'en', 'Body', 'hash-del-1', 'approved')
  returning id into item;

  insert into public.media_assets (workspace_id, mime_type, byte_size, width, height, processing_status)
  values (ws, 'image/png', 10, 10, 10, 'ready') returning id into media;
  insert into public.content_item_media (workspace_id, content_item_id, media_asset_id) values (ws, item, media);

  insert into public.social_accounts (workspace_id, provider_account_id) values (ws, 'del-fb-1') returning id into acct;
  insert into public.social_pages (workspace_id, social_account_id, provider_page_id, name, status, capabilities)
  values (ws, acct, 'del-page-1', 'Page', 'connected', '{"can_publish":true}') returning id into page;
  insert into public.social_page_tokens (social_page_id, workspace_id, token_ciphertext)
  values (page, ws, 'v1.aaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccc');
  insert into public.scheduled_posts (workspace_id, content_item_id, social_page_id, scheduled_at, status, idempotency_key, next_attempt_at)
  values (ws, item, page, now() + interval '1 day', 'scheduled', 'del-key-1', now() + interval '1 day');

  insert into public.usage_records (workspace_id, user_id, action_type, provider, model, units) values (ws, u, 'ai.generate_post', 'mock', 'mock', 1);
  insert into public.audit_events (workspace_id, actor_user_id, action, entity_type, entity_id, metadata) values (ws, u, 'test.action', 'test', gen_random_uuid(), '{}');
  insert into public.social_oauth_flows (workspace_id, user_id, state_hash, expires_at) values (ws, u, repeat('a', 64), now() + interval '10 minutes');
  insert into public.email_preferences (user_id, campaign_complete) values (u, false);
  insert into public.email_events (workspace_id, user_id, template, dedupe_key) values (ws, u, 'welcome', 'welcome:del-a');
end $$;

-- Workspace B has its own project that must survive.
insert into public.content_projects (workspace_id, name, input_type, input_value, languages)
values (current_setting('test.ws_b')::uuid, 'B project', 'topic', 'topic', array['en']);

-- Delete the account the way the app does: delete the sign-in user.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2';

do $$
declare
  ws uuid := current_setting('test.ws_a')::uuid;
  n int;
  t text;
begin
  if exists (select 1 from public.workspaces where id = ws) then raise exception 'FAIL 1: the workspace is still there after the account was deleted'; end if;
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') then raise exception 'FAIL 2: the profile is still there'; end if;

  foreach t in array array['content_projects', 'campaigns', 'campaign_slots', 'content_items', 'content_item_media', 'media_assets', 'social_accounts', 'social_pages', 'social_page_tokens', 'scheduled_posts', 'usage_records', 'audit_events', 'social_oauth_flows', 'workspace_members']
  loop
    execute format('select count(*) from public.%I where workspace_id = $1', t) into n using ws;
    if n <> 0 then raise exception 'FAIL 3: % rows are left in %', n, t; end if;
  end loop;

  if exists (select 1 from public.email_preferences where user_id = '00000000-0000-0000-0000-0000000000a2') then raise exception 'FAIL 4: email choices are left'; end if;
  -- The delivery log keeps no link to the person afterwards.
  if exists (select 1 from public.email_events where dedupe_key = 'welcome:del-a' and user_id is not null) then raise exception 'FAIL 5: the delivery log still points to the deleted person'; end if;

  -- Other people's data is untouched.
  if not exists (select 1 from public.workspaces where id = current_setting('test.ws_b')::uuid) then raise exception 'FAIL 6: another workspace was deleted'; end if;
  if (select count(*) from public.content_projects where workspace_id = current_setting('test.ws_b')::uuid) <> 1 then raise exception 'FAIL 7: another workspace lost data'; end if;
end $$;

select 'ALL ACCOUNT DELETION TESTS PASSED' as result;

rollback;
