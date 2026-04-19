create or replace function public.queue_owner_withdrawal_request(
  p_owner_id uuid,
  p_payout_method_id uuid,
  p_amount_cents bigint,
  p_idempotency_key text,
  p_requested_by uuid,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.owner_wallets%rowtype;
  v_payout_method public.owner_payout_methods%rowtype;
  v_withdrawal public.withdrawal_requests%rowtype;
  v_available_cents bigint;
  v_now timestamptz := timezone('utc', now());
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;

  if p_payout_method_id is null then
    raise exception 'payout_method_id is required';
  end if;

  if p_amount_cents is null or p_amount_cents < 100 then
    raise exception 'minimum withdrawal amount is 100 cents';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key is required';
  end if;

  select *
  into v_payout_method
  from public.owner_payout_methods
  where id = p_payout_method_id
    and owner_id = p_owner_id
    and active is true
  for update;

  if not found then
    raise exception 'owner payout method access denied';
  end if;

  insert into public.owner_wallets (owner_id, organization_id)
  select p_owner_id, v_payout_method.organization_id
  where not exists (
    select 1
    from public.owner_wallets ow
    where ow.owner_id = p_owner_id
  );

  select *
  into v_wallet
  from public.owner_wallets
  where owner_id = p_owner_id
  for update;

  perform public.refresh_owner_wallet_summary(p_owner_id);

  select *
  into v_wallet
  from public.owner_wallets
  where owner_id = p_owner_id
  for update;

  v_available_cents := coalesce(v_wallet.available_cents, 0);

  if v_available_cents < p_amount_cents then
    raise exception 'insufficient available balance';
  end if;

  insert into public.withdrawal_requests (
    owner_id,
    organization_id,
    payout_method_id,
    requested_by_user_id,
    requested_amount_cents,
    status,
    idempotency_key,
    note,
    metadata,
    balance_snapshot,
    created_at,
    updated_at
  )
  values (
    p_owner_id,
    v_wallet.organization_id,
    p_payout_method_id,
    p_requested_by,
    p_amount_cents,
    'queued_manual_settlement',
    p_idempotency_key,
    p_note,
    coalesce(p_metadata, '{}'::jsonb),
    jsonb_build_object(
      'grossCents', coalesce(v_wallet.gross_cents, 0),
      'pendingCents', coalesce(v_wallet.pending_cents, 0),
      'availableCents', coalesce(v_wallet.available_cents, 0),
      'reservedCents', coalesce(v_wallet.reserved_cents, 0),
      'blockedCents', coalesce(v_wallet.blocked_cents, 0),
      'requestedAmountCents', p_amount_cents
    ),
    v_now,
    v_now
  )
  on conflict (owner_id, idempotency_key)
  do update set updated_at = excluded.updated_at
  returning * into v_withdrawal;

  if v_withdrawal.status = 'queued_manual_settlement'
     and coalesce(v_withdrawal.balance_snapshot->>'requestedAmountCents', '') <> p_amount_cents::text then
    raise exception 'idempotency key already used with different amount';
  end if;

  if not exists (
    select 1
    from public.wallet_ledger wl
    where wl.withdrawal_request_id = v_withdrawal.id
      and wl.entry_type = 'withdrawal_reservation'
  ) then
    insert into public.wallet_ledger (
      owner_id,
      organization_id,
      payout_method_id,
      withdrawal_request_id,
      amount_cents,
      currency,
      direction,
      entry_type,
      status,
      actor_user_id,
      correlation_id,
      idempotency_key,
      metadata,
      created_at
    )
    values (
      p_owner_id,
      v_wallet.organization_id,
      p_payout_method_id,
      v_withdrawal.id,
      p_amount_cents,
      'BRL',
      'debit',
      'withdrawal_reservation',
      'posted',
      p_requested_by,
      coalesce(v_withdrawal.correlation_id, v_withdrawal.id::text),
      'ledger:withdrawal-reservation:' || v_withdrawal.id::text,
      jsonb_build_object(
        'requestedAmountCents', p_amount_cents,
        'payoutMethodId', p_payout_method_id
      ),
      v_now
    );
  end if;

  update public.owner_wallets
  set reserved_cents = coalesce(reserved_cents, 0) + p_amount_cents,
      available_cents = greatest(coalesce(available_cents, 0) - p_amount_cents, 0),
      version = version + 1,
      updated_at = v_now
  where owner_id = p_owner_id;

  select *
  into v_withdrawal
  from public.withdrawal_requests
  where id = v_withdrawal.id;

  return v_withdrawal;
end;
$$;
