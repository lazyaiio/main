-- LazyAI migration 0022: the blog.
-- Run once in the Supabase SQL Editor AFTER 0001-0021.
--
--  * blog_categories: the topic groups ("silos"). Each can have one pillar article.
--  * blog_images: stock photos used by articles, with the credit text and license kept next to each photo.
--  * blog_posts: articles written in Markdown. They are public only when status is 'published' and the
--    publish time has come (so scheduling works without any extra job).
--  * A PUBLIC storage bucket "blog" holds the photos (blog photos must be visible to every visitor).
--    Only the server (service key) can write to it.
-- The tables themselves are server-only: browsers get no direct access. The public pages read them on the server.

create table if not exists public.blog_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  sort_order int not null default 0
);

create table if not exists public.blog_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (char_length(storage_path) <= 200),
  thumb_path text check (thumb_path is null or char_length(thumb_path) <= 200),
  width int not null check (width between 1 and 8000),
  height int not null check (height between 1 and 8000),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  provider text not null default '' check (char_length(provider) <= 40),
  creator text not null default '' check (char_length(creator) <= 120),
  creator_url text not null default '' check (char_length(creator_url) <= 300),
  source_page_url text not null default '' check (char_length(source_page_url) <= 400),
  license text not null default '' check (char_length(license) <= 80),
  license_url text not null default '' check (char_length(license_url) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists blog_images_source_idx on public.blog_images (source_page_url);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 90),
  title text not null check (char_length(title) between 5 and 140),
  seo_title text not null default '' check (char_length(seo_title) <= 70),
  meta_description text not null default '' check (char_length(meta_description) <= 200),
  excerpt text not null default '' check (char_length(excerpt) <= 320),
  body text not null default '' check (char_length(body) <= 150000),
  category_slug text references public.blog_categories (slug) on update cascade on delete set null,
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  is_pillar boolean not null default false,
  focus_keyword text not null default '' check (char_length(focus_keyword) <= 80),
  featured_image_id uuid references public.blog_images (id) on delete set null,
  author_name text not null default 'LazyAI Team' check (char_length(author_name) between 2 and 80),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists blog_posts_public_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts (category_slug);
-- One pillar article per category.
create unique index if not exists blog_posts_one_pillar_idx on public.blog_posts (category_slug) where is_pillar;

alter table public.blog_categories enable row level security;
alter table public.blog_images enable row level security;
alter table public.blog_posts enable row level security;
revoke all on public.blog_categories, public.blog_images, public.blog_posts from anon, authenticated;
-- No policies on purpose: browsers get no direct access.

insert into public.blog_categories (slug, name, description, sort_order) values
  ('content-planning', 'Content Planning', 'How to plan, organize, and keep up a steady stream of Facebook Page content.', 1),
  ('writing-posts', 'Writing Posts', 'How to write Facebook posts that are clear, useful, and worth reading.', 2),
  ('scheduling-and-ai', 'Scheduling and AI', 'Scheduling tools, automation, and using AI to write posts without losing your voice.', 3)
on conflict (slug) do nothing;

-- Public bucket for blog photos (anyone can read a photo; only the server can add or remove).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog', 'blog', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
