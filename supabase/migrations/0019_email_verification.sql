-- LazyAI migration 0019: email verification inside the app ("pay first, verify after").
-- Run once in the Supabase SQL Editor AFTER 0001-0018.
--
-- New flow: a person creates an account while choosing a plan, can pay and see the dashboard straight away,
-- and gets an email with a link. Until the link is opened, the account is "not activated": it can look
-- around but cannot create or change content. This table remembers who has verified.
--
--  * Everyone who already has an account is marked verified now, so nobody is locked out.
--  * can_write_workspace() (used by every "may this person write here" rule) now also requires a verified email.
--  * Browsers can read only their own "verified or not" answer; the token is only ever read and written by the server.
--
-- IMPORTANT (Supabase dashboard, one time): Authentication -> Sign In / Providers -> Email -> turn OFF "Confirm email".
-- With it ON, Supabase itself blocks a new account until the Supabase link is clicked, so the person cannot reach
-- the dashboard right after paying. LazyAI sends its own verification email instead.

create table if not exists public.user_email_verification (
  user_id uuid primary key references auth.users (id) on delete cascade,
  verified_at timestamptz,
  token_hash text check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz,
  last_sent_at timestamptz,
  sends_in_window int not null default 0,
  window_started_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists user_email_verification_token_idx on public.user_email_verification (token_hash) where token_hash is not null;

alter table public.user_email_verification enable row level security;
revoke all on public.user_email_verification from anon, authenticated;
grant select (user_id, verified_at) on public.user_email_verification to authenticated;
create policy "email verification: read own" on public.user_email_verification for select to authenticated using (user_id = (select auth.uid()));

-- Everyone who exists today is already trusted.
insert into public.user_email_verification (user_id, verified_at)
select id, coalesce(email_confirmed_at, now()) from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_email_verification where user_id = auth.uid() and verified_at is not null)
$$;

revoke all on function public.is_email_verified() from public, anon;
grant execute on function public.is_email_verified() to authenticated;

-- Writing needs a verified email as well as a writing role.
create or replace function public.can_write_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_email_verified() and public.has_workspace_role(ws, array['owner','admin','editor']::public.workspace_role[]);
$$;

-- The email log only accepts known template names. Add the verification email.
alter table public.email_events drop constraint if exists email_events_template_check;
alter table public.email_events add constraint email_events_template_check
  check (template in ('welcome', 'verify_email', 'campaign_complete', 'publish_failed', 'page_attention', 'test'));
