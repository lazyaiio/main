-- LazyAI migration 0015: three public plans (Free, Pro, Advanced) with editable pricing details.
-- Run once in the Supabase SQL Editor AFTER 0001-0014.
--
-- The plans table gets the fields the public pricing page needs (tagline, prices, feature list, "most popular",
-- visible, order). The old "standard" plan becomes "pro" (workspaces on it are moved), and "advanced" is added.
-- A platform admin edits all of this in Admin -> Plans. Prices are NULL until the owner sets them.
-- The pricing page reads plans with the server's service key, so no new browser permissions are granted.

alter table public.plans
  add column if not exists tagline text not null default '' check (char_length(tagline) <= 160),
  add column if not exists price_monthly numeric(12, 2) check (price_monthly is null or price_monthly >= 0),
  add column if not exists price_yearly numeric(12, 2) check (price_yearly is null or price_yearly >= 0),
  add column if not exists features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array' and jsonb_array_length(features) <= 20),
  add column if not exists highlighted boolean not null default false,
  add column if not exists visible boolean not null default true,
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- Pro replaces Standard.
insert into public.plans (key, name, limits)
select 'pro', 'Pro', limits from public.plans where key = 'standard'
on conflict (key) do nothing;

update public.workspaces set plan = 'pro' where plan = 'standard';
delete from public.plans where key = 'standard';

insert into public.plans (key, name, limits) values
  ('advanced', 'Advanced', '{"ai_generations_month": 5000, "content_items": 25000, "social_pages": 50, "media_files": 5000, "media_bytes": 10737418240, "campaigns_open": 200}')
on conflict (key) do nothing;

update public.plans set sort_order = 1, price_monthly = 0, price_yearly = 0, tagline = 'Try LazyAI at no cost',
  features = '["100 AI posts per month", "3 Facebook Pages", "100 images", "Bangla and English posts"]'::jsonb
  where key = 'free' and tagline = '';
update public.plans set sort_order = 2, highlighted = true, tagline = 'For growing businesses',
  features = '["1,000 AI posts per month", "10 Facebook Pages", "1,000 images", "Automatic stock photos", "Campaign scheduling"]'::jsonb
  where key = 'pro' and tagline = '';
update public.plans set sort_order = 3, tagline = 'For agencies and heavy use',
  features = '["5,000 AI posts per month", "50 Facebook Pages", "5,000 images", "Everything in Pro", "Priority support"]'::jsonb
  where key = 'advanced' and tagline = '';
