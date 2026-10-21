-- LazyAI migration 0002: core data model (projects, campaigns, content, media, social, scheduling,
-- queue, usage, audit) + RLS. Run once in the Supabase SQL Editor AFTER 0001.
--
-- Design rules
--  * Every tenant table has workspace_id and RLS.
--  * Children reference parents with (workspace_id, id) composite keys, so a row can never point
--    at another workspace's parent.
--  * Browser roles (authenticated) get only the columns/operations they need. Publishing state,
--    queue locks, usage and audit rows are written by trusted server code only.
--  * Provider tokens are NOT stored here yet (added server-only in the Meta batch).

-- ---------- Role helpers ----------
create or replace function public.can_read_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_role(ws, array['owner','admin','editor','viewer']::public.workspace_role[]);
$$;

create or replace function public.can_write_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_role(ws, array['owner','admin','editor']::public.workspace_role[]);
$$;

create or replace function public.can_admin_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_workspace_role(ws, array['owner','admin']::public.workspace_role[]);
$$;

revoke all on function public.can_read_workspace(uuid), public.can_write_workspace(uuid), public.can_admin_workspace(uuid) from public, anon;
grant execute on function public.can_read_workspace(uuid), public.can_write_workspace(uuid), public.can_admin_workspace(uuid) to authenticated;

-- ---------- content_projects ----------
create table public.content_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  input_type text not null check (input_type in ('topic', 'url', 'website', 'csv')),
  input_value text not null check (char_length(input_value) between 1 and 2000),
  languages text[] not null default array['en'] check (
    cardinality(languages) between 1 and 2 and languages <@ array['en', 'bn']
  ),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index content_projects_ws_created_idx on public.content_projects (workspace_id, created_at desc);

-- ---------- campaigns ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  duration_days int not null check (duration_days between 1 and 90),
  requested_item_count int not null check (requested_item_count between 1 and 90),
  status text not null default 'draft' check (
    status in ('draft', 'planning', 'generating', 'ready', 'paused', 'completed', 'failed', 'cancelled')
  ),
  languages text[] not null default array['en'] check (
    cardinality(languages) between 1 and 2 and languages <@ array['en', 'bn']
  ),
  approval_mode text not null default 'manual' check (approval_mode in ('manual', 'auto')),
  scheduling_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(scheduling_settings) = 'object'),
  generation_progress jsonb not null default '{"total":0,"completed":0,"failed":0}'::jsonb
    check (jsonb_typeof(generation_progress) = 'object'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id) references public.content_projects (workspace_id, id)
);
create index campaigns_ws_created_idx on public.campaigns (workspace_id, created_at desc);
create index campaigns_project_idx on public.campaigns (project_id);

-- ---------- content_items ----------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid,
  project_id uuid,
  language text not null check (language in ('en', 'bn')),
  content_format text not null default 'text' check (char_length(content_format) between 1 and 40),
  hook text check (hook is null or char_length(hook) <= 300),
  body text not null check (char_length(body) between 1 and 10000),
  cta text check (cta is null or char_length(cta) <= 300),
  hashtags jsonb not null default '[]'::jsonb check (jsonb_typeof(hashtags) = 'array'),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  image_brief text check (image_brief is null or char_length(image_brief) <= 1000),
  content_hash text check (content_hash is null or char_length(content_hash) <= 128),
  approval_status text not null default 'draft' check (
    approval_status in ('draft', 'awaiting_approval', 'approved', 'rejected', 'cancelled')
  ),
  ai_provider text,
  ai_model text,
  prompt_version text,
  usage_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_metadata) = 'object'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, campaign_id) references public.campaigns (workspace_id, id),
  foreign key (workspace_id, project_id) references public.content_projects (workspace_id, id)
);
create index content_items_ws_status_idx on public.content_items (workspace_id, approval_status, created_at desc);
create index content_items_campaign_idx on public.content_items (campaign_id);
create index content_items_project_idx on public.content_items (project_id);
create unique index content_items_campaign_hash_uniq on public.content_items (campaign_id, content_hash)
  where campaign_id is not null and content_hash is not null;

-- ---------- media ----------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  storage_path text,
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  attribution jsonb not null default '{}'::jsonb check (jsonb_typeof(attribution) = 'object'),
  alt_text text check (alt_text is null or char_length(alt_text) <= 500),
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  processing_status text not null default 'pending' check (processing_status in ('pending', 'ready', 'failed')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index media_assets_ws_created_idx on public.media_assets (workspace_id, created_at desc);

create table public.content_item_media (
  content_item_id uuid not null,
  media_asset_id uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sort_order int not null default 0,
  alt_text_override text check (alt_text_override is null or char_length(alt_text_override) <= 500),
  primary key (content_item_id, media_asset_id),
  foreign key (workspace_id, content_item_id) references public.content_items (workspace_id, id) on delete cascade,
  foreign key (workspace_id, media_asset_id) references public.media_assets (workspace_id, id) on delete cascade
);

-- ---------- social accounts and pages (schema only; connection logic comes later) ----------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null default 'facebook' check (provider in ('facebook')),
  provider_account_id text not null,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  token_expires_at timestamptz,
  last_validated_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, provider, provider_account_id)
);

create table public.social_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_account_id uuid not null,
  provider_page_id text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, social_account_id) references public.social_accounts (workspace_id, id) on delete cascade
);
create index social_pages_ws_idx on public.social_pages (workspace_id);

-- ---------- scheduled_posts ----------
create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content_item_id uuid not null,
  social_page_id uuid not null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'publishing', 'retrying', 'published', 'failed', 'cancelled')
  ),
  idempotency_key text not null unique,
  provider_post_id text,
  attempt_count int not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, content_item_id) references public.content_items (workspace_id, id),
  foreign key (workspace_id, social_page_id) references public.social_pages (workspace_id, id)
);
create index scheduled_posts_ws_time_idx on public.scheduled_posts (workspace_id, scheduled_at);
create index scheduled_posts_due_idx on public.scheduled_posts (status, scheduled_at);

-- ---------- job_queue ----------
create table public.job_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  job_type text not null check (char_length(job_type) between 1 and 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'retrying', 'completed', 'failed', 'cancelled')
  ),
  priority int not null default 0,
  attempts int not null default 0,
  max_attempts int not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  idempotency_key text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_queue_claim_idx on public.job_queue (status, available_at, priority desc);
create unique index job_queue_idem_uniq on public.job_queue (idempotency_key) where idempotency_key is not null;

-- ---------- usage_records / audit_events ----------
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action_type text not null check (char_length(action_type) between 1 and 80),
  provider text,
  model text,
  units numeric not null default 0 check (units >= 0),
  cost_estimate numeric check (cost_estimate is null or cost_estimate >= 0),
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);
create index usage_records_ws_created_idx on public.usage_records (workspace_id, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 60),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_events_ws_created_idx on public.audit_events (workspace_id, created_at desc);

-- ---------- updated_at triggers ----------
create trigger content_projects_set_updated_at before update on public.content_projects for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items for each row execute function public.set_updated_at();
create trigger social_accounts_set_updated_at before update on public.social_accounts for each row execute function public.set_updated_at();
create trigger social_pages_set_updated_at before update on public.social_pages for each row execute function public.set_updated_at();
create trigger scheduled_posts_set_updated_at before update on public.scheduled_posts for each row execute function public.set_updated_at();
create trigger job_queue_set_updated_at before update on public.job_queue for each row execute function public.set_updated_at();

-- ---------- Audit logging (the only way browser sessions can write audit rows) ----------
create or replace function public.log_audit_event(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
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
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' or pg_column_size(p_metadata) > 4096 then
    raise exception 'invalid metadata' using errcode = '22023';
  end if;
  insert into public.audit_events (workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_workspace_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
end;
$$;

revoke all on function public.log_audit_event(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to authenticated;

-- ---------- Privileges ----------
revoke all on
  public.content_projects, public.campaigns, public.content_items, public.media_assets,
  public.content_item_media, public.social_accounts, public.social_pages, public.scheduled_posts,
  public.job_queue, public.usage_records, public.audit_events
from anon, authenticated;

-- read access
grant select on
  public.content_projects, public.campaigns, public.content_items, public.media_assets,
  public.content_item_media, public.social_accounts, public.social_pages, public.scheduled_posts,
  public.usage_records, public.audit_events
to authenticated;
-- job_queue: never expose payload, locks, or errors to browsers
grant select (id, workspace_id, job_type, status, priority, attempts, max_attempts, available_at, created_at, updated_at)
  on public.job_queue to authenticated;

-- write access (RLS decides who)
grant insert (workspace_id, name, input_type, input_value, languages, settings) on public.content_projects to authenticated;
grant update (name, input_type, input_value, languages, settings, status) on public.content_projects to authenticated;
grant delete on public.content_projects to authenticated;

grant insert (workspace_id, project_id, name, duration_days, requested_item_count, languages, approval_mode, scheduling_settings)
  on public.campaigns to authenticated;
grant update (name, status, approval_mode, scheduling_settings) on public.campaigns to authenticated;
grant delete on public.campaigns to authenticated;

grant insert (workspace_id, campaign_id, project_id, language, content_format, hook, body, cta, hashtags, source_url,
  image_brief, content_hash, approval_status, ai_provider, ai_model, prompt_version, usage_metadata)
  on public.content_items to authenticated;
grant update (language, content_format, hook, body, cta, hashtags, source_url, image_brief, content_hash, approval_status)
  on public.content_items to authenticated;
grant delete on public.content_items to authenticated;

grant insert (workspace_id, storage_path, source_url, attribution, alt_text, mime_type, byte_size, width, height)
  on public.media_assets to authenticated;
grant update (alt_text, attribution) on public.media_assets to authenticated;
grant delete on public.media_assets to authenticated;

grant insert (content_item_id, media_asset_id, workspace_id, sort_order, alt_text_override) on public.content_item_media to authenticated;
grant update (sort_order, alt_text_override) on public.content_item_media to authenticated;
grant delete on public.content_item_media to authenticated;

-- NOT writable from browsers: social_accounts, social_pages, scheduled_posts, job_queue, usage_records, audit_events.

-- ---------- Row Level Security ----------
alter table public.content_projects enable row level security;
alter table public.campaigns enable row level security;
alter table public.content_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.content_item_media enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_pages enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.job_queue enable row level security;
alter table public.usage_records enable row level security;
alter table public.audit_events enable row level security;

-- content_projects
create policy "projects: members read" on public.content_projects for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "projects: editors insert" on public.content_projects for insert to authenticated with check (public.can_write_workspace(workspace_id));
create policy "projects: editors update" on public.content_projects for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy "projects: admins delete" on public.content_projects for delete to authenticated using (public.can_admin_workspace(workspace_id));

-- campaigns
create policy "campaigns: members read" on public.campaigns for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "campaigns: editors insert" on public.campaigns for insert to authenticated with check (public.can_write_workspace(workspace_id));
create policy "campaigns: editors update" on public.campaigns for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy "campaigns: admins delete" on public.campaigns for delete to authenticated using (public.can_admin_workspace(workspace_id));

-- content_items
create policy "content: members read" on public.content_items for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "content: editors insert" on public.content_items for insert to authenticated with check (public.can_write_workspace(workspace_id));
create policy "content: editors update" on public.content_items for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy "content: editors delete" on public.content_items for delete to authenticated using (public.can_write_workspace(workspace_id));

-- media
create policy "media: members read" on public.media_assets for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "media: editors insert" on public.media_assets for insert to authenticated with check (public.can_write_workspace(workspace_id));
create policy "media: editors update" on public.media_assets for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy "media: editors delete" on public.media_assets for delete to authenticated using (public.can_write_workspace(workspace_id));

create policy "content media: members read" on public.content_item_media for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "content media: editors insert" on public.content_item_media for insert to authenticated with check (public.can_write_workspace(workspace_id));
create policy "content media: editors update" on public.content_item_media for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy "content media: editors delete" on public.content_item_media for delete to authenticated using (public.can_write_workspace(workspace_id));

-- read-only-for-browsers tables
create policy "social accounts: members read" on public.social_accounts for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "social pages: members read" on public.social_pages for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "scheduled posts: members read" on public.scheduled_posts for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "job queue: members read" on public.job_queue for select to authenticated using (workspace_id is not null and public.can_read_workspace(workspace_id));
create policy "usage: members read" on public.usage_records for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "audit: members read" on public.audit_events for select to authenticated using (public.can_read_workspace(workspace_id));
