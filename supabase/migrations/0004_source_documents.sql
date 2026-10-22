-- LazyAI migration 0004: source documents (articles read from web addresses).
-- Run once in the Supabase SQL Editor AFTER 0001-0003.
--
-- Browsers can READ and DELETE their workspace's sources. They cannot insert directly: rows are
-- written only through record_source_document(), which checks membership and validates the data.

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.content_projects (id) on delete set null,
  source_url text not null check (char_length(source_url) between 1 and 2000),
  canonical_url text check (canonical_url is null or char_length(canonical_url) <= 2000),
  host text not null check (char_length(host) between 1 and 253),
  title text check (title is null or char_length(title) <= 300),
  site_name text check (site_name is null or char_length(site_name) <= 200),
  extracted_text text check (extracted_text is null or char_length(extracted_text) <= 30000),
  status text not null check (status in ('ready', 'failed')),
  error_code text check (error_code is null or char_length(error_code) <= 40),
  content_hash text check (content_hash is null or char_length(content_hash) <= 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  retrieved_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  check (status = 'failed' or (extracted_text is not null and char_length(extracted_text) > 0))
);

create index source_documents_ws_created_idx on public.source_documents (workspace_id, created_at desc);
create index source_documents_ws_url_idx on public.source_documents (workspace_id, source_url, retrieved_at desc);
create index source_documents_ws_host_idx on public.source_documents (workspace_id, host, created_at desc);
create index source_documents_user_idx on public.source_documents (created_by, created_at desc);

alter table public.source_documents enable row level security;
revoke all on public.source_documents from anon, authenticated;
grant select, delete on public.source_documents to authenticated;

create policy "sources: members read" on public.source_documents
  for select to authenticated using (public.can_read_workspace(workspace_id));
create policy "sources: editors delete" on public.source_documents
  for delete to authenticated using (public.can_write_workspace(workspace_id));

create or replace function public.record_source_document(
  p_workspace_id uuid,
  p_project_id uuid,
  p_source_url text,
  p_canonical_url text,
  p_host text,
  p_title text,
  p_site_name text,
  p_text text,
  p_status text,
  p_error_code text,
  p_hash text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null or not public.can_write_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.content_projects p where p.id = p_project_id and p.workspace_id = p_workspace_id
  ) then
    raise exception 'project not found' using errcode = '22023';
  end if;

  if p_status not in ('ready', 'failed')
     or (p_status = 'ready' and (p_text is null or char_length(p_text) = 0)) then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' or pg_column_size(p_metadata) > 4096 then
    raise exception 'invalid metadata' using errcode = '22023';
  end if;

  insert into public.source_documents (
    workspace_id, project_id, source_url, canonical_url, host, title, site_name,
    extracted_text, status, error_code, content_hash, metadata, created_by
  )
  values (
    p_workspace_id, p_project_id, p_source_url, p_canonical_url, p_host, p_title, p_site_name,
    case when p_status = 'ready' then p_text else null end, p_status, p_error_code, p_hash, p_metadata, auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_source_document(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.record_source_document(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) to authenticated;
