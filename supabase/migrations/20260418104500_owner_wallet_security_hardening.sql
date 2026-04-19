create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prevent_wallet_ledger_mutation()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  raise exception 'wallet_ledger is append-only';
end;
$$;

create index if not exists idx_owner_user_links_organization
  on public.owner_user_links (organization_id);

create index if not exists idx_owner_property_links_organization
  on public.owner_property_links (organization_id);

create index if not exists idx_owner_payout_methods_organization
  on public.owner_payout_methods (organization_id);

create index if not exists idx_payment_allocations_organization
  on public.payment_allocations (organization_id);

create index if not exists idx_payment_allocations_property
  on public.payment_allocations (property_id);

create index if not exists idx_payment_allocations_tenant
  on public.payment_allocations (tenant_id);

create index if not exists idx_payment_allocations_unit
  on public.payment_allocations (unit_id)
  where unit_id is not null;

create index if not exists idx_payment_allocations_checkout
  on public.payment_allocations (payment_gateway_checkout_id)
  where payment_gateway_checkout_id is not null;

create index if not exists idx_payment_allocations_webhook
  on public.payment_allocations (webhook_event_id)
  where webhook_event_id is not null;

create index if not exists idx_wallet_ledger_organization
  on public.wallet_ledger (organization_id);

create index if not exists idx_wallet_ledger_payment_allocation
  on public.wallet_ledger (payment_allocation_id)
  where payment_allocation_id is not null;

create index if not exists idx_wallet_ledger_checkout
  on public.wallet_ledger (checkout_id)
  where checkout_id is not null;

create index if not exists idx_wallet_ledger_payout_method
  on public.wallet_ledger (payout_method_id)
  where payout_method_id is not null;

create index if not exists idx_wallet_ledger_webhook_event
  on public.wallet_ledger (webhook_event_id)
  where webhook_event_id is not null;

create index if not exists idx_withdrawal_requests_organization
  on public.withdrawal_requests (organization_id);

create index if not exists idx_withdrawal_requests_payout_method
  on public.withdrawal_requests (payout_method_id);
