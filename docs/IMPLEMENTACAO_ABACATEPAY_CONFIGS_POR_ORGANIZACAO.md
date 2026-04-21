# Implementacao - AbacatePay por organizacao

Este documento resume as mudancas feitas para remover a dependencia de uma
chave global da AbacatePay e passar a usar credenciais dinamicas por
organizacao/cliente do SaaS.

## Objetivo da alteracao

Antes, o fluxo de pagamentos usava uma credencial global da AbacatePay via
variaveis como `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET` e
`ABACATEPAY_WEBHOOK_PUBLIC_KEY`.

Depois desta alteracao:

- cada organizacao passa a ter sua propria configuracao AbacatePay no banco;
- checkouts sao criados com a credencial da organizacao dona do pagamento;
- reconciliacao usa a mesma configuracao salva no checkout original;
- webhook identifica a configuracao usada antes de validar/processar;
- a chave global da AbacatePay nao e mais usada no fluxo normal;
- credenciais sensiveis nao sao enviadas ao frontend;
- headers e query params sensiveis de webhooks sao mascarados antes de salvar.

## Arquivos criados

### `features/pagamentos/provider-configs.js`

Novo repositorio central para resolver configuracoes de providers de pagamento.

Funcoes principais:

- `getActivePaymentProviderConfigByOrganization(organizationId, provider)`
  - busca a configuracao ativa da organizacao;
  - valida existencia;
  - bloqueia configuracao inativa;
  - retorna credenciais descriptografadas apenas para uso backend.

- `getPaymentProviderConfigById(configId, provider, options)`
  - busca configuracao especifica por `id`;
  - usada em reconciliacao e webhook para manter o vinculo com a conta original;
  - permite ler configuracoes inativas para checkouts antigos.

- `buildPaymentProviderConfigSnapshot(config)`
  - cria um snapshot seguro, sem chave/API secret;
  - usado para gravar metadados publicos no checkout.

Seguranca:

- exige `PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY`;
- valida tamanho minimo de 32 caracteres;
- nao expoe chaves ao frontend;
- logs nao imprimem credenciais.

### `supabase/migrations/20260421120000_payment_provider_configs.sql`

Migration nova com a estrutura central de credenciais.

Ela cria:

- extensao `pgcrypto`;
- tabela `organization_payment_provider_configs`;
- funcoes de criptografia/descriptografia:
  - `encrypt_payment_provider_secret`;
  - `decrypt_payment_provider_secret`;
- RPC backend:
  - `get_payment_provider_config_decrypted`;
- trigger de `updated_at`;
- RLS fechado para credenciais;
- grants apenas para `service_role`;
- campos novos em `payment_gateway_checkouts`;
- campos novos em `payment_gateway_webhook_events`;
- indices e constraints.

Tabela criada:

```sql
public.organization_payment_provider_configs
```

Campos principais:

- `id`
- `organization_id`
- `provider`
- `is_active`
- `environment`
- `api_key_encrypted`
- `webhook_secret_encrypted`
- `webhook_public_key_encrypted`
- `provider_account_name`
- `provider_account_id`
- `metadata`
- `created_at`
- `updated_at`

Campos adicionados em `payment_gateway_checkouts`:

- `provider_config_id`
- `provider_account_id`
- `provider_environment`
- `provider_config_snapshot`

Campos adicionados em `payment_gateway_webhook_events`:

- `provider_config_id`
- `provider_account_id`
- `provider_environment`

Indices/constraints importantes:

- uma configuracao ativa por `organization_id + provider`;
- indice para reconciliacao por `provider_config_id`;
- indice para lookup por checkout externo;
- indice para lookup por external id;
- unicidade de eventos de webhook por `provider + provider_config_id + provider_event_id`.

### `docs/ABACATEPAY_PROVIDER_CONFIG_SQL.md`

Documento operacional com exemplos SQL para:

- inserir credenciais de uma organizacao;
- trocar a chave da mesma conta AbacatePay;
- desativar configuracao antiga e ativar uma nova;
- configurar webhook por conta usando `providerConfigId`.

## Arquivos alterados

### `lib/abacatepay.js`

Antes:

- lia `process.env.ABACATEPAY_API_KEY` internamente;
- todas as chamadas usavam uma chave global.

Depois:

- todas as funcoes recebem `providerConfig`;
- a API key vem de `providerConfig.apiKey`;
- nao existe fallback para chave global;
- logs exibem apenas:
  - `providerConfigId`;
  - `providerAccountId`;
  - `providerEnvironment`;
- credencial sensivel nunca e logada.

Funcoes alteradas:

- `createAbacatePayBilling(providerConfig, payload)`
- `createAbacatePayPixQrCode(providerConfig, payload)`
- `checkAbacatePayPixQrCodeStatus(providerConfig, pixQrCodeId)`
- `listAbacatePayCheckouts(providerConfig, filters)`

### `features/pagamentos/service.js`

Este foi o principal arquivo alterado.

Mudancas no checkout:

- ao iniciar pagamento, o backend busca a configuracao ativa da organizacao com:
  - `getActivePaymentProviderConfigByOrganization`;
- o checkout e criado usando a credencial dessa configuracao;
- o registro em `payment_gateway_checkouts` salva:
  - `provider_config_id`;
  - `provider_account_id`;
  - `provider_environment`;
  - `provider_config_snapshot`;
- o payload enviado para AbacatePay tambem recebe metadata com:
  - `providerConfigId`;
  - `providerAccountId`;
  - `providerEnvironment`.

Mudancas no reuso de checkout:

- o reuso agora exige a mesma configuracao/provider account;
- o hash do checkout inclui:
  - `providerConfigId`;
  - `providerAccountId`;
  - `providerEnvironment`;
- `findReusableCheckout` filtra por:
  - mesmo pagamento;
  - mesmo tenant;
  - mesma organizacao;
  - mesmo modo;
  - mesmos valores;
  - mesma configuracao;
  - mesma conta provider;
  - mesmo ambiente.

Mudancas na reconciliacao:

- reconciliacao nao usa chave global;
- `fetchProviderCheckoutSnapshot` carrega a configuracao pelo
  `checkout.provider_config_id`;
- checkouts antigos/pendentes sao consultados com a credencial que gerou o
  checkout original;
- configuracoes inativas ainda podem ser carregadas por ID para reconciliar
  checkouts antigos.

Mudancas no webhook:

- o webhook tenta identificar a configuracao por:
  - `providerConfigId` na query string;
  - header `x-provider-config-id`;
  - header `x-abacatepay-provider-config-id`;
  - metadata do payload;
  - checkout interno vinculado;
- depois de identificar a configuracao, valida:
  - `webhook_secret`;
  - ou `webhook_public_key`;
- webhook sem segredo ou assinatura configurada e rejeitado;
- eventos de webhook salvam os campos:
  - `provider_config_id`;
  - `provider_account_id`;
  - `provider_environment`;
- headers sensiveis sao mascarados antes de salvar:
  - `authorization`;
  - `cookie`;
  - `x-webhook-secret`;
  - `x-abacatepay-secret`;
  - qualquer header contendo `secret` ou `api-key`;
- query params sensiveis tambem sao mascarados.

Mudancas na auditoria:

- eventos gravados por reconciliacao agora carregam a configuracao associada ao
  checkout;
- isso permite rastrear qual conta AbacatePay foi usada em cada atualizacao.

### `app/api/payments/reconcile/route.js`

Mudanca pequena:

- a rota de reconciliacao agora aceita `tenantId` via query string;
- esse valor e repassado para `reconcilePendingGatewayPayments`.

Exemplo:

```text
GET /api/payments/reconcile?organizationId=<org>&tenantId=<tenant>&limit=50
Authorization: Bearer <PAYMENT_RECONCILIATION_SECRET>
```

### `docs/SETUP.md`

Atualizado para remover a orientacao antiga de variaveis globais da AbacatePay.

Antes mencionava:

- `ABACATEPAY_API_KEY`;
- `ABACATEPAY_WEBHOOK_SECRET`;
- `ABACATEPAY_WEBHOOK_PUBLIC_KEY`.

Agora usa:

- `PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY`;
- credenciais AbacatePay cadastradas no banco;
- referencia a `docs/ABACATEPAY_PROVIDER_CONFIG_SQL.md`;
- webhook por configuracao:

```text
https://seu-dominio.com/api/payments/webhooks/abacatepay?providerConfigId=<id_da_config>
```

### `CORRIGIR_ERRO_502.md`

Atualizado para trocar a orientacao antiga de verificar `ABACATEPAY_API_KEY`.

Nova orientacao:

- verificar se a organizacao possui configuracao ativa em
  `organization_payment_provider_configs`.

## Variaveis de ambiente atuais

Variaveis AbacatePay globais removidas do fluxo normal:

- `ABACATEPAY_API_KEY`
- `ABACATEPAY_WEBHOOK_SECRET`
- `ABACATEPAY_WEBHOOK_PUBLIC_KEY`

Nova variavel obrigatoria:

```env
PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY=gere_um_valor_aleatorio_com_32_ou_mais_caracteres
```

Essa chave deve ser mantida apenas no backend. Ela precisa ser a mesma usada nos
SQLs operacionais para criptografar/descriptografar as credenciais.

## Fluxo novo de checkout

1. Usuario clica em pagar.
2. Backend autentica tenant.
3. Backend carrega o pagamento e valida organizacao/tenant.
4. Backend busca configuracao ativa AbacatePay da organizacao.
5. Backend calcula valores e modo de checkout.
6. Backend tenta reutilizar checkout somente se a configuracao tambem for a
   mesma.
7. Backend cria registro em `payment_gateway_checkouts` com snapshot da config.
8. Backend chama AbacatePay usando `providerConfig.apiKey`.
9. Backend salva resposta do provider.
10. Frontend recebe apenas dados seguros do checkout.

## Fluxo novo de reconciliacao

1. Backend lista checkouts pendentes.
2. Para cada checkout, pega `provider_config_id`.
3. Backend carrega a configuracao pelo ID salvo.
4. Backend consulta AbacatePay com a chave daquela configuracao.
5. Backend atualiza checkout/pagamento interno.
6. Backend grava evento de auditoria com a configuracao usada.

## Fluxo novo de webhook

1. AbacatePay chama a rota de webhook.
2. Backend le payload bruto.
3. Backend tenta identificar `providerConfigId`.
4. Backend localiza checkout interno, quando possivel.
5. Backend carrega a configuracao usada.
6. Backend valida secret ou assinatura da configuracao.
7. Backend salva evento de webhook com provider config.
8. Backend aplica status ao checkout/pagamento.

## Como cadastrar credenciais via SQL

Consultar:

```text
docs/ABACATEPAY_PROVIDER_CONFIG_SQL.md
```

Resumo do insert:

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
values (...);
```

Os campos sensiveis devem ser gravados com:

```sql
public.encrypt_payment_provider_secret('<segredo>', '<PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY>')
```

## Seguranca implementada

- credenciais ficam criptografadas no banco com `pgcrypto`;
- tabela de credenciais tem RLS habilitado;
- acesso direto a anon/authenticated foi revogado;
- leitura descriptografada acontece por RPC restrita a `service_role`;
- backend exige `PAYMENT_PROVIDER_CONFIG_ENCRYPTION_KEY`;
- frontend nao recebe credenciais;
- logs nao exibem API key;
- headers/query params sensiveis de webhook sao mascarados;
- reconciliacao usa a configuracao salva no checkout, nao a configuracao ativa
  atual por tentativa.

## Validacoes executadas

Comandos executados:

```powershell
node --check features\pagamentos\service.js
node --check lib\abacatepay.js
node --check features\pagamentos\provider-configs.js
npm run build
```

Resultado:

- os tres `node --check` passaram;
- `npm run build` passou com sucesso;
- `npm run lint` nao foi usado como validacao final porque o projeto ainda nao
  tem ESLint configurado e `next lint` abriu o assistente interativo.

Tambem foi feita busca por variaveis antigas:

```powershell
rg -n "ABACATEPAY_API_KEY|ABACATEPAY_WEBHOOK_SECRET|ABACATEPAY_WEBHOOK_PUBLIC_KEY|process\.env\.ABACATEPAY" .
```

Resultado:

- nenhum uso restante encontrado.

## Arquivos modificados no patch

Criados:

- `features/pagamentos/provider-configs.js`
- `supabase/migrations/20260421120000_payment_provider_configs.sql`
- `docs/ABACATEPAY_PROVIDER_CONFIG_SQL.md`
- `docs/IMPLEMENTACAO_ABACATEPAY_CONFIGS_POR_ORGANIZACAO.md`

Alterados:

- `lib/abacatepay.js`
- `features/pagamentos/service.js`
- `app/api/payments/reconcile/route.js`
- `docs/SETUP.md`
- `CORRIGIR_ERRO_502.md`

## Observacao sobre saque

Este repositorio nao tinha um fluxo de saque localizado durante a implementacao.
Mesmo assim, o repositorio criado em `provider-configs.js` e generico e deve ser
usado pelo futuro fluxo de saque administrativo para buscar a mesma configuracao
central da organizacao.

O padrao esperado para saque e:

1. identificar a organizacao do cliente;
2. chamar `getActivePaymentProviderConfigByOrganization(organizationId, "abacatepay")`;
3. executar a operacao AbacatePay com `providerConfig.apiKey`;
4. salvar `provider_config_id`, `provider_account_id` e `provider_environment`
   na transacao de saque.
