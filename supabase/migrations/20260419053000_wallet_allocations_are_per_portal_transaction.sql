alter table public.payment_allocations
  drop constraint if exists payment_allocations_payment_unique;

create unique index if not exists idx_payment_allocations_checkout_unique
  on public.payment_allocations (payment_gateway_checkout_id)
  where payment_gateway_checkout_id is not null;
