-- LazyAI migration 0003: platform admins, AI provider settings, AI usage recording.
-- Run once in the Supabase SQL Editor AFTER 0001 and 0002.
-- API keys are NOT stored in the database. They live only in Vercel environment variables.

-- ---------- Platform admins (a short list of people who run the whole product) ----------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
-- No policies and no grants: browsers cannot read or change this table. Add admins with SQL only.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------- AI provider settings (global; edited by platform admins) ----------
create table public.ai_provider_settings (
  provider text primary key check (provider in ('anthropic', 'openai', 'gemini', 'openrouter')),
  enabled boolean not null default false,
  model text not null check (char_length(model) between 1 and 120),
  priority int not null default 100 check (priority between 1 and 999),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_provider_settings (provider, model, priority) values
  ('anthropic', 'claude-haiku-5-5', 10),
  ('openai', 'gpt-4o-mini', 20),
  ('gemini', 'gemini-2.0-flash', 30),
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 40);

create or replace function public.touch_ai_provider_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger ai_provider_settings_touch
  before update on public.ai_provider_settings
  for each row execute function public.touch_ai_provider_settings();

alter table public.ai_provider_settings enable row level security;
revoke all on public.ai_provider_settings from anon, authenticated;
grant select on public.ai_provider_settings to authenticated;
grant update (enabled, model, priority) on public.ai_provider_settings to authenticated;

create policy "ai settings: admins read" on public.ai_provider_settings
  for select to authenticated using (public.is_platform_admin());
create policy "ai settings: admins update" on public.ai_provider_settings
  for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Any signed-in user may learn WHICH providers are on (never keys): generation needs this.
create or replace function public.get_enabled_ai_providers()
returns table (provider text, model text, priority int)
language sql
stable
security definer
set search_path = public
as $$
  select s.provider, s.model, s.priority
  from public.ai_provider_settings s
  where s.enabled and auth.uid() is not null
  order by s.priority, s.provider;
$$;

revoke all on function public.get_enabled_ai_providers() from public, anon;
grant execute on function public.get_enabled_ai_providers() to authenticated;

-- ---------- AI usage recording (server code calls this; the actor comes from the session) ----------
create or replace function public.record_ai_usage(
  p_workspace_id uuid,
  p_action_type text,
  p_provider text,
  p_model text,
  p_units numeric,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_write_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action_type !~ '^ai\.[a-z_]{1,60}$' or p_units is null or p_units < 0 or p_units > 1000000 then
    raise exception 'invalid usage record' using errcode = '22023';
  end if;
  insert into public.usage_records (workspace_id, user_id, action_type, provider, model, units, related_entity_type, related_entity_id)
  values (p_workspace_id, auth.uid(), p_action_type, left(p_provider, 40), left(p_model, 120), p_units, left(p_entity_type, 40), p_entity_id);
end;
$$;

revoke all on function public.record_ai_usage(uuid, text, text, text, numeric, text, uuid) from public, anon;
grant execute on function public.record_ai_usage(uuid, text, text, text, numeric, text, uuid) to authenticated;

-- ---------- Regeneration needs to refresh the AI bookkeeping columns on a post ----------
grant update (ai_provider, ai_model, prompt_version, usage_metadata) on public.content_items to authenticated;
