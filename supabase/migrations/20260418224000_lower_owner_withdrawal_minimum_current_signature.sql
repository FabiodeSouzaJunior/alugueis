create or replace function public.queue_owner_withdrawal_request(
  p_payout_method_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_request_metadata jsonb default '{}'::jsonb
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if p_amount_cents is null or p_amount_cents < 100 then
    raise exception 'minimum withdrawal amount is 100 cents';
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
$function$;
