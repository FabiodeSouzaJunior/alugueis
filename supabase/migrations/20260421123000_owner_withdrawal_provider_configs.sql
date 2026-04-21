alter table public.withdrawal_requests
  add column if not exists provider_config_id uuid,
  add column if not exists provider_account_id text,
  add column if not exists provider_environment text,
  add column if not exists provider_config_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'withdrawal_requests_provider_config_id_fkey'
      and conrelid = 'public.withdrawal_requests'::regclass
  ) then
    alter table public.withdrawal_requests
      add constraint withdrawal_requests_provider_config_id_fkey
      foreign key (provider_config_id)
      references public.organization_payment_provider_configs(id)
      on delete restrict;
  end if;
end $$;

create index if not exists idx_withdrawal_requests_provider_config
  on public.withdrawal_requests (provider_config_id, created_at desc)
  where provider_config_id is not null;

create index if not exists idx_withdrawal_requests_provider_config_reconciliation
  on public.withdrawal_requests (provider_config_id, status, provider_next_retry_at, requested_at)
  where provider_config_id is not null
    and status in ('reserved', 'processing', 'provider_pending', 'queued_manual_settlement');

drop function if exists public.queue_owner_withdrawal_request(uuid, bigint, text, jsonb);
drop function if exists public.queue_owner_withdrawal_request(
  uuid,
  bigint,
  text,
  jsonb,
  uuid,
  text,
  text,
  jsonb
);

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
    and provider = 'abacatepay'
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
  v_provider_reference_id text := nullif(coalesce(p_provider_response->>'id', ''), '');
  v_provider_status text := nullif(coalesce(p_provider_response->>'status', ''), '');
  v_provider_end_to_end text := nullif(coalesce(p_provider_response->>'endToEndIdentifier', ''), '');
  v_provider_event_type text := nullif(coalesce(p_provider_response->>'webhookEventType', ''), '');
  v_provider_http_status integer := case
    when coalesce(p_provider_response->>'httpStatus', '') ~ '^[0-9]+$'
      then (p_provider_response->>'httpStatus')::integer
    else null
  end;
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

  if v_resolution = 'succeeded'
     and coalesce(v_provider_reference_id, v_request.provider_reference_id, '') = '' then
    raise exception 'provider reference id required for succeeded resolution';
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
      'reason', p_failure_reason,
      'providerConfigId', v_request.provider_config_id,
      'providerAccountId', v_request.provider_account_id,
      'providerEnvironment', v_request.provider_environment
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
        'resolution', v_resolution,
        'providerConfigId', v_request.provider_config_id,
        'providerAccountId', v_request.provider_account_id,
        'providerEnvironment', v_request.provider_environment
      ),
      v_now
    )
    on conflict do nothing;

    update public.withdrawal_requests
       set status = 'succeeded',
           failure_code = null,
           failure_reason = null,
           sanitized_provider_response = coalesce(p_provider_response, '{}'::jsonb),
           settled_at = v_now,
           updated_at = v_now,
           provider_reference_id = coalesce(v_provider_reference_id, provider_reference_id),
           provider_status = coalesce(v_provider_status, provider_status),
           provider_end_to_end_identifier = coalesce(v_provider_end_to_end, provider_end_to_end_identifier),
           provider_last_event_type = coalesce(v_provider_event_type, provider_last_event_type),
           provider_last_http_status = coalesce(v_provider_http_status, provider_last_http_status),
           provider_next_retry_at = null,
           provider_last_error = null,
           last_provider_sync_at = v_now
     where id = v_request.id
    returning *
      into v_request;
  elsif v_resolution = 'failed' then
    update public.withdrawal_requests
       set status = 'failed',
           failure_code = lower(coalesce(v_provider_status, 'failed')),
           failure_reason = coalesce(p_failure_reason, failure_reason),
           sanitized_provider_response = coalesce(p_provider_response, '{}'::jsonb),
           failed_at = v_now,
           updated_at = v_now,
           provider_reference_id = coalesce(v_provider_reference_id, provider_reference_id),
           provider_status = coalesce(v_provider_status, provider_status),
           provider_end_to_end_identifier = coalesce(v_provider_end_to_end, provider_end_to_end_identifier),
           provider_last_event_type = coalesce(v_provider_event_type, provider_last_event_type),
           provider_last_http_status = coalesce(v_provider_http_status, provider_last_http_status),
           provider_next_retry_at = null,
           provider_last_error = coalesce(p_failure_reason, provider_last_error),
           last_provider_sync_at = v_now
     where id = v_request.id
    returning *
      into v_request;
  else
    update public.withdrawal_requests
       set status = 'cancelled',
           failure_code = lower(coalesce(v_provider_status, 'cancelled')),
           failure_reason = coalesce(p_failure_reason, failure_reason),
           sanitized_provider_response = coalesce(p_provider_response, '{}'::jsonb),
           cancelled_at = v_now,
           updated_at = v_now,
           provider_reference_id = coalesce(v_provider_reference_id, provider_reference_id),
           provider_status = coalesce(v_provider_status, provider_status),
           provider_end_to_end_identifier = coalesce(v_provider_end_to_end, provider_end_to_end_identifier),
           provider_last_event_type = coalesce(v_provider_event_type, provider_last_event_type),
           provider_last_http_status = coalesce(v_provider_http_status, provider_last_http_status),
           provider_next_retry_at = null,
           provider_last_error = coalesce(p_failure_reason, provider_last_error),
           last_provider_sync_at = v_now
     where id = v_request.id
    returning *
      into v_request;
  end if;

  perform public.refresh_owner_wallet_summary(v_request.owner_id);

  return v_request;
end;
$$;

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

revoke all on function public.resolve_owner_withdrawal_request(uuid, text, text, jsonb) from public;
grant execute on function public.resolve_owner_withdrawal_request(uuid, text, text, jsonb)
  to authenticated, service_role;

