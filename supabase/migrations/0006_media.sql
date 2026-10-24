-- LazyAI migration 0006: media library (private storage bucket, safe registration of uploads).
-- Run once in the Supabase SQL Editor AFTER 0001-0005.
--
-- Design
--  * Images live in ONE private Storage bucket named "media". Nothing is public: the app shows images
--    through short-lived signed links created on the server.
--  * Every file is stored at  <workspace id>/<random id>.<jpg|png|webp|gif>.  Storage policies read the
--    workspace id from that path, so a member can only read their own workspace's files and only
--    editors/admins/owners can add or remove files. File names chosen by users are never used.
--  * Browsers can no longer insert media_assets rows directly. Rows are created by register_media_asset(),
--    which checks the file really exists in the caller's workspace folder, validates the metadata, and
--    enforces a per-workspace size and count limit (a free-tier guard).
--  * Usage records may now also use the "image." prefix (stock photo searches and imports).

-- ---------- Private bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Path helper: returns the workspace id of a valid media path, otherwise null ----------
create or replace function public.media_object_workspace(object_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
    then split_part(object_name, '/', 1)::uuid
    else null
  end
$$;

revoke all on function public.media_object_workspace(text) from public, anon;
grant execute on function public.media_object_workspace(text) to authenticated;

-- ---------- Storage policies (no update policy: files are never overwritten) ----------
drop policy if exists "media files: members read" on storage.objects;
drop policy if exists "media files: editors add" on storage.objects;
drop policy if exists "media files: editors remove" on storage.objects;

create policy "media files: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.can_read_workspace(public.media_object_workspace(name)));

create policy "media files: editors add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.can_write_workspace(public.media_object_workspace(name)));

create policy "media files: editors remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.can_write_workspace(public.media_object_workspace(name)));

-- ---------- media_assets: rows are created only through register_media_asset ----------
revoke insert on public.media_assets from authenticated;

-- One library entry per stored file (deleting an entry must never remove a file another entry uses).
create unique index if not exists media_assets_storage_path_uniq on public.media_assets (storage_path) where storage_path is not null;

create or replace function public.register_media_asset(
  p_workspace_id uuid,
  p_storage_path text,
  p_source_url text,
  p_attribution jsonb,
  p_alt_text text,
  p_mime_type text,
  p_byte_size bigint,
  p_width int,
  p_height int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  file_count int;
  total_bytes bigint;
  ext text;
begin
  if auth.uid() is null or not public.can_write_workspace(p_workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- The path must be a valid media path inside THIS workspace's folder.
  if public.media_object_workspace(p_storage_path) is distinct from p_workspace_id then
    raise exception 'invalid path' using errcode = '22023';
  end if;

  ext := lower(substring(p_storage_path from '\.([a-z]+)$'));
  if not (
    (p_mime_type = 'image/jpeg' and ext = 'jpg') or
    (p_mime_type = 'image/png' and ext = 'png') or
    (p_mime_type = 'image/webp' and ext = 'webp') or
    (p_mime_type = 'image/gif' and ext = 'gif')
  ) then
    raise exception 'invalid type' using errcode = '22023';
  end if;

  if p_byte_size is null or p_byte_size not between 1 and 4194304 then
    raise exception 'invalid size' using errcode = '22023';
  end if;
  if p_width is null or p_height is null or p_width not between 1 and 8000 or p_height not between 1 and 8000 then
    raise exception 'invalid dimensions' using errcode = '22023';
  end if;
  if p_alt_text is not null and char_length(p_alt_text) > 500 then
    raise exception 'invalid alt text' using errcode = '22023';
  end if;
  if p_source_url is not null and char_length(p_source_url) > 2000 then
    raise exception 'invalid source' using errcode = '22023';
  end if;
  if p_attribution is null or jsonb_typeof(p_attribution) <> 'object' or pg_column_size(p_attribution) > 4096 then
    raise exception 'invalid attribution' using errcode = '22023';
  end if;

  -- The file must really exist in the media bucket.
  if not exists (select 1 from storage.objects where bucket_id = 'media' and name = p_storage_path) then
    raise exception 'file not found' using errcode = 'P0002';
  end if;

  -- Free-tier guard: at most 100 files and 200 MB per workspace.
  select count(*), coalesce(sum(byte_size), 0) into file_count, total_bytes
  from public.media_assets where workspace_id = p_workspace_id;
  if file_count >= 100 or total_bytes + p_byte_size > 209715200 then
    raise exception 'library full' using errcode = '53400';
  end if;

  insert into public.media_assets (
    workspace_id, storage_path, source_url, attribution, alt_text, mime_type, byte_size, width, height,
    processing_status, created_by
  )
  values (
    p_workspace_id, p_storage_path, p_source_url, p_attribution, nullif(btrim(coalesce(p_alt_text, '')), ''),
    p_mime_type, p_byte_size, p_width, p_height, 'ready', auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.register_media_asset(uuid, text, text, jsonb, text, text, bigint, int, int) from public, anon;
grant execute on function public.register_media_asset(uuid, text, text, jsonb, text, text, bigint, int, int) to authenticated;

-- ---------- Usage records: allow the "image." prefix next to "ai." ----------
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
  if p_action_type !~ '^(ai|image)\.[a-z_]{1,60}$' or p_units is null or p_units < 0 or p_units > 1000000 then
    raise exception 'invalid usage record' using errcode = '22023';
  end if;
  insert into public.usage_records (workspace_id, user_id, action_type, provider, model, units, related_entity_type, related_entity_id)
  values (p_workspace_id, auth.uid(), p_action_type, left(p_provider, 40), left(p_model, 120), p_units, left(p_entity_type, 40), p_entity_id);
end;
$$;
