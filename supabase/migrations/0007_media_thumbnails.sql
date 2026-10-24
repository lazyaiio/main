-- LazyAI migration 0007: thumbnails for the media library.
-- Run once in the Supabase SQL Editor AFTER 0001-0006.
--
--  * Each library image can have a small preview (WebP, at most 480 px) stored as a second file in the
--    same private bucket, so the library stays light even with many images.
--  * media_assets.thumb_path points to that file. It is set only by trusted functions.
--  * Older images have no thumbnail yet; the app can create them (set_media_thumbnail).
--  * register_media_asset() gets a second form that also takes the thumbnail path. The old form still
--    works (no thumbnail).

alter table public.media_assets add column if not exists thumb_path text;

create unique index if not exists media_assets_thumb_path_uniq on public.media_assets (thumb_path) where thumb_path is not null;

-- A thumbnail must be a WebP in the same workspace folder and a different file than the original.
create or replace function public._media_thumb_ok(p_workspace_id uuid, p_thumb_path text, p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.media_object_workspace(p_thumb_path) is not distinct from p_workspace_id
    and p_thumb_path like '%.webp'
    and p_thumb_path is distinct from p_storage_path
    and exists (select 1 from storage.objects where bucket_id = 'media' and name = p_thumb_path)
$$;

revoke all on function public._media_thumb_ok(uuid, text, text) from public, anon, authenticated;

-- New form with a thumbnail. Same checks as the original plus the thumbnail rules.
create or replace function public.register_media_asset(
  p_workspace_id uuid,
  p_storage_path text,
  p_source_url text,
  p_attribution jsonb,
  p_alt_text text,
  p_mime_type text,
  p_byte_size bigint,
  p_width int,
  p_height int,
  p_thumb_path text
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
  if p_thumb_path is not null and not public._media_thumb_ok(p_workspace_id, p_thumb_path, p_storage_path) then
    raise exception 'invalid thumbnail' using errcode = '22023';
  end if;

  -- All other checks (path, type, size, dimensions, library limit) live in the original function.
  new_id := public.register_media_asset(
    p_workspace_id, p_storage_path, p_source_url, p_attribution, p_alt_text, p_mime_type, p_byte_size, p_width, p_height
  );

  if p_thumb_path is not null then
    update public.media_assets set thumb_path = p_thumb_path where id = new_id;
  end if;
  return new_id;
end;
$$;

-- Adds a thumbnail to an older image that has none.
create or replace function public.set_media_thumbnail(p_asset_id uuid, p_thumb_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.media_assets;
begin
  if auth.uid() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into a from public.media_assets where id = p_asset_id for update;
  if not found or not public.can_write_workspace(a.workspace_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if a.thumb_path is not null then
    return; -- already has one
  end if;
  if a.storage_path is null or not public._media_thumb_ok(a.workspace_id, p_thumb_path, a.storage_path) then
    raise exception 'invalid thumbnail' using errcode = '22023';
  end if;
  update public.media_assets set thumb_path = p_thumb_path where id = p_asset_id;
end;
$$;

revoke all on function public.register_media_asset(uuid, text, text, jsonb, text, text, bigint, int, int, text) from public, anon;
grant execute on function public.register_media_asset(uuid, text, text, jsonb, text, text, bigint, int, int, text) to authenticated;
revoke all on function public.set_media_thumbnail(uuid, text) from public, anon;
grant execute on function public.set_media_thumbnail(uuid, text) to authenticated;
