# AbacatePay - Config por organizacao

Use estes SQLs apenas em ambiente administrativo/backend. Nunca exponha os
segredos no frontend.

## Cadastrar chave AbacatePay de uma organizacao

Substitua os valores entre `<...>` antes de executar. A mesma
`PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY` precisa estar configurada no backend.

```sql
insert into public.organization_payment_provider_configs (
  organization_id,
  provider,
  is_active,
  environment,
  api_key_encrypted,
  webhook_secret_encrypted,
  webhook_public_key_encrypted,
  provider_account_name,
  provider_account_id,
  metadata
)
values (
  '<organization_id>'::uuid,
  'abacatepay',
  true,
  'production',
  public.encrypt_payment_provider_secret('<abacatepay_api_key>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>'),
  public.encrypt_payment_provider_secret('<webhook_secret_ou_null>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>'),
  public.encrypt_payment_provider_secret('<webhook_public_key_ou_null>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>'),
  '<nome_da_conta>',
  '<id_da_conta_abacatepay>',
  jsonb_build_object('createdVia', 'admin_sql')
);
```

## Trocar chave ativa de uma organizacao

```sql
begin;

update public.organization_payment_provider_configs
   set is_active = false,
       updated_at = timezone('utc', now())
 where organization_id = '<organization_id>'::uuid
   and provider = 'abacatepay'
   and is_active is true;

insert into public.organization_payment_provider_configs (
  organization_id,
  provider,
  is_active,
  environment,
  api_key_encrypted,
  webhook_secret_encrypted,
  webhook_public_key_encrypted,
  provider_account_name,
  provider_account_id,
  metadata
)
values (
  '<organization_id>'::uuid,
  'abacatepay',
  true,
  'production',
  public.encrypt_payment_provider_secret('<nova_api_key>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>'),
  public.encrypt_payment_provider_secret('<novo_webhook_secret_ou_null>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>'),
  public.encrypt_payment_provider_secret('<nova_webhook_public_key_ou_null>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>'),
  '<nome_da_conta>',
  '<id_da_conta_abacatepay>',
  jsonb_build_object('rotatedAt', timezone('utc', now()))
);

commit;
```

## Conferir qual config foi usada em cada saque

```sql
select
  wr.id as withdrawal_id,
  wr.organization_id,
  wr.owner_id,
  wr.status,
  wr.requested_amount_cents,
  wr.provider_config_id,
  wr.provider_account_id,
  wr.provider_environment,
  wr.provider_reference_id,
  wr.provider_status,
  wr.created_at,
  wr.updated_at,
  opc.provider_account_name,
  opc.is_active as provider_config_still_active
from public.withdrawal_requests wr
left join public.organization_payment_provider_configs opc
  on opc.id = wr.provider_config_id
order by wr.created_at desc;
```

## Validar saques pendentes sem config vinculada

```sql
select id, organization_id, owner_id, status, created_at
from public.withdrawal_requests
where status in ('reserved', 'processing', 'provider_pending', 'queued_manual_settlement')
  and provider_config_id is null
order by created_at;
```

## URL de webhook por configuracao

```text
https://seu-dominio.com/api/webhooks/abacatepay?providerConfigId=<provider_config_id>
```

