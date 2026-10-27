-- LazyAI migration 0013: plans, usage limits enforced in the database, and a request rate limiter.
-- Run once in the Supabase SQL Editor AFTER 0001-0012.
--
--  * plans: named bundles of limits (free, standard). Each workspace has a plan, and an admin can give one
--    workspace different numbers (limit_overrides). Limits live in the database, not in the screens.
--  * Limits are enforced where they cannot be bypassed: database triggers and functions. A browser that
--    calls the API directly hits the same wall as the app does.
--      content_items, social_pages  -> triggers on insert
--      media files and bytes        -> register_media_asset (reads the plan)
--      open campaigns               -> create_campaign_with_slots (reads the plan)
--    AI generations per month are checked by the server before every generation.
--  * workspace_limits() and workspace_usage() let members see their plan and usage.
--  * rate_limit_hit(): a small fixed-window counter per person and action for expensive actions.
--  * set_workspace_plan(): platform admins only.

create table public.plans (
  key text primary key check (key ~ '^[a-z0-9_]{2,30}$'),
  name text not null check (char_length(name) between 1 and 60),
  limits jsonb not null check (jsonb_typeof(limits) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to authenticated;
create policy "plans: signed-in users read" on public.plans for select to authenticated using (true);

insert into public.plans (key, name, limits) values
  ('free', 'Free', '{"ai_generations_month": 100, "content_items": 500, "social_pages": 3, "media_files": 100, "media_bytes": 209715200, "campaigns_open": 10}'),
  ('standard', 'Standard', '{"ai_generations_month": 1000, "content_items": 5000, "social_pages": 10, "media_files": 1000, "media_bytes": 2147483648, "campaigns_open": 50}');

alter table public.workspaces
  add column plan text not null default 'free' references public.plans (key),
  add column limit_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(limit_overrides) = 'object');
-- (workspaces only allows browsers to update name and timezone, so plan and overrides stay admin-controlled.)

-- ---------- Reading limits and usage ----------

create or replace function public.workspace_limit(p_workspace_id uuid, p_key text)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w record;
  v text;
begin
  select plan, limit_overrides into w from public.workspaces where id = p_workspace_id;
  if not found then return null; end if;
  v := w.limit_overrides ->> p_key;
  if v is null then select limits ->> p_key into v from public.plans where key = w.plan; end if;
  if v is null then select limits ->> p_key into v from public.plans where key = 'free'; end if;
  return v::bigint;
end;
$$;

create or replace function public.workspace_limits(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  k text;
  result jsonb := '{}'::jsonb;
  plan_key text;
begin
  if auth.uid() is null or not public.can_read_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select plan into plan_key from public.workspaces where id = p_workspace_id;
  foreach k in array array['ai_generations_month', 'content_items', 'social_pages', 'media_files', 'media_bytes', 'campaigns_open'] loop
    result := result || jsonb_build_object(k, public.workspace_limit(p_workspace_id, k));
  end loop;
  return jsonb_build_object('plan', plan_key, 'limits', result);
end;
$$;

create or replace function public.workspace_usage(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_read_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'ai_generations_month', (select count(*) from public.usage_records where workspace_id = p_workspace_id and action_type like 'ai.%' and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'),
    'content_items', (select count(*) from public.content_items where workspace_id = p_workspace_id),
    'social_pages', (select count(*) from public.social_pages where workspace_id = p_workspace_id and status <> 'disconnected'),
    'media_files', (select count(*) from public.media_assets where workspace_id = p_workspace_id),
    'media_bytes', (select coalesce(sum(byte_size), 0) from public.media_assets where workspace_id = p_workspace_id),
    'campaigns_open', (select count(*) from public.campaigns where workspace_id = p_workspace_id and status in ('draft', 'generating', 'paused'))
  );
end;
$$;

-- ---------- Enforcement that direct API calls cannot skip ----------

create or replace function public._enforce_content_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap bigint := public.workspace_limit(new.workspace_id, 'content_items');
begin
  if cap is not null and (select count(*) from public.content_items where workspace_id = new.workspace_id) >= cap then
    raise exception 'limit reached: content_items' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger content_items_plan_limit before insert on public.content_items
  for each row execute function public._enforce_content_item_limit();

create or replace function public._enforce_social_page_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap bigint := public.workspace_limit(new.workspace_id, 'social_pages');
begin
  if cap is not null and new.status <> 'disconnected'
     and (select count(*) from public.social_pages where workspace_id = new.workspace_id and status <> 'disconnected') >= cap then
    raise exception 'limit reached: social_pages' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger social_pages_plan_limit before insert on public.social_pages
  for each row execute function public._enforce_social_page_limit();

revoke all on function public._enforce_content_item_limit(), public._enforce_social_page_limit() from public, anon, authenticated;
revoke all on function public.workspace_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.workspace_limit(uuid, text) to service_role;
revoke all on function public.workspace_limits(uuid), public.workspace_usage(uuid) from public, anon;
grant execute on function public.workspace_limits(uuid), public.workspace_usage(uuid) to authenticated, service_role;

-- Media and campaign functions now read the plan (same behavior, numbers come from the plan).
create or replace function public.create_campaign_with_slots(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_duration_days int,
  p_languages text[],
  p_brief jsonb,
  p_slots jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  project_languages text[];
  slot_count int;
  new_id uuid;
  open_campaigns int;
  bad_slots int;
begin
  if auth.uid() is null or not public.can_write_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select languages into project_languages
  from public.content_projects
  where id = p_project_id and workspace_id = p_workspace_id and status = 'active';
  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_duration_days is null or p_duration_days not between 1 and 90 then
    raise exception 'invalid duration' using errcode = '22023';
  end if;
  if p_languages is null or cardinality(p_languages) not between 1 and 2
     or not (p_languages <@ project_languages) then
    raise exception 'invalid languages' using errcode = '22023';
  end if;
  if p_brief is null or jsonb_typeof(p_brief) <> 'object' or pg_column_size(p_brief) > 8192 then
    raise exception 'invalid brief' using errcode = '22023';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'invalid slots' using errcode = '22023';
  end if;

  slot_count := jsonb_array_length(p_slots);
  if slot_count not between 1 and 90 then
    raise exception 'invalid slot count' using errcode = '22023';
  end if;

  -- Every slot needs a sensible date, one of the campaign languages, and a format.
  select count(*) into bad_slots
  from jsonb_array_elements(p_slots) as s
  where jsonb_typeof(s) <> 'object'
     or (s ->> 'planned_at') is null
     or (s ->> 'language') is null
     or not ((s ->> 'language') = any (p_languages))
     or (s ->> 'content_format') is null
     or char_length(s ->> 'content_format') not between 1 and 40
     or char_length(coalesce(s ->> 'theme', '')) > 200
     or ((s ->> 'planned_at')::timestamptz) < now() - interval '2 days'
     or ((s ->> 'planned_at')::timestamptz) > now() + interval '2 years';
  if bad_slots > 0 then
    raise exception 'invalid slot' using errcode = '22023';
  end if;

  select count(*) into open_campaigns
  from public.campaigns
  where workspace_id = p_workspace_id and status in ('draft', 'generating', 'paused');
  if open_campaigns >= coalesce(public.workspace_limit(p_workspace_id, 'campaigns_open'), 2147483647) then
    raise exception 'limit reached: campaigns' using errcode = '53400';
  end if;

  insert into public.campaigns (
    workspace_id, project_id, name, duration_days, requested_item_count, status,
    languages, approval_mode, generation_progress, brief, created_by
  )
  values (
    p_workspace_id, p_project_id, btrim(p_name), p_duration_days, slot_count, 'draft',
    p_languages, 'manual',
    jsonb_build_object('total', slot_count, 'completed', 0, 'failed', 0),
    p_brief, auth.uid()
  )
  returning id into new_id;

  insert into public.campaign_slots (workspace_id, campaign_id, slot_index, planned_at, language, content_format, theme)
  select
    p_workspace_id,
    new_id,
    (ordinality - 1)::int,
    (s ->> 'planned_at')::timestamptz,
    s ->> 'language',
    s ->> 'content_format',
    nullif(btrim(coalesce(s ->> 'theme', '')), '')
  from jsonb_array_elements(p_slots) with ordinality as t(s, ordinality);

  return new_id;
end;
$$;

create or replace function public.register_media_asset(
  p_workspace_id uuid,
  p_storage_path text,
  p_source_url text,
  p_attribution jsonb,
  p_alt_text text,
  p_mime_type text,
  p_byte_size bigint,
  p_width int,
  p_height int
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
  if auth.uid() is null or not public.can_write_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- The path must be a valid media path inside THIS workspace's folder.
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

  -- The file must really exist in the media bucket.
  if not exists (select 1 from storage.objects where bucket_id = 'media' and name = p_storage_path) then
    raise exception 'file not found' using errcode = 'P0002';
  end if;

  -- Plan guard: file count and total size come from the workspace's plan (see workspace_limit).
  select count(*), coalesce(sum(byte_size), 0) into file_count, total_bytes
  from public.media_assets where workspace_id = p_workspace_id;
  if file_count >= coalesce(public.workspace_limit(p_workspace_id, 'media_files'), 2147483647)
     or total_bytes + p_byte_size > coalesce(public.workspace_limit(p_workspace_id, 'media_bytes'), 9223372036854775807) then
    raise exception 'library full' using errcode = '53400';
  end if;

  insert into public.media_assets (
    workspace_id, storage_path, source_url, attribution, alt_text, mime_type, byte_size, width, height,
    processing_status, created_by
  )
  values (
    p_workspace_id, p_storage_path, p_source_url, p_attribution, nullif(btrim(coalesce(p_alt_text, '')), ''),
    p_mime_type, p_byte_size, p_width, p_height, 'ready', auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------- Admin: change a workspace's plan or limits ----------

create or replace function public.set_workspace_plan(p_workspace_id uuid, p_plan text, p_overrides jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plans where key = p_plan) then
    raise exception 'unknown plan' using errcode = '22023';
  end if;
  if p_overrides is null or jsonb_typeof(p_overrides) <> 'object' then
    raise exception 'invalid overrides' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_overrides) loop
    if k not in ('ai_generations_month', 'content_items', 'social_pages', 'media_files', 'media_bytes', 'campaigns_open')
       or jsonb_typeof(p_overrides -> k) <> 'number' or (p_overrides ->> k)::numeric < 0 then
      raise exception 'invalid override' using errcode = '22023';
    end if;
  end loop;
  update public.workspaces set plan = p_plan, limit_overrides = p_overrides where id = p_workspace_id;
  if not found then raise exception 'workspace not found' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.set_workspace_plan(uuid, text, jsonb) from public, anon;
grant execute on function public.set_workspace_plan(uuid, text, jsonb) to authenticated;

-- ---------- Request rate limiter (per person and action) ----------

create table public.rate_limits (
  key text not null check (char_length(key) between 3 and 120),
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one attempt for the signed-in person. Returns true while they are within the limit.
create or replace function public.rate_limit_hit(p_action text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  w timestamptz;
  h int;
begin
  if auth.uid() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action is null or p_action !~ '^[a-z_]{1,40}$' or p_limit not between 1 and 100000 or p_window_seconds not between 10 and 86400 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  k := p_action || ':' || auth.uid()::text;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, hits) values (k, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into h;
  -- Housekeeping: forget old windows.
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return h <= p_limit;
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon;
grant execute on function public.rate_limit_hit(text, int, int) to authenticated;
