-- LazyAI migration 0005: campaign planner (planned posts, resumable generation, trusted state changes).
-- Run once in the Supabase SQL Editor AFTER 0001-0004.
--
-- Design
--  * A campaign has one "slot" per planned post (date, language, format, optional angle).
--  * Slots are the work queue for bulk generation. Browsers can READ them but never write them.
--  * Every state change (create, start, pause, cancel, claim, complete, release, retry) goes through
--    a SECURITY DEFINER function that checks workspace membership and locks the campaign row,
--    so two open tabs can never generate the same slot twice.
--  * A slot that is claimed gets a lease. If the browser disappears, the lease expires and the slot
--    is handed out again (at most 3 attempts per slot).
--  * campaigns.status can no longer be changed directly by browsers (only through these functions).

-- ---------- Campaign brief (what the user asked for) ----------
alter table public.campaigns
  add column if not exists brief jsonb not null default '{}'::jsonb;

alter table public.campaigns
  drop constraint if exists campaigns_brief_is_object;
alter table public.campaigns
  add constraint campaigns_brief_is_object check (jsonb_typeof(brief) = 'object');

-- Browsers may no longer change a campaign's status directly.
revoke update (status) on public.campaigns from authenticated;

-- ---------- campaign_slots ----------
create table public.campaign_slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null,
  slot_index int not null check (slot_index between 0 and 89),
  planned_at timestamptz not null,
  language text not null check (language in ('en', 'bn')),
  content_format text not null check (char_length(content_format) between 1 and 40),
  theme text check (theme is null or char_length(theme) <= 200),
  status text not null default 'planned' check (status in ('planned', 'generating', 'done', 'failed', 'skipped')),
  attempts int not null default 0 check (attempts between 0 and 10),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z_]{1,40}$'),
  lease_expires_at timestamptz,
  content_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (campaign_id, slot_index),
  foreign key (workspace_id, campaign_id) references public.campaigns (workspace_id, id) on delete cascade,
  -- If the generated post is deleted, only the link is cleared (workspace_id stays).
  foreign key (workspace_id, content_item_id) references public.content_items (workspace_id, id)
    on delete set null (content_item_id)
);
create index campaign_slots_campaign_status_idx on public.campaign_slots (campaign_id, status, slot_index);

revoke all on public.campaign_slots from anon, authenticated;
grant select on public.campaign_slots to authenticated;
alter table public.campaign_slots enable row level security;
create policy "campaign slots: members read" on public.campaign_slots
  for select to authenticated using (public.can_read_workspace(workspace_id));

-- ---------- Internal helpers (not callable from browsers) ----------

-- Locks the campaign row and checks the caller may write in its workspace.
create or replace function public._campaign_lock(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  if auth.uid() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found or not public.can_write_workspace(c.workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return c;
end;
$$;

-- Recomputes progress and, when nothing is left to do, finishes a generating campaign.
create or replace function public._campaign_refresh(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_n int;
  done_n int;
  failed_n int;
  open_n int;
  current_status text;
begin
  select
    count(*) filter (where status <> 'skipped'),
    count(*) filter (where status = 'done'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status in ('planned', 'generating'))
  into total_n, done_n, failed_n, open_n
  from public.campaign_slots
  where campaign_id = p_campaign_id;

  update public.campaigns
  set generation_progress = jsonb_build_object('total', total_n, 'completed', done_n, 'failed', failed_n)
  where id = p_campaign_id;

  select status into current_status from public.campaigns where id = p_campaign_id;
  if current_status = 'generating' and open_n = 0 then
    update public.campaigns
    set status = case when done_n > 0 then 'ready' else 'failed' end
    where id = p_campaign_id;
  end if;
end;
$$;

revoke all on function public._campaign_lock(uuid), public._campaign_refresh(uuid) from public, anon, authenticated;

-- ---------- Create a campaign with its planned slots (one transaction) ----------
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
  if open_campaigns >= 10 then
    raise exception 'too many open campaigns' using errcode = '22023';
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

-- ---------- State changes ----------
create or replace function public.start_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  c := public._campaign_lock(p_campaign_id);
  if c.status not in ('draft', 'paused') then
    raise exception 'cannot start' using errcode = '22023';
  end if;
  update public.campaigns set status = 'generating' where id = p_campaign_id;
  perform public._campaign_refresh(p_campaign_id);
end;
$$;

create or replace function public.pause_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  c := public._campaign_lock(p_campaign_id);
  if c.status <> 'generating' then
    raise exception 'cannot pause' using errcode = '22023';
  end if;
  update public.campaigns set status = 'paused' where id = p_campaign_id;
end;
$$;

create or replace function public.cancel_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  c := public._campaign_lock(p_campaign_id);
  if c.status not in ('draft', 'generating', 'paused', 'ready', 'failed') then
    raise exception 'cannot cancel' using errcode = '22023';
  end if;
  update public.campaign_slots
  set status = 'skipped', lease_expires_at = null, updated_at = now()
  where campaign_id = p_campaign_id and status in ('planned', 'generating');
  update public.campaigns set status = 'cancelled' where id = p_campaign_id;
  perform public._campaign_refresh(p_campaign_id);
end;
$$;

-- Hands out up to p_limit planned slots (1 to 5) with a lease. Returns nothing unless generating.
create or replace function public.claim_campaign_slots(
  p_campaign_id uuid,
  p_limit int default 3,
  p_lease_seconds int default 90
)
returns setof public.campaign_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
  lim int := least(greatest(coalesce(p_limit, 1), 1), 5);
  lease int := least(greatest(coalesce(p_lease_seconds, 90), 30), 300);
  claimed_ids uuid[];
begin
  c := public._campaign_lock(p_campaign_id);
  if c.status <> 'generating' then
    return;
  end if;

  -- Slots whose lease ran out (browser closed, request timed out) go back to the queue,
  -- or fail for good after 3 attempts.
  update public.campaign_slots
  set status = case when attempts >= 3 then 'failed' else 'planned' end,
      last_error_code = case when attempts >= 3 then 'timeout' else last_error_code end,
      lease_expires_at = null,
      updated_at = now()
  where campaign_id = p_campaign_id and status = 'generating' and lease_expires_at < now();

  with picked as (
    select id
    from public.campaign_slots
    where campaign_id = p_campaign_id and status = 'planned'
    order by slot_index
    limit lim
    for update skip locked
  ),
  claimed_rows as (
    update public.campaign_slots s
    set status = 'generating',
        attempts = s.attempts + 1,
        lease_expires_at = now() + make_interval(secs => lease),
        updated_at = now()
    from picked
    where s.id = picked.id
    returning s.id
  )
  select array_agg(id) into claimed_ids from claimed_rows;

  perform public._campaign_refresh(p_campaign_id);

  return query
  select * from public.campaign_slots
  where id = any (coalesce(claimed_ids, array[]::uuid[]))
  order by slot_index;
end;
$$;

-- Marks a claimed slot as done and links the saved post. False when the slot is no longer active
-- (for example the campaign was canceled while the AI was writing).
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
  if auth.uid() is null then
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

-- Gives a claimed slot back: retry later (planned) or give up (failed). p_refund does not count the
-- attempt (used when the problem is not the slot's fault, such as a rate limit).
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
  if auth.uid() is null then
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

-- Puts failed slots back in the queue. Returns how many were reset.
create or replace function public.retry_failed_slots(p_campaign_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
  n int;
begin
  c := public._campaign_lock(p_campaign_id);
  if c.status not in ('ready', 'failed', 'paused') then
    raise exception 'cannot retry' using errcode = '22023';
  end if;

  update public.campaign_slots
  set status = 'planned', attempts = 0, last_error_code = null, lease_expires_at = null, updated_at = now()
  where campaign_id = p_campaign_id and status = 'failed';
  get diagnostics n = row_count;

  if n > 0 and c.status in ('ready', 'failed') then
    update public.campaigns set status = 'generating' where id = p_campaign_id;
  end if;
  perform public._campaign_refresh(p_campaign_id);
  return n;
end;
$$;

-- ---------- Privileges ----------
revoke all on function
  public.create_campaign_with_slots(uuid, uuid, text, int, text[], jsonb, jsonb),
  public.start_campaign(uuid),
  public.pause_campaign(uuid),
  public.cancel_campaign(uuid),
  public.claim_campaign_slots(uuid, int, int),
  public.complete_campaign_slot(uuid, uuid),
  public.release_campaign_slot(uuid, text, boolean, boolean),
  public.retry_failed_slots(uuid)
from public, anon;

grant execute on function
  public.create_campaign_with_slots(uuid, uuid, text, int, text[], jsonb, jsonb),
  public.start_campaign(uuid),
  public.pause_campaign(uuid),
  public.cancel_campaign(uuid),
  public.claim_campaign_slots(uuid, int, int),
  public.complete_campaign_slot(uuid, uuid),
  public.release_campaign_slot(uuid, text, boolean, boolean),
  public.retry_failed_slots(uuid)
to authenticated;
