-- LazyAI migration 0016: paid plans (bKash), plan expiry, and the lifetime option.
-- Run once in the Supabase SQL Editor AFTER 0001-0015.
--
--  * plans get a lifetime price and a switch that shows or hides the lifetime offer.
--  * workspaces remember when a paid plan ends (plan_expires_at) and how it was bought (plan_period).
--    NULL expiry means the plan does not expire (Free, a lifetime purchase, or a plan an admin set by hand).
--  * payments: one row per checkout attempt. Browsers may only READ their own workspace's payments.
--    Everything else is written by the server with the service key, after it has confirmed the payment with bKash.
--  * apply_paid_plan(): the one place that turns a confirmed payment into a plan. Safe to call twice.
--  * expire_plans(): moves workspaces whose paid time has ended back to Free. Called by the every-minute scheduler.
--    Nothing rolls over: a new purchase starts from the purchase moment unless it renews the same plan.

alter table public.plans
  add column if not exists price_lifetime numeric(12, 2) check (price_lifetime is null or price_lifetime >= 0),
  add column if not exists lifetime_available boolean not null default false;

alter table public.workspaces
  add column if not exists plan_expires_at timestamptz,
  add column if not exists plan_period text check (plan_period is null or plan_period in ('monthly', 'yearly', 'lifetime'));
-- (workspaces only lets browsers update name and timezone, so these stay under the server's control.)

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  plan_key text not null references public.plans (key),
  period text not null check (period in ('monthly', 'yearly', 'lifetime')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency = 'BDT'),
  provider text not null default 'bkash' check (provider = 'bkash'),
  status text not null default 'created' check (status in ('created', 'completed', 'failed', 'canceled')),
  invoice_number text not null unique default ('LZ' || to_char(now() at time zone 'utc', 'YYMMDD') || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  provider_payment_id text unique,
  provider_trx_id text,
  failure_code text check (failure_code is null or failure_code ~ '^[a-z0-9_]{1,40}$'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists payments_workspace_idx on public.payments (workspace_id, created_at desc);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "payments: members read" on public.payments for select to authenticated using (public.can_read_workspace(workspace_id));

-- ---------- A confirmed payment becomes a plan ----------
create or replace function public.apply_paid_plan(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payments;
  w record;
  base timestamptz;
  new_expires timestamptz;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if p.status = 'completed' then return false; end if; -- already applied

  select plan, plan_period, plan_expires_at into w from public.workspaces where id = p.workspace_id for update;
  if not found then raise exception 'workspace not found' using errcode = 'P0002'; end if;

  if p.period = 'lifetime' then
    new_expires := null;
  else
    -- Renewing the same plan before it ends continues from its end date. Anything else starts now.
    base := case when w.plan = p.plan_key and w.plan_expires_at is not null and w.plan_expires_at > now() then w.plan_expires_at else now() end;
    new_expires := case p.period when 'yearly' then base + interval '1 year' else base + interval '1 month' end;
  end if;

  -- Someone who already owns this plan for life keeps it.
  if not (w.plan = p.plan_key and w.plan_period = 'lifetime') then
    update public.workspaces set plan = p.plan_key, plan_period = p.period, plan_expires_at = new_expires where id = p.workspace_id;
  end if;

  update public.payments set status = 'completed', completed_at = now() where id = p.id;
  return true;
end;
$$;

revoke all on function public.apply_paid_plan(uuid) from public, anon, authenticated;
grant execute on function public.apply_paid_plan(uuid) to service_role;

-- ---------- Paid time ended: back to Free ----------
create or replace function public.expire_plans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.workspaces
  set plan = 'free', plan_period = null, plan_expires_at = null
  where plan_expires_at is not null and plan_expires_at < now() and plan <> 'free';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_plans() from public, anon, authenticated;
grant execute on function public.expire_plans() to service_role;
