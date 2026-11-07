-- LazyAI migration 0024: admin user management (search, suspend and restore) and the new email names.
-- Run once in the Supabase SQL Editor AFTER 0001-0023.
--
--  * account_suspensions: one row per suspended person. A suspended account can still sign in to look around
--    (unless the server also blocks sign-in) but cannot create or change anything: can_write_workspace()
--    now also requires "not suspended". Browsers may only learn whether THEY are suspended, never why.
--  * admin_list_users(): service role only. Searches people by email or name and returns their plan,
--    verification and suspension state in one call (auth.users cannot be read from the browser).
--  * email_events: the log now knows the payment receipt, plan ending soon and plan ended emails
--    (and the support reply, which was missing from the list).

create table if not exists public.account_suspensions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users (id) on delete set null
);

alter table public.account_suspensions enable row level security;
revoke all on public.account_suspensions from anon, authenticated;
grant select (user_id, suspended_at) on public.account_suspensions to authenticated;
create policy "account suspensions: read own" on public.account_suspensions for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.account_suspensions where user_id = auth.uid())
$$;

revoke all on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

-- Writing needs a verified email, no suspension, and a writing role.
create or replace function public.can_write_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_email_verified()
     and not public.is_suspended()
     and public.has_workspace_role(ws, array['owner','admin','editor']::public.workspace_role[]);
$$;

-- ---------- Admin: find people ----------
create or replace function public.admin_list_users(p_search text default null, p_limit int default 25, p_offset int default 0)
returns table (
  out_user_id uuid,
  out_email text,
  out_display_name text,
  out_created_at timestamptz,
  out_last_sign_in_at timestamptz,
  out_email_verified boolean,
  out_suspended boolean,
  out_workspace_id uuid,
  out_workspace_name text,
  out_plan text,
  out_plan_period text,
  out_plan_expires_at timestamptz,
  out_total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  term text;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  term := nullif(btrim(coalesce(p_search, '')), '');
  if term is not null then
    term := '%' || replace(replace(replace(left(term, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.display_name, '')::text,
    u.created_at,
    u.last_sign_in_at,
    (v.verified_at is not null),
    (s.user_id is not null),
    w.id,
    w.name::text,
    w.plan::text,
    w.plan_period::text,
    w.plan_expires_at,
    count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_email_verification v on v.user_id = u.id
  left join public.account_suspensions s on s.user_id = u.id
  left join lateral (
    select ww.id, ww.name, ww.plan, ww.plan_period, ww.plan_expires_at
    from public.workspaces ww where ww.owner_id = u.id order by ww.created_at asc limit 1
  ) w on true
  where term is null
     or u.email ilike term escape '\'
     or coalesce(p.display_name, '') ilike term escape '\'
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 50))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.admin_list_users(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, int, int) to service_role;

-- ---------- The email log knows the new emails ----------
alter table public.email_events drop constraint if exists email_events_template_check;
alter table public.email_events add constraint email_events_template_check
  check (template in ('welcome', 'verify_email', 'campaign_complete', 'publish_failed', 'page_attention', 'support_reply',
                      'payment_receipt', 'plan_ending_soon', 'plan_ended', 'test'));
