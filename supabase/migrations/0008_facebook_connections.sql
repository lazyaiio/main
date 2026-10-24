-- LazyAI migration 0008: Facebook Page connections (OAuth attempts and encrypted Page tokens).
-- Run once in the Supabase SQL Editor AFTER 0001-0007.
--
-- Design
--  * Access tokens are NEVER stored in social_accounts or social_pages (browsers can read those tables).
--  * Tokens live in social_page_tokens, encrypted by the app (AES-256-GCM) before they are saved. The
--    table has no browser access at all: only server code with the service-role key can read or write it.
--  * social_oauth_flows tracks one connection attempt (one-time, expires after 10 minutes). It also holds
--    the encrypted list of Pages between "Facebook said yes" and "you picked which Pages to connect".
--    No browser access either.
--  * social_accounts and social_pages stay read-only for browsers (members can see which Pages are
--    connected and their status); only the server changes them.

-- ---------- Extra, non-secret columns ----------
alter table public.social_accounts
  add column if not exists display_name text check (display_name is null or char_length(display_name) <= 200),
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z_]{1,40}$');

alter table public.social_pages
  add column if not exists category text check (category is null or char_length(category) <= 200),
  add column if not exists last_validated_at timestamptz,
  add column if not exists last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z_]{1,40}$');

-- ---------- OAuth attempts (server only) ----------
create table public.social_oauth_flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'facebook' check (provider in ('facebook')),
  state_hash text not null check (state_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'started' check (status in ('started', 'authorized', 'completed', 'failed')),
  payload_ciphertext text check (payload_ciphertext is null or char_length(payload_ciphertext) <= 200000),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index social_oauth_flows_expires_idx on public.social_oauth_flows (expires_at);
create index social_oauth_flows_owner_idx on public.social_oauth_flows (workspace_id, user_id);

-- ---------- Encrypted Page tokens (server only) ----------
create table public.social_page_tokens (
  social_page_id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_ciphertext text not null check (char_length(token_ciphertext) between 20 and 4000),
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, social_page_id) references public.social_pages (workspace_id, id) on delete cascade
);

create trigger social_page_tokens_set_updated_at before update on public.social_page_tokens
  for each row execute function public.set_updated_at();

-- No access for browsers: row security on, no policies, no grants.
alter table public.social_oauth_flows enable row level security;
alter table public.social_page_tokens enable row level security;
revoke all on public.social_oauth_flows from anon, authenticated;
revoke all on public.social_page_tokens from anon, authenticated;
