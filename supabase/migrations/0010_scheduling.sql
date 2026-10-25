-- LazyAI migration 0010: scheduling and the publishing queue.
-- Run once in the Supabase SQL Editor AFTER 0001-0009.
--
-- Design
--  * Browsers can only READ scheduled_posts. Everything that changes them goes through SECURITY DEFINER
--    functions.
--  * People (owner/admin/editor) use: schedule_post, reschedule_post, cancel_scheduled_post,
--    retry_failed_post, mark_post_published_manually. Only APPROVED posts can be scheduled, only on
--    connected Pages where the person can post, and never in the past or more than a year ahead.
--  * The dispatcher (called by the protected cron endpoint with the service-role key) uses:
--    claim_due_posts, finish_post_published, finish_post_retry, finish_post_failed, release_post.
--    These cannot be called from a browser at all.
--  * Claiming is atomic (row locks, SKIP LOCKED): running the dispatcher twice at the same time can never
--    hand the same post to two workers.
--  * A post whose publish attempt started but never reported back (lease expired) is NEVER retried
--    automatically, because it may already be on Facebook. It is marked failed with "uncertain_result"
--    and a person decides ("it is on my Page" or "retry").
--  * Posts more than 6 hours late (for example after an outage) are not published silently:
--    they are marked failed with "missed_window" so a person can choose to retry.

-- One live entry per post and Page. Failed and canceled entries do not block a new one.
create unique index if not exists scheduled_posts_active_uniq
  on public.scheduled_posts (content_item_id, social_page_id)
  where status in ('scheduled', 'publishing', 'retrying', 'published');

-- ---------- People: schedule, change, cancel, retry ----------

create or replace function public.schedule_post(
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
  if auth.uid() is null or not public.can_write_workspace(p_workspace_id) then
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

create or replace function public._scheduled_post_lock(p_post_id uuid)
returns public.scheduled_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.scheduled_posts;
begin
  if auth.uid() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into sp from public.scheduled_posts where id = p_post_id for update;
  if not found or not public.can_write_workspace(sp.workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return sp;
end;
$$;
revoke all on function public._scheduled_post_lock(uuid) from public, anon, authenticated;

create or replace function public.reschedule_post(p_post_id uuid, p_scheduled_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.scheduled_posts;
begin
  sp := public._scheduled_post_lock(p_post_id);
  if sp.status not in ('scheduled', 'retrying', 'failed') then raise exception 'cannot change' using errcode = '22023'; end if;
  if p_scheduled_at is null or p_scheduled_at < now() + interval '1 minute' or p_scheduled_at > now() + interval '365 days' then
    raise exception 'invalid time' using errcode = '22023';
  end if;
  update public.scheduled_posts
  set status = 'scheduled', scheduled_at = p_scheduled_at, next_attempt_at = p_scheduled_at,
      attempt_count = 0, last_error = null, lease_expires_at = null, locked_at = null
  where id = p_post_id;
end;
$$;

create or replace function public.cancel_scheduled_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.scheduled_posts;
begin
  sp := public._scheduled_post_lock(p_post_id);
  if sp.status not in ('scheduled', 'retrying', 'failed') then raise exception 'cannot cancel' using errcode = '22023'; end if;
  update public.scheduled_posts
  set status = 'cancelled', next_attempt_at = null, lease_expires_at = null, locked_at = null
  where id = p_post_id;
end;
$$;

-- Failed -> try again now.
create or replace function public.retry_failed_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.scheduled_posts;
begin
  sp := public._scheduled_post_lock(p_post_id);
  if sp.status <> 'failed' then raise exception 'cannot retry' using errcode = '22023'; end if;
  update public.scheduled_posts
  set status = 'scheduled', next_attempt_at = now(), attempt_count = 0, last_error = null,
      lease_expires_at = null, locked_at = null
  where id = p_post_id;
end;
$$;

-- "It IS on my Page": the person checked after an uncertain result.
create or replace function public.mark_post_published_manually(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.scheduled_posts;
begin
  sp := public._scheduled_post_lock(p_post_id);
  if sp.status <> 'failed' or sp.last_error is distinct from 'uncertain_result' then
    raise exception 'cannot mark' using errcode = '22023';
  end if;
  update public.scheduled_posts
  set status = 'published', published_at = now(), next_attempt_at = null, last_error = null
  where id = p_post_id;
end;
$$;

-- ---------- Dispatcher (service role only) ----------

create or replace function public.claim_due_posts(p_limit int default 5, p_lease_seconds int default 120)
returns setof public.scheduled_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(p_limit, 1), 1), 10);
  lease int := least(greatest(coalesce(p_lease_seconds, 120), 30), 600);
  claimed_ids uuid[];
begin
  -- An attempt that never reported back may already be on Facebook: never retry it automatically.
  update public.scheduled_posts
  set status = 'failed', last_error = 'uncertain_result', lease_expires_at = null, locked_at = null
  where status = 'publishing' and lease_expires_at < now();

  -- Do not publish old posts silently after an outage.
  update public.scheduled_posts
  set status = 'failed', last_error = 'missed_window', next_attempt_at = null
  where status = 'scheduled' and scheduled_at < now() - interval '6 hours';

  with picked as (
    select id
    from public.scheduled_posts
    where status in ('scheduled', 'retrying') and coalesce(next_attempt_at, scheduled_at) <= now()
    order by coalesce(next_attempt_at, scheduled_at)
    limit lim
    for update skip locked
  ),
  claimed as (
    update public.scheduled_posts s
    set status = 'publishing', attempt_count = s.attempt_count + 1, locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease)
    from picked
    where s.id = picked.id
    returning s.id
  )
  select array_agg(id) into claimed_ids from claimed;

  return query
  select * from public.scheduled_posts where id = any (coalesce(claimed_ids, array[]::uuid[])) order by scheduled_at;
end;
$$;

create or replace function public.finish_post_published(p_post_id uuid, p_provider_post_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.scheduled_posts
  set status = 'published', provider_post_id = left(p_provider_post_id, 200), published_at = now(),
      next_attempt_at = null, last_error = null, lease_expires_at = null, locked_at = null
  where id = p_post_id and status = 'publishing';
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Temporary problem: try again later, up to p_max_attempts, then give up.
create or replace function public.finish_post_retry(p_post_id uuid, p_error text, p_delay_seconds int, p_max_attempts int default 5)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.scheduled_posts;
  new_status text;
begin
  if p_error is null or p_error !~ '^[a-z_]{1,40}$' then raise exception 'invalid error code' using errcode = '22023'; end if;
  select * into sp from public.scheduled_posts where id = p_post_id and status = 'publishing' for update;
  if not found then return 'ignored'; end if;
  new_status := case when sp.attempt_count >= least(greatest(coalesce(p_max_attempts, 5), 1), 20) then 'failed' else 'retrying' end;
  update public.scheduled_posts
  set status = new_status, last_error = p_error,
      next_attempt_at = case when new_status = 'retrying' then now() + make_interval(secs => least(greatest(coalesce(p_delay_seconds, 60), 30), 86400)) else null end,
      lease_expires_at = null, locked_at = null
  where id = p_post_id;
  return new_status;
end;
$$;

create or replace function public.finish_post_failed(p_post_id uuid, p_error text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_error is null or p_error !~ '^[a-z_]{1,40}$' then raise exception 'invalid error code' using errcode = '22023'; end if;
  update public.scheduled_posts
  set status = 'failed', last_error = p_error, next_attempt_at = null, lease_expires_at = null, locked_at = null
  where id = p_post_id and status = 'publishing';
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Hands a claimed post back untouched (the dispatcher ran out of time). The attempt does not count.
create or replace function public.release_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.scheduled_posts
  set status = 'scheduled', attempt_count = greatest(attempt_count - 1, 0), next_attempt_at = now(),
      lease_expires_at = null, locked_at = null
  where id = p_post_id and status = 'publishing';
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- ---------- Privileges ----------
revoke all on function
  public.schedule_post(uuid, uuid, uuid, timestamptz),
  public.reschedule_post(uuid, timestamptz),
  public.cancel_scheduled_post(uuid),
  public.retry_failed_post(uuid),
  public.mark_post_published_manually(uuid),
  public.claim_due_posts(int, int),
  public.finish_post_published(uuid, text),
  public.finish_post_retry(uuid, text, int, int),
  public.finish_post_failed(uuid, text),
  public.release_post(uuid)
from public, anon, authenticated;

grant execute on function
  public.schedule_post(uuid, uuid, uuid, timestamptz),
  public.reschedule_post(uuid, timestamptz),
  public.cancel_scheduled_post(uuid),
  public.retry_failed_post(uuid),
  public.mark_post_published_manually(uuid)
to authenticated;

grant execute on function
  public.claim_due_posts(int, int),
  public.finish_post_published(uuid, text),
  public.finish_post_retry(uuid, text, int, int),
  public.finish_post_failed(uuid, text),
  public.release_post(uuid)
to service_role;
