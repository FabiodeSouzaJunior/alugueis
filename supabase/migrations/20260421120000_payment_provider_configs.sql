create extension if not exists pgcrypto;

create table if not exists public.organization_payment_provider_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'abacatepay',
  is_active boolean not null default true,
  environment text not null default 'production',
  api_key_encrypted text not null,
  webhook_secret_encrypted text,
  webhook_public_key_encrypted text,
  provider_account_name text,
  provider_account_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.organization_payment_provider_configs
  add column if not exists organization_id uuid,
  add column if not exists provider text not null default 'abacatepay',
  add column if not exists is_active boolean not null default true,
  add column if not exists environment text not null default 'production',
  add column if not exists api_key_encrypted text,
  add column if not exists webhook_secret_encrypted text,
  add column if not exists webhook_public_key_encrypted text,
  add column if not exists provider_account_name text,
  add column if not exists provider_account_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_payment_provider_configs_organization_id_fkey'
      and conrelid = 'public.organization_payment_provider_configs'::regclass
  ) then
    alter table public.organization_payment_provider_configs
      add constraint organization_payment_provider_configs_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

alter table public.organization_payment_provider_configs
  drop constraint if exists organization_payment_provider_configs_provider_check;

alter table public.organization_payment_provider_configs
  add constraint organization_payment_provider_configs_provider_check
  check (provider in ('abacatepay'));

alter table public.organization_payment_provider_configs
  drop constraint if exists organization_payment_provider_configs_environment_check;

alter table public.organization_payment_provider_configs
  add constraint organization_payment_provider_configs_environment_check
  check (environment in ('production', 'sandbox', 'test', 'development'));

create unique index if not exists idx_organization_payment_provider_configs_one_active
  on public.organization_payment_provider_configs (organization_id, provider)
  where is_active is true;

create index if not exists idx_organization_payment_provider_configs_organization
  on public.organization_payment_provider_configs (organization_id, provider, is_active);

drop trigger if exists trg_organization_payment_provider_configs_set_updated_at
  on public.organization_payment_provider_configs;

create trigger trg_organization_payment_provider_configs_set_updated_at
before update on public.organization_payment_provider_configs
for each row execute function public.set_row_updated_at();

create or replace function public.encrypt_payment_provider_secret(
  p_secret text,
  p_encryption_key text
)
returns text
language plpgsql
set search_path = 'public'
as $$
begin
  if p_secret is null or p_secret = '' then
    return null;
  end if;

  if coalesce(length(p_encryption_key), 0) < 32 then
    raise exception 'payment provider encryption key must have at least 32 characters';
  end if;

  return encode(
    pgp_sym_encrypt(p_secret, p_encryption_key, 'cipher-algo=aes256'),
    'base64'
  );
end;
$$;

create or replace function public.decrypt_payment_provider_secret(
  p_encrypted_secret text,
  p_encryption_key text
)
returns text
language plpgsql
set search_path = 'public'
as $$
begin
  if p_encrypted_secret is null or p_encrypted_secret = '' then
    return null;
  end if;

  if coalesce(length(p_encryption_key), 0) < 32 then
    raise exception 'payment provider encryption key must have at least 32 characters';
  end if;

  return pgp_sym_decrypt(decode(p_encrypted_secret, 'base64'), p_encryption_key);
end;
$$;

create or replace function public.get_payment_provider_config_decrypted(
  p_config_id uuid default null,
  p_organization_id uuid default null,
  p_provider text default 'abacatepay',
  p_active_only boolean default false,
  p_encryption_key text default null
)
returns table (
  id uuid,
  organization_id uuid,
  provider text,
  is_active boolean,
  environment text,
  api_key text,
  webhook_secret text,
  webhook_public_key text,
  provider_account_name text,
  provider_account_id text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_provider text := lower(coalesce(nullif(trim(p_provider), ''), 'abacatepay'));
begin
  if auth.role() <> 'service_role' then
    raise exception 'payment provider config access denied';
  end if;

  if coalesce(length(p_encryption_key), 0) < 32 then
    raise exception 'payment provider encryption key must have at least 32 characters';
  end if;

  return query
  select
    c.id,
    c.organization_id,
    c.provider,
    c.is_active,
    c.environment,
    public.decrypt_payment_provider_secret(c.api_key_encrypted, p_encryption_key) as api_key,
    public.decrypt_payment_provider_secret(c.webhook_secret_encrypted, p_encryption_key) as webhook_secret,
    public.decrypt_payment_provider_secret(c.webhook_public_key_encrypted, p_encryption_key) as webhook_public_key,
    c.provider_account_name,
    c.provider_account_id,
    c.metadata,
    c.created_at,
    c.updated_at
  from public.organization_payment_provider_configs c
  where c.provider = v_provider
    and (p_config_id is null or c.id = p_config_id)
    and (p_config_id is not null or c.organization_id = p_organization_id)
    and (p_active_only is false or c.is_active is true)
  order by c.is_active desc, c.updated_at desc
  limit 1;
end;
$$;

alter table public.payment_gateway_checkouts
  add column if not exists provider_config_id uuid,
  add column if not exists provider_account_id text,
  add column if not exists provider_environment text,
  add column if not exists provider_config_snapshot jsonb not null default '{}'::jsonb;

alter table public.payment_gateway_webhook_events
  add column if not exists provider_config_id uuid,
  add column if not exists provider_account_id text,
  add column if not exists provider_environment text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_gateway_checkouts_provider_config_id_fkey'
      and conrelid = 'public.payment_gateway_checkouts'::regclass
  ) then
    alter table public.payment_gateway_checkouts
      add constraint payment_gateway_checkouts_provider_config_id_fkey
      foreign key (provider_config_id)
      references public.organization_payment_provider_configs(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_gateway_webhook_events_provider_config_id_fkey'
      and conrelid = 'public.payment_gateway_webhook_events'::regclass
  ) then
    alter table public.payment_gateway_webhook_events
      add constraint payment_gateway_webhook_events_provider_config_id_fkey
      foreign key (provider_config_id)
      references public.organization_payment_provider_configs(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_payment_gateway_checkouts_provider_config
  on public.payment_gateway_checkouts (provider_config_id, created_at desc)
  where provider_config_id is not null;

create index if not exists idx_payment_gateway_webhook_events_provider_config
  on public.payment_gateway_webhook_events (provider_config_id, received_at desc)
  where provider_config_id is not null;

drop index if exists public.idx_payment_gateway_webhook_events_provider_event_id;

create unique index if not exists idx_payment_gateway_webhook_events_provider_config_event_id
  on public.payment_gateway_webhook_events (provider, provider_config_id, provider_event_id)
  where provider_config_id is not null and provider_event_id is not null;

create unique index if not exists idx_payment_gateway_webhook_events_provider_event_id_legacy
  on public.payment_gateway_webhook_events (provider, provider_event_id)
  where provider_config_id is null and provider_event_id is not null;

alter table public.organization_payment_provider_configs enable row level security;

revoke all on table public.organization_payment_provider_configs from anon, authenticated;
grant select, insert, update, delete on table public.organization_payment_provider_configs to service_role;

revoke all on function public.encrypt_payment_provider_secret(text, text) from public;
revoke all on function public.decrypt_payment_provider_secret(text, text) from public;
revoke all on function public.get_payment_provider_config_decrypted(uuid, uuid, text, boolean, text) from public;

grant execute on function public.encrypt_payment_provider_secret(text, text) to service_role;
grant execute on function public.decrypt_payment_provider_secret(text, text) to service_role;
grant execute on function public.get_payment_provider_config_decrypted(uuid, uuid, text, boolean, text) to service_role;

