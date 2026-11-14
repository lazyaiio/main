-- LazyAI migration 0025: Facebook Page Insights (the last numbers we fetched, kept for display).
-- Run in the Supabase SQL Editor AFTER 0001-0024. Safe to run again: every statement can be repeated.
--
--  * page_insight_snapshots: ONE row per connected Page and time range (7 or 28 days), replaced each time the
--    numbers are refreshed. It holds only aggregate numbers (views, engagement, followers) and the titles of
--    posts LazyAI published. It is deleted when the Page is disconnected or the person's Facebook data is
--    deleted, and removed with the workspace.
--  * Signed-in workspace members may READ their own snapshots. Only the server may write them.

create table if not exists public.page_insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_page_id uuid not null,
  range_days int not null check (range_days in (7, 28)),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 200000),
  fetched_at timestamptz not null default now(),
  unique (workspace_id, social_page_id, range_days),
  foreign key (workspace_id, social_page_id) references public.social_pages (workspace_id, id) on delete cascade
);

alter table public.page_insight_snapshots enable row level security;
revoke all on public.page_insight_snapshots from anon, authenticated;
grant select on public.page_insight_snapshots to authenticated;
drop policy if exists "page insights: members read" on public.page_insight_snapshots;
create policy "page insights: members read" on public.page_insight_snapshots for select to authenticated using (public.can_read_workspace(workspace_id));
