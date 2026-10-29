-- LazyAI migration 0014: background post writing, automatic scheduling and images, simpler post status.
-- Run once in the Supabase SQL Editor AFTER 0001-0013.
--
--  1. Background writing. Until now a campaign was written only while its page was open in a browser, because
--     every database function insisted on a signed-in person. The scheduler (the same every-minute call that
--     publishes posts) now keeps writing campaigns on its own. It uses the service-role key, so the campaign
--     functions below also accept the service role. People are checked exactly as before.
--  2. system_schedule_post(): lets the background writer schedule a finished post on the Page chosen for the
--     campaign. Service role only.
--  3. system_register_media_asset(): lets the background writer save an automatically chosen stock photo into the
--     media library, with the same checks and plan limits as an upload. Service role only.
--  4. Simpler posts. The review / approve / reject steps are gone. Every post is simply ready to schedule.
--     Existing posts that were drafts, waiting for review, or rejected become ready. Canceled posts stay canceled.
--     (The column keeps its old name, approval_status, and the value 'approved' now means "ready".)

-- ---------- 1. Is the caller the service role? ----------
create or replace function public._is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) = 'service_role'
$$;

revoke all on function public._is_service_role() from public, anon, authenticated;
grant execute on function public._is_service_role() to service_role;

-- ---------- 2. Campaign functions accept the service role ----------
create or replace function public._campaign_lock(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  if auth.uid() is null and not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- People must be allowed to write in the workspace. The service role (the background writer) is trusted.
  if auth.uid() is not null and not public.can_write_workspace(c.workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return c;
end;
$$;

revoke all on function public._campaign_lock(uuid) from public, anon, authenticated;

create or replace function public.complete_campaign_slot(p_slot_id uuid, p_content_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.campaign_slots;
  c public.campaigns;
begin
  if auth.uid() is null and not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into s from public.campaign_slots where id = p_slot_id;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  c := public._campaign_lock(s.campaign_id);
  select * into s from public.campaign_slots where id = p_slot_id for update;

  if s.status <> 'generating' or c.status not in ('generating', 'paused') then
    return false;
  end if;
  if not exists (
    select 1 from public.content_items
    where id = p_content_item_id and workspace_id = s.workspace_id and campaign_id = s.campaign_id
  ) then
    raise exception 'invalid post' using errcode = '22023';
  end if;

  update public.campaign_slots
  set status = 'done', content_item_id = p_content_item_id, last_error_code = null,
      lease_expires_at = null, updated_at = now()
  where id = p_slot_id;
  perform public._campaign_refresh(s.campaign_id);
  return true;
end;
$$;

create or replace function public.release_campaign_slot(
  p_slot_id uuid,
  p_error_code text,
  p_retry boolean default true,
  p_refund boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.campaign_slots;
  c public.campaigns;
  new_attempts int;
begin
  if auth.uid() is null and not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_error_code is null or p_error_code !~ '^[a-z_]{1,40}$' then
    raise exception 'invalid error code' using errcode = '22023';
  end if;
  select * into s from public.campaign_slots where id = p_slot_id;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  c := public._campaign_lock(s.campaign_id);
  select * into s from public.campaign_slots where id = p_slot_id for update;
  if s.status <> 'generating' then
    return;
  end if;

  new_attempts := case when coalesce(p_refund, false) then greatest(s.attempts - 1, 0) else s.attempts end;
  update public.campaign_slots
  set attempts = new_attempts,
      status = case when coalesce(p_retry, true) and new_attempts < 3 then 'planned' else 'failed' end,
      last_error_code = p_error_code,
      lease_expires_at = null,
      updated_at = now()
  where id = p_slot_id;
  perform public._campaign_refresh(s.campaign_id);
end;
$$;

-- The background writer needs to know which AI providers are on.
create or replace function public.get_enabled_ai_providers()
returns table (provider text, model text, priority int)
language sql
stable
security definer
set search_path = public
as $$
  select s.provider, s.model, s.priority
  from public.ai_provider_settings s
  where s.enabled and (auth.uid() is not null or public._is_service_role())
  order by s.priority, s.provider;
$$;

grant execute on function
  public.claim_campaign_slots(uuid, int, int),
  public.complete_campaign_slot(uuid, uuid),
  public.release_campaign_slot(uuid, text, boolean, boolean),
  public.pause_campaign(uuid),
  public.get_enabled_ai_providers()
to service_role;

-- ---------- 3. Background scheduling of a finished post ----------
create or replace function public.system_schedule_post(
  p_workspace_id uuid,
  p_content_item_id uuid,
  p_social_page_id uuid,
  p_scheduled_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item_status text;
  page_status text;
  can_post boolean;
  new_id uuid;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_scheduled_at is null or p_scheduled_at < now() + interval '1 minute' or p_scheduled_at > now() + interval '365 days' then
    raise exception 'invalid time' using errcode = '22023';
  end if;

  select approval_status into item_status
  from public.content_items where id = p_content_item_id and workspace_id = p_workspace_id;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if item_status <> 'approved' then raise exception 'not approved' using errcode = '22023'; end if;

  select status, coalesce((capabilities ->> 'can_publish')::boolean, false) into page_status, can_post
  from public.social_pages where id = p_social_page_id and workspace_id = p_workspace_id;
  if not found then raise exception 'page not found' using errcode = 'P0002'; end if;
  if page_status <> 'connected' then raise exception 'page not connected' using errcode = '22023'; end if;
  if not can_post then raise exception 'cannot publish' using errcode = '22023'; end if;

  insert into public.scheduled_posts (workspace_id, content_item_id, social_page_id, scheduled_at, status, idempotency_key, next_attempt_at)
  values (p_workspace_id, p_content_item_id, p_social_page_id, p_scheduled_at, 'scheduled', gen_random_uuid()::text, p_scheduled_at)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.system_schedule_post(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.system_schedule_post(uuid, uuid, uuid, timestamptz) to service_role;

-- ---------- 4. Background saving of an automatically chosen stock photo ----------
create or replace function public.system_register_media_asset(
  p_workspace_id uuid,
  p_storage_path text,
  p_thumb_path text,
  p_source_url text,
  p_attribution jsonb,
  p_alt_text text,
  p_mime_type text,
  p_byte_size bigint,
  p_width int,
  p_height int,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  file_count int;
  total_bytes bigint;
  ext text;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if public.media_object_workspace(p_storage_path) is distinct from p_workspace_id then
    raise exception 'invalid path' using errcode = '22023';
  end if;

  ext := lower(substring(p_storage_path from '\.([a-z]+)$'));
  if not (
    (p_mime_type = 'image/jpeg' and ext = 'jpg') or
    (p_mime_type = 'image/png' and ext = 'png') or
    (p_mime_type = 'image/webp' and ext = 'webp') or
    (p_mime_type = 'image/gif' and ext = 'gif')
  ) then
    raise exception 'invalid type' using errcode = '22023';
  end if;
  if p_byte_size is null or p_byte_size not between 1 and 4194304 then
    raise exception 'invalid size' using errcode = '22023';
  end if;
  if p_width is null or p_height is null or p_width not between 1 and 8000 or p_height not between 1 and 8000 then
    raise exception 'invalid dimensions' using errcode = '22023';
  end if;
  if p_alt_text is not null and char_length(p_alt_text) > 500 then
    raise exception 'invalid alt text' using errcode = '22023';
  end if;
  if p_source_url is not null and char_length(p_source_url) > 2000 then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_attribution is null or jsonb_typeof(p_attribution) <> 'object' or pg_column_size(p_attribution) > 4096 then
    raise exception 'invalid attribution' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'media' and name = p_storage_path) then
    raise exception 'file not found' using errcode = 'P0002';
  end if;
  if p_thumb_path is not null and (
    public.media_object_workspace(p_thumb_path) is distinct from p_workspace_id
    or p_thumb_path not like '%.webp'
    or p_thumb_path = p_storage_path
    or not exists (select 1 from storage.objects where bucket_id = 'media' and name = p_thumb_path)
  ) then
    raise exception 'invalid thumbnail' using errcode = '22023';
  end if;

  select count(*), coalesce(sum(byte_size), 0) into file_count, total_bytes
  from public.media_assets where workspace_id = p_workspace_id;
  if file_count >= coalesce(public.workspace_limit(p_workspace_id, 'media_files'), 2147483647)
     or total_bytes + p_byte_size > coalesce(public.workspace_limit(p_workspace_id, 'media_bytes'), 9223372036854775807) then
    raise exception 'library full' using errcode = '53400';
  end if;

  insert into public.media_assets (
    workspace_id, storage_path, thumb_path, source_url, attribution, alt_text, mime_type, byte_size, width, height,
    processing_status, created_by
  )
  values (
    p_workspace_id, p_storage_path, p_thumb_path, p_source_url, p_attribution, nullif(btrim(coalesce(p_alt_text, '')), ''),
    p_mime_type, p_byte_size, p_width, p_height, 'ready', p_created_by
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.system_register_media_asset(uuid, text, text, text, jsonb, text, text, bigint, int, int, uuid) from public, anon, authenticated;
grant execute on function public.system_register_media_asset(uuid, text, text, text, jsonb, text, text, bigint, int, int, uuid) to service_role;

-- ---------- 5. Simpler posts: no review step ----------
alter table public.content_items alter column approval_status set default 'approved';

update public.content_items
set approval_status = 'approved'
where approval_status in ('draft', 'awaiting_approval', 'rejected');
