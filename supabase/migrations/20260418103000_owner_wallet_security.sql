create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.owner_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  legal_name text,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.owner_user_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.owner_profiles(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner_admin' check (role in ('owner_admin', 'owner_operator', 'viewer')),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint owner_user_links_owner_user_unique unique (owner_id, user_id)
);

create table if not exists public.owner_property_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.owner_profiles(id) on delete cascade,
  property_id varchar not null references public.properties(id) on delete cascade,
  active boolean not null default true,
  assigned_at timestamptz not null default timezone('utc', now()),
  unassigned_at timestamptz,
  created_by_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint owner_property_links_owner_property_unique unique (owner_id, property_id)
);

create table if not exists public.owner_payout_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.owner_profiles(id) on delete cascade,
  method text not null default 'PIX' check (method in ('PIX')),
  pix_key_type text not null check (pix_key_type in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')),
  pix_key_value text not null,
  pix_key_masked text not null,
  holder_name text,
  holder_tax_id text,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'disabled')),
  active boolean not null default true,
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.owner_wallets (
  owner_id uuid primary key references public.owner_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  currency text not null default 'BRL' check (currency = 'BRL'),
  gross_cents bigint not null default 0,
  pending_cents bigint not null default 0,
  available_cents bigint not null default 0,
  reserved_cents bigint not null default 0,
  blocked_cents bigint not null default 0,
  version bigint not null default 0,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint owner_wallets_non_negative check (
    gross_cents >= 0 and
    pending_cents >= 0 and
    available_cents >= 0 and
    reserved_cents >= 0 and
    blocked_cents >= 0
  )
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.owner_profiles(id) on delete restrict,
  payout_method_id uuid not null references public.owner_payout_methods(id) on delete restrict,
  requested_by_user_id uuid not null,
  status text not null default 'requested' check (status in ('requested', 'reserved', 'queued_manual_settlement', 'succeeded', 'failed', 'cancelled')),
  requested_amount_cents bigint not null check (requested_amount_cents > 0),
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  net_amount_cents bigint not null check (net_amount_cents >= 0),
  idempotency_key text not null,
  correlation_id uuid not null default gen_random_uuid(),
  balance_snapshot jsonb not null default '{}'::jsonb,
  request_metadata jsonb not null default '{}'::jsonb,
  sanitized_provider_request jsonb not null default '{}'::jsonb,
  sanitized_provider_response jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_reason text,
  requested_at timestamptz not null default timezone('utc', now()),
  reserved_at timestamptz,
  queued_at timestamptz,
  settled_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint withdrawal_requests_owner_idempotency_unique unique (owner_id, idempotency_key)
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.owner_profiles(id) on delete restrict,
  payment_id varchar not null references public.payments(id) on delete restrict,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  property_id varchar not null references public.properties(id) on delete restrict,
  unit_id varchar references public.property_units(id) on delete set null,
  payment_gateway_checkout_id uuid references public.payment_gateway_checkouts(id) on delete set null,
  webhook_event_id uuid references public.payment_gateway_webhook_events(id) on delete set null,
  gross_amount_cents bigint not null check (gross_amount_cents >= 0),
  gateway_fee_cents bigint not null default 0 check (gateway_fee_cents >= 0),
  platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
  net_amount_cents bigint not null check (net_amount_cents >= 0),
  paid_at timestamptz not null,
  available_at timestamptz not null,
  allocation_status text not null default 'applied' check (allocation_status in ('applied', 'reversed')),
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_allocations_payment_unique unique (payment_id),
  constraint payment_allocations_idempotency_unique unique (idempotency_key)
);

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owner_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_allocation_id uuid references public.payment_allocations(id) on delete set null,
  payment_id varchar references public.payments(id) on delete set null,
  checkout_id uuid references public.payment_gateway_checkouts(id) on delete set null,
  webhook_event_id uuid references public.payment_gateway_webhook_events(id) on delete set null,
  withdrawal_request_id uuid references public.withdrawal_requests(id) on delete set null,
  payout_method_id uuid references public.owner_payout_methods(id) on delete set null,
  entry_type text not null check (
    entry_type in (
      'payment_credit',
      'gateway_fee_debit',
      'platform_fee_debit',
      'withdrawal_reservation',
      'withdrawal_reservation_release',
      'withdrawal_debit',
      'refund_debit',
      'chargeback_debit',
      'dispute_hold',
      'dispute_release',
      'manual_adjustment_credit',
      'manual_adjustment_debit'
    )
  ),
  direction text not null check (direction in ('credit', 'debit')),
  status text not null check (status in ('posted', 'reserved', 'blocked', 'released', 'cancelled')),
  amount_cents bigint not null check (amount_cents > 0),
  available_at timestamptz,
  actor_user_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text,
  source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.payment_gateway_webhook_events
  add column if not exists normalized_event_key text,
  add column if not exists webhook_secret_valid boolean not null default false,
  add column if not exists signature_valid boolean not null default false,
  add column if not exists signature_algorithm text,
  add column if not exists api_version integer,
  add column if not exists processed_result jsonb not null default '{}'::jsonb,
  add column if not exists attempt_count integer not null default 1;

alter table public.payment_gateway_checkouts
  add column if not exists provider_api_version integer,
  add column if not exists provider_payment_method text,
  add column if not exists paid_at timestamptz;

create unique index if not exists idx_owner_property_links_one_active_owner
  on public.owner_property_links (property_id)
  where active is true;

create unique index if not exists idx_owner_payout_methods_one_default
  on public.owner_payout_methods (owner_id)
  where active is true and is_default is true;

create unique index if not exists idx_wallet_ledger_owner_idempotency
  on public.wallet_ledger (owner_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_payment_gateway_webhook_events_normalized_key
  on public.payment_gateway_webhook_events (normalized_event_key)
  where normalized_event_key is not null;

create index if not exists idx_owner_profiles_organization on public.owner_profiles (organization_id);
create index if not exists idx_owner_user_links_user on public.owner_user_links (user_id, active);
create index if not exists idx_owner_user_links_owner on public.owner_user_links (owner_id, active);
create index if not exists idx_owner_property_links_owner on public.owner_property_links (owner_id, active);
create index if not exists idx_owner_payout_methods_owner on public.owner_payout_methods (owner_id, active);
create index if not exists idx_owner_wallets_organization on public.owner_wallets (organization_id);
create index if not exists idx_wallet_ledger_owner_created on public.wallet_ledger (owner_id, created_at desc);
create index if not exists idx_wallet_ledger_withdrawal on public.wallet_ledger (withdrawal_request_id);
create index if not exists idx_wallet_ledger_payment on public.wallet_ledger (payment_id);
create index if not exists idx_payment_allocations_owner on public.payment_allocations (owner_id, created_at desc);
create index if not exists idx_withdrawal_requests_owner_created on public.withdrawal_requests (owner_id, created_at desc);
create index if not exists idx_withdrawal_requests_status on public.withdrawal_requests (status, created_at desc);

create or replace function public.create_owner_wallet_for_profile()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.owner_wallets (owner_id, organization_id)
  values (new.id, new.organization_id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

create or replace function public.current_owner_ids()
returns uuid[]
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce(array_agg(distinct oul.owner_id), '{}'::uuid[])
  from public.owner_user_links oul
  join public.owner_profiles op on op.id = oul.owner_id
  where oul.user_id = auth.uid()
    and oul.active is true
    and op.status = 'active';
$$;

create or replace function public.is_owner_member(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select p_owner_id = any(public.current_owner_ids());
$$;

create or replace function public.refresh_owner_wallet_summary(p_owner_id uuid)
returns public.owner_wallets
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_org_id uuid;
  v_wallet public.owner_wallets%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_gross bigint := 0;
  v_pending bigint := 0;
  v_available_credits bigint := 0;
  v_reserved bigint := 0;
  v_blocked bigint := 0;
  v_direct_debits bigint := 0;
  v_available bigint := 0;
begin
  select organization_id
    into v_org_id
  from public.owner_profiles
  where id = p_owner_id;

  if v_org_id is null then
    raise exception 'owner profile not found';
  end if;

  if auth.role() <> 'service_role'
     and not public.is_owner_member(p_owner_id)
     and not public.is_org_admin(v_org_id) then
    raise exception 'owner access denied';
  end if;

  select
    coalesce(sum(case when entry_type = 'payment_credit' and direction = 'credit' then amount_cents else 0 end), 0),
    coalesce(sum(case when entry_type = 'payment_credit' and direction = 'credit' and coalesce(available_at, created_at) > v_now then amount_cents else 0 end), 0),
    coalesce(sum(case when entry_type in ('payment_credit', 'manual_adjustment_credit') and direction = 'credit' and coalesce(available_at, created_at) <= v_now then amount_cents else 0 end), 0),
    coalesce(sum(case when entry_type in ('withdrawal_reservation', 'withdrawal_reservation_release') then case when direction = 'debit' then amount_cents else -amount_cents end else 0 end), 0),
    coalesce(sum(case when entry_type in ('dispute_hold', 'dispute_release') then case when direction = 'debit' then amount_cents else -amount_cents end else 0 end), 0),
    coalesce(sum(case when entry_type in ('gateway_fee_debit', 'platform_fee_debit', 'withdrawal_debit', 'refund_debit', 'chargeback_debit', 'manual_adjustment_debit') then case when direction = 'debit' then amount_cents else -amount_cents end else 0 end), 0)
    into v_gross, v_pending, v_available_credits, v_reserved, v_blocked, v_direct_debits
  from public.wallet_ledger
  where owner_id = p_owner_id;

  v_reserved := greatest(v_reserved, 0);
  v_blocked := greatest(v_blocked, 0);
  v_direct_debits := greatest(v_direct_debits, 0);
  v_available := greatest(v_available_credits - v_direct_debits - v_reserved - v_blocked, 0);

  insert into public.owner_wallets (
    owner_id,
    organization_id,
    gross_cents,
    pending_cents,
    available_cents,
    reserved_cents,
    blocked_cents,
    version,
    last_reconciled_at,
    updated_at
  )
  values (
    p_owner_id,
    v_org_id,
    v_gross,
    v_pending,
    v_available,
    v_reserved,
    v_blocked,
    1,
    v_now,
    v_now
  )
  on conflict (owner_id) do update
    set gross_cents = excluded.gross_cents,
        pending_cents = excluded.pending_cents,
        available_cents = excluded.available_cents,
        reserved_cents = excluded.reserved_cents,
        blocked_cents = excluded.blocked_cents,
        version = public.owner_wallets.version + 1,
        last_reconciled_at = excluded.last_reconciled_at,
        updated_at = excluded.updated_at
  returning *
  into v_wallet;

  return v_wallet;
end;
$$;

create or replace function public.queue_owner_withdrawal_request(
  p_payout_method_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_request_metadata jsonb default '{}'::jsonb
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_payout public.owner_payout_methods%rowtype;
  v_existing public.withdrawal_requests%rowtype;
  v_withdrawal public.withdrawal_requests%rowtype;
  v_wallet public.owner_wallets%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency key is required';
  end if;

  if p_amount_cents is null or p_amount_cents < 300 then
    raise exception 'minimum withdrawal amount is 300 cents';
  end if;

  select *
    into v_payout
  from public.owner_payout_methods
  where id = p_payout_method_id
    and active is true
    and verification_status = 'verified'
  for update;

  if not found then
    raise exception 'verified payout method not found';
  end if;

  if not public.is_owner_member(v_payout.owner_id) then
    raise exception 'owner payout method access denied';
  end if;

  select *
    into v_existing
  from public.withdrawal_requests
  where owner_id = v_payout.owner_id
    and idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return v_existing;
  end if;

  perform public.refresh_owner_wallet_summary(v_payout.owner_id);

  select *
    into v_wallet
  from public.owner_wallets
  where owner_id = v_payout.owner_id
  for update;

  if not found then
    raise exception 'owner wallet not found';
  end if;

  if v_wallet.available_cents < p_amount_cents then
    raise exception 'insufficient available balance';
  end if;

  insert into public.withdrawal_requests (
    organization_id,
    owner_id,
    payout_method_id,
    requested_by_user_id,
    status,
    requested_amount_cents,
    fee_cents,
    net_amount_cents,
    idempotency_key,
    balance_snapshot,
    request_metadata,
    requested_at,
    created_at,
    updated_at
  )
  values (
    v_payout.organization_id,
    v_payout.owner_id,
    v_payout.id,
    auth.uid(),
    'requested',
    p_amount_cents,
    0,
    p_amount_cents,
    p_idempotency_key,
    jsonb_build_object(
      'grossCents', v_wallet.gross_cents,
      'pendingCents', v_wallet.pending_cents,
      'availableCents', v_wallet.available_cents,
      'reservedCents', v_wallet.reserved_cents,
      'blockedCents', v_wallet.blocked_cents,
      'version', v_wallet.version
    ),
    coalesce(p_request_metadata, '{}'::jsonb),
    v_now,
    v_now,
    v_now
  )
  returning *
  into v_withdrawal;

  insert into public.wallet_ledger (
    owner_id,
    organization_id,
    withdrawal_request_id,
    payout_method_id,
    entry_type,
    direction,
    status,
    amount_cents,
    actor_user_id,
    correlation_id,
    idempotency_key,
    source,
    metadata,
    created_at
  )
  values (
    v_withdrawal.owner_id,
    v_withdrawal.organization_id,
    v_withdrawal.id,
    v_withdrawal.payout_method_id,
    'withdrawal_reservation',
    'debit',
    'reserved',
    v_withdrawal.requested_amount_cents,
    auth.uid(),
    v_withdrawal.correlation_id,
    'withdrawal:reservation:' || v_withdrawal.id::text,
    'owner_withdrawal_request',
    jsonb_build_object(
      'requestedAmountCents', v_withdrawal.requested_amount_cents,
      'requestedByUserId', auth.uid()
    ),
    v_now
  );

  update public.withdrawal_requests
     set status = 'queued_manual_settlement',
         reserved_at = v_now,
         queued_at = v_now,
         updated_at = v_now
   where id = v_withdrawal.id
  returning *
    into v_withdrawal;

  perform public.refresh_owner_wallet_summary(v_withdrawal.owner_id);

  return v_withdrawal;
end;
$$;

create or replace function public.resolve_owner_withdrawal_request(
  p_withdrawal_id uuid,
  p_resolution text,
  p_failure_reason text default null,
  p_provider_response jsonb default '{}'::jsonb
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_request public.withdrawal_requests%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_resolution text := lower(coalesce(p_resolution, ''));
begin
  if v_resolution not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'unsupported withdrawal resolution';
  end if;

  select *
    into v_request
  from public.withdrawal_requests
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'withdrawal request not found';
  end if;

  if auth.role() <> 'service_role' and not public.is_org_admin(v_request.organization_id) then
    raise exception 'withdrawal settlement access denied';
  end if;

  if v_request.status in ('succeeded', 'failed', 'cancelled') then
    if v_request.status = v_resolution then
      return v_request;
    end if;
    raise exception 'withdrawal request already finalized';
  end if;

  insert into public.wallet_ledger (
    owner_id,
    organization_id,
    withdrawal_request_id,
    payout_method_id,
    entry_type,
    direction,
    status,
    amount_cents,
    actor_user_id,
    correlation_id,
    idempotency_key,
    source,
    metadata,
    created_at
  )
  values (
    v_request.owner_id,
    v_request.organization_id,
    v_request.id,
    v_request.payout_method_id,
    'withdrawal_reservation_release',
    'credit',
    'released',
    v_request.requested_amount_cents,
    auth.uid(),
    v_request.correlation_id,
    'withdrawal:release:' || v_request.id::text || ':' || v_resolution,
    'owner_withdrawal_resolution',
    jsonb_build_object(
      'resolution', v_resolution,
      'reason', p_failure_reason
    ),
    v_now
  )
  on conflict do nothing;

  if v_resolution = 'succeeded' then
    insert into public.wallet_ledger (
      owner_id,
      organization_id,
      withdrawal_request_id,
      payout_method_id,
      entry_type,
      direction,
      status,
      amount_cents,
      actor_user_id,
      correlation_id,
      idempotency_key,
      source,
      metadata,
      created_at
    )
    values (
      v_request.owner_id,
      v_request.organization_id,
      v_request.id,
      v_request.payout_method_id,
      'withdrawal_debit',
      'debit',
      'posted',
      v_request.requested_amount_cents,
      auth.uid(),
      v_request.correlation_id,
      'withdrawal:debit:' || v_request.id::text,
      'owner_withdrawal_resolution',
      jsonb_build_object(
        'resolution', v_resolution
      ),
      v_now
    )
    on conflict do nothing;

    update public.withdrawal_requests
       set status = 'succeeded',
           sanitized_provider_response = coalesce(p_provider_response, '{}'::jsonb),
           settled_at = v_now,
           updated_at = v_now
     where id = v_request.id
    returning *
      into v_request;
  elsif v_resolution = 'failed' then
    update public.withdrawal_requests
       set status = 'failed',
           failure_reason = coalesce(p_failure_reason, failure_reason),
           sanitized_provider_response = coalesce(p_provider_response, '{}'::jsonb),
           failed_at = v_now,
           updated_at = v_now
     where id = v_request.id
    returning *
      into v_request;
  else
    update public.withdrawal_requests
       set status = 'cancelled',
           failure_reason = coalesce(p_failure_reason, failure_reason),
           sanitized_provider_response = coalesce(p_provider_response, '{}'::jsonb),
           cancelled_at = v_now,
           updated_at = v_now
     where id = v_request.id
    returning *
      into v_request;
  end if;

  perform public.refresh_owner_wallet_summary(v_request.owner_id);

  return v_request;
end;
$$;

create or replace function public.prevent_wallet_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'wallet_ledger is append-only';
end;
$$;

drop trigger if exists trg_owner_profiles_set_updated_at on public.owner_profiles;
create trigger trg_owner_profiles_set_updated_at
before update on public.owner_profiles
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_owner_user_links_set_updated_at on public.owner_user_links;
create trigger trg_owner_user_links_set_updated_at
before update on public.owner_user_links
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_owner_property_links_set_updated_at on public.owner_property_links;
create trigger trg_owner_property_links_set_updated_at
before update on public.owner_property_links
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_owner_payout_methods_set_updated_at on public.owner_payout_methods;
create trigger trg_owner_payout_methods_set_updated_at
before update on public.owner_payout_methods
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_owner_wallets_set_updated_at on public.owner_wallets;
create trigger trg_owner_wallets_set_updated_at
before update on public.owner_wallets
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_withdrawal_requests_set_updated_at on public.withdrawal_requests;
create trigger trg_withdrawal_requests_set_updated_at
before update on public.withdrawal_requests
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_payment_allocations_set_updated_at on public.payment_allocations;
create trigger trg_payment_allocations_set_updated_at
before update on public.payment_allocations
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_create_owner_wallet_for_profile on public.owner_profiles;
create trigger trg_create_owner_wallet_for_profile
after insert on public.owner_profiles
for each row
execute function public.create_owner_wallet_for_profile();

drop trigger if exists trg_wallet_ledger_immutable on public.wallet_ledger;
create trigger trg_wallet_ledger_immutable
before update or delete on public.wallet_ledger
for each row
execute function public.prevent_wallet_ledger_mutation();

insert into public.owner_wallets (owner_id, organization_id)
select op.id, op.organization_id
from public.owner_profiles op
on conflict (owner_id) do nothing;

alter table public.owner_profiles enable row level security;
alter table public.owner_user_links enable row level security;
alter table public.owner_property_links enable row level security;
alter table public.owner_payout_methods enable row level security;
alter table public.owner_wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.payment_allocations enable row level security;

drop policy if exists owner_profiles_select_owner on public.owner_profiles;
create policy owner_profiles_select_owner
on public.owner_profiles
for select
to authenticated
using (
  public.is_owner_member(id)
  or public.is_org_admin(organization_id)
);

drop policy if exists owner_user_links_select_owner on public.owner_user_links;
create policy owner_user_links_select_owner
on public.owner_user_links
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

drop policy if exists owner_property_links_select_owner on public.owner_property_links;
create policy owner_property_links_select_owner
on public.owner_property_links
for select
to authenticated
using (
  public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

drop policy if exists owner_payout_methods_select_owner on public.owner_payout_methods;
create policy owner_payout_methods_select_owner
on public.owner_payout_methods
for select
to authenticated
using (
  public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

drop policy if exists owner_wallets_select_owner on public.owner_wallets;
create policy owner_wallets_select_owner
on public.owner_wallets
for select
to authenticated
using (
  public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

drop policy if exists wallet_ledger_select_owner on public.wallet_ledger;
create policy wallet_ledger_select_owner
on public.wallet_ledger
for select
to authenticated
using (
  public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

drop policy if exists withdrawal_requests_select_owner on public.withdrawal_requests;
create policy withdrawal_requests_select_owner
on public.withdrawal_requests
for select
to authenticated
using (
  public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

drop policy if exists payment_allocations_select_owner on public.payment_allocations;
create policy payment_allocations_select_owner
on public.payment_allocations
for select
to authenticated
using (
  public.is_owner_member(owner_id)
  or public.is_org_admin(organization_id)
);

revoke all on function public.queue_owner_withdrawal_request(uuid, bigint, text, jsonb) from public;
grant execute on function public.queue_owner_withdrawal_request(uuid, bigint, text, jsonb) to authenticated, service_role;

revoke all on function public.resolve_owner_withdrawal_request(uuid, text, text, jsonb) from public;
grant execute on function public.resolve_owner_withdrawal_request(uuid, text, text, jsonb) to authenticated, service_role;

revoke all on function public.refresh_owner_wallet_summary(uuid) from public;
grant execute on function public.refresh_owner_wallet_summary(uuid) to authenticated, service_role;

revoke all on function public.current_owner_ids() from public;
grant execute on function public.current_owner_ids() to authenticated, service_role;

revoke all on function public.is_owner_member(uuid) from public;
grant execute on function public.is_owner_member(uuid) to authenticated, service_role;
