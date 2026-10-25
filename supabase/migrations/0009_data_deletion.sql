-- LazyAI migration 0009: records of Facebook data deletion requests.
-- Run once in the Supabase SQL Editor AFTER 0001-0008.
--
-- When someone removes LazyAI in their Facebook settings, Meta calls LazyAI's data deletion callback.
-- LazyAI then disconnects the person's Pages, deletes the stored tokens, and keeps only a record with a
-- confirmation code so the person can check the result on the Data Deletion page.
-- The table holds no personal data and has no browser access (server code with the service-role key only).

create table public.data_deletion_requests (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{16,64}$'),
  source text not null check (source in ('facebook_deletion', 'facebook_deauthorize')),
  status text not null default 'received' check (status in ('received', 'completed', 'failed')),
  matched_accounts int not null default 0 check (matched_accounts >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index data_deletion_requests_created_idx on public.data_deletion_requests (created_at);

alter table public.data_deletion_requests enable row level security;
revoke all on public.data_deletion_requests from anon, authenticated;
