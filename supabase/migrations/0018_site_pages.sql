-- LazyAI migration 0018: pages that a platform admin can edit (Terms, Privacy, Cookies, Acceptable Use,
-- Data Deletion, Help, Contact, About) and the home page text.
-- Run once in the Supabase SQL Editor AFTER 0001-0017.
--
-- Only the server touches these tables (with the service key, after checking the person is a platform admin).
-- Browsers get no access at all. When a page has no row, the site shows its built-in text.

create table if not exists public.site_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]{1,40}$'),
  title text not null check (char_length(title) between 1 and 120),
  intro text not null default '' check (char_length(intro) <= 600),
  body text not null default '' check (char_length(body) <= 60000),
  data jsonb check (data is null or (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 60000)),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.site_page_versions (
  id bigint generated always as identity primary key,
  slug text not null check (slug ~ '^[a-z0-9-]{1,40}$'),
  title text not null,
  intro text not null default '',
  body text not null default '',
  data jsonb,
  saved_at timestamptz not null default now(),
  saved_by uuid
);
create index if not exists site_page_versions_slug_idx on public.site_page_versions (slug, saved_at desc);

alter table public.site_pages enable row level security;
alter table public.site_page_versions enable row level security;
revoke all on public.site_pages from anon, authenticated;
revoke all on public.site_page_versions from anon, authenticated;
-- No policies on purpose: with row security on and no policy, browser roles can read and write nothing.
