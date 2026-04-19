create or replace function public.effective_wallet_entry_available_at(
  p_entry_type text,
  p_available_at timestamptz,
  p_created_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_paid_at_text text;
  v_paid_at timestamptz;
  v_computed_available_at timestamptz;
begin
  if coalesce(p_entry_type, '') <> 'payment_credit' then
    return coalesce(p_available_at, p_created_at);
  end if;

  v_paid_at_text := nullif(trim(coalesce(p_metadata->>'paidAt', '')), '');

  begin
    v_paid_at := coalesce(v_paid_at_text::timestamptz, p_created_at);
  exception
    when others then
      v_paid_at := p_created_at;
  end;

  if v_paid_at is null then
    return coalesce(p_available_at, p_created_at);
  end if;

  v_computed_available_at := v_paid_at + interval '20 seconds';

  if p_available_at is null then
    return v_computed_available_at;
  end if;

  return least(p_available_at, v_computed_available_at);
end;
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
    coalesce(sum(case when entry_type = 'payment_credit' and direction = 'credit' and public.effective_wallet_entry_available_at(entry_type, available_at, created_at, metadata) > v_now then amount_cents else 0 end), 0),
    coalesce(sum(case when entry_type in ('payment_credit', 'manual_adjustment_credit') and direction = 'credit' and public.effective_wallet_entry_available_at(entry_type, available_at, created_at, metadata) <= v_now then amount_cents else 0 end), 0),
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

grant execute on function public.effective_wallet_entry_available_at(text, timestamptz, timestamptz, jsonb) to authenticated, service_role;
