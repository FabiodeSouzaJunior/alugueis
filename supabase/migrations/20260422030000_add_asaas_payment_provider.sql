alter table public.organization_payment_provider_configs
  drop constraint if exists organization_payment_provider_configs_provider_check;

alter table public.organization_payment_provider_configs
  add constraint organization_payment_provider_configs_provider_check
  check (provider in ('abacatepay', 'asaas'));

create index if not exists idx_organization_payment_provider_configs_active_gateway
  on public.organization_payment_provider_configs (organization_id, is_active, updated_at desc)
  where is_active is true
    and provider in ('abacatepay', 'asaas');

create or replace function public.queue_owner_withdrawal_request(
  p_payout_method_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_request_metadata jsonb default '{}'::jsonb,
  p_provider_config_id uuid default null,
  p_provider_account_id text default null,
  p_provider_environment text default null,
  p_provider_config_snapshot jsonb default '{}'::jsonb
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_payout public.owner_payout_methods%rowtype;
  v_provider_config public.organization_payment_provider_configs%rowtype;
  v_existing public.withdrawal_requests%rowtype;
  v_withdrawal public.withdrawal_requests%rowtype;
  v_wallet public.owner_wallets%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'idempotency key is required';
  end if;

  if p_amount_cents is null or p_amount_cents < 350 then
    raise exception 'minimum withdrawal amount is 350 cents';
  end if;

  if p_provider_config_id is null then
    raise exception 'payment provider config is required';
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
    into v_provider_config
  from public.organization_payment_provider_configs
  where id = p_provider_config_id
    and organization_id = v_payout.organization_id
    and provider in ('abacatepay', 'asaas')
  limit 1;

  if not found then
    raise exception 'payment provider config not found for withdrawal organization';
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
    provider_config_id,
    provider_account_id,
    provider_environment,
    provider_config_snapshot,
    requested_at,
    created_at,
    updated_at,
    provider_attempt_count,
    provider_next_retry_at,
    provider_last_error
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
    v_provider_config.id,
    coalesce(nullif(p_provider_account_id, ''), v_provider_config.provider_account_id),
    coalesce(nullif(p_provider_environment, ''), v_provider_config.environment),
    coalesce(p_provider_config_snapshot, '{}'::jsonb),
    v_now,
    v_now,
    v_now,
    0,
    v_now,
    null
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
      'requestedByUserId', auth.uid(),
      'providerConfigId', v_withdrawal.provider_config_id,
      'providerAccountId', v_withdrawal.provider_account_id,
      'providerEnvironment', v_withdrawal.provider_environment
    ),
    v_now
  );

  update public.withdrawal_requests
     set status = 'reserved',
         reserved_at = v_now,
         updated_at = v_now,
         provider_next_retry_at = v_now
   where id = v_withdrawal.id
  returning *
    into v_withdrawal;

  perform public.refresh_owner_wallet_summary(v_withdrawal.owner_id);

  return v_withdrawal;
end;
$function$;

revoke all on function public.queue_owner_withdrawal_request(
  uuid,
  bigint,
  text,
  jsonb,
  uuid,
  text,
  text,
  jsonb
) from public;

grant execute on function public.queue_owner_withdrawal_request(
  uuid,
  bigint,
  text,
  jsonb,
  uuid,
  text,
  text,
  jsonb
) to authenticated, service_role;
