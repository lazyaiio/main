-- LazyAI migration 0021: search engine settings.
-- Run once in the Supabase SQL Editor AFTER 0001-0020.
--
-- Site-wide SEO settings are stored in platform_settings (key 'seo') like the other admin settings.
-- This table holds the page-by-page overrides (title, description, share image, "do not index") that an admin
-- sets in Admin -> SEO. Only the server (service key) can read or write it.

create table if not exists public.seo_pages (
  path text primary key check (path ~ '^/[a-z0-9/_-]{0,100}$'),
  title text not null default '' check (char_length(title) <= 90),
  description text not null default '' check (char_length(description) <= 220),
  og_image text not null default '' check (char_length(og_image) <= 300),
  noindex boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.seo_pages enable row level security;
revoke all on public.seo_pages from anon, authenticated;
-- No policies on purpose: browsers get no access.
