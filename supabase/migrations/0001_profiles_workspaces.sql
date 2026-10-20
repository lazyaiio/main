-- LazyAI migration 0001: profiles, workspaces, workspace members, RLS.
-- Run once in the Supabase SQL Editor (or via the Supabase CLI) on a DEV project first.

-- ---------- Types ----------
create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');

-- ---------- Helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  timezone text not null default 'Asia/Dhaka' check (char_length(timezone) between 1 and 64),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'bn')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  timezone text not null default 'Asia/Dhaka' check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------- Membership helper (SECURITY DEFINER avoids recursive RLS) ----------
create or replace function public.has_workspace_role(ws uuid, allowed public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role = any (allowed)
  );
$$;

revoke all on function public.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

-- ---------- Signup trigger: profile + personal workspace + owner membership ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  dname text;
begin
  dname := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), ''), 80);

  insert into public.profiles (id, display_name)
  values (new.id, dname);

  insert into public.workspaces (owner_id, name)
  values (new.id, 'My workspace')
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Privileges: browser roles get the minimum ----------
revoke all on public.profiles, public.workspaces, public.workspace_members from anon, authenticated;

grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant update (display_name, timezone, preferred_language, onboarded_at) on public.profiles to authenticated;
grant update (name, timezone) on public.workspaces to authenticated;
-- No INSERT/DELETE for browser roles. Memberships and ownership change only via server-side code.

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "workspaces: members can read"
  on public.workspaces for select to authenticated
  using (public.has_workspace_role(id, array['owner', 'admin', 'editor', 'viewer']::public.workspace_role[]));

create policy "workspaces: owners and admins can update"
  on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner', 'admin']::public.workspace_role[]));

create policy "workspace_members: members can read"
  on public.workspace_members for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin', 'editor', 'viewer']::public.workspace_role[]));
