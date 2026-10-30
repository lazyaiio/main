-- LazyAI migration 0017: refund requests and approved refunds (bKash).
-- Run once in the Supabase SQL Editor AFTER 0001-0016.
--
-- A workspace owner or admin can ask for a refund of a completed payment. A platform admin approves it in
-- Admin -> Payments, and the site then asks bKash to send the money back. When bKash confirms, the payment
-- becomes "refunded" and, if the workspace is still on that plan, it moves back to Free.

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('created', 'completed', 'failed', 'canceled', 'refunded'));

alter table public.payments
  add column if not exists refund_status text check (refund_status is null or refund_status in ('requested', 'declined', 'refunded', 'failed')),
  add column if not exists refund_reason text check (refund_reason is null or char_length(refund_reason) <= 300),
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_trx_id text,
  add column if not exists refunded_at timestamptz;

create or replace function public.apply_refund(p_payment_id uuid, p_refund_trx text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.payments;
begin
  if not public._is_service_role() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if p.status = 'refunded' then return false; end if; -- already done
  if p.status <> 'completed' then raise exception 'not refundable' using errcode = '22023'; end if;

  update public.payments
  set status = 'refunded', refund_status = 'refunded', refund_trx_id = p_refund_trx, refunded_at = now()
  where id = p.id;

  -- If the workspace is still on the refunded plan, it goes back to Free.
  update public.workspaces
  set plan = 'free', plan_period = null, plan_expires_at = null
  where id = p.workspace_id and plan = p.plan_key;
  return true;
end;
$$;

revoke all on function public.apply_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_refund(uuid, text) to service_role;
