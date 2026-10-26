-- LazyAI migration 0012: email preferences and the delivery log.
-- Run once in the Supabase SQL Editor AFTER 0001-0011.
--
--  * email_preferences: one row per person with three on/off choices. People can read and change their own
--    choices; they can NOT change "suppressed" (set by the server when an address bounces or complains).
--  * email_events: one row per email the app tried to send (template, status, provider message id, error
--    code). It holds no email addresses and no message text. Only platform admins can read it; only the
--    server (service role) writes it.
--  * dedupe_key is unique, so the same notice can never be sent twice by accident.

create table public.email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  campaign_complete boolean not null default true,
  publish_failures boolean not null default true,
  page_alerts boolean not null default true,
  suppressed boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger email_preferences_set_updated_at before update on public.email_preferences
  for each row execute function public.set_updated_at();

alter table public.email_preferences enable row level security;
revoke all on public.email_preferences from anon, authenticated;
grant select on public.email_preferences to authenticated;
grant insert (user_id, campaign_complete, publish_failures, page_alerts) on public.email_preferences to authenticated;
grant update (campaign_complete, publish_failures, page_alerts) on public.email_preferences to authenticated;

create policy "email preferences: read own" on public.email_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "email preferences: add own" on public.email_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "email preferences: change own" on public.email_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  template text not null check (template in ('welcome', 'campaign_complete', 'publish_failed', 'page_attention', 'test')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'skipped')),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 200),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 100),
  error_code text check (error_code is null or error_code ~ '^[a-z_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_events_provider_idx on public.email_events (provider_message_id) where provider_message_id is not null;
create index email_events_created_idx on public.email_events (created_at desc);

create trigger email_events_set_updated_at before update on public.email_events
  for each row execute function public.set_updated_at();

alter table public.email_events enable row level security;
revoke all on public.email_events from anon, authenticated;
grant select on public.email_events to authenticated;
create policy "email events: platform admins read" on public.email_events
  for select to authenticated using (public.is_platform_admin());
