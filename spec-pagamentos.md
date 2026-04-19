# Spec — Módulo de Pagamentos

> Última atualização: 10 de abril de 2026  
> Escopo: Página `/pagamentos`, página `/inadimplentes`, APIs, banco de dados e serviços relacionados.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Banco de dados](#2-banco-de-dados)
3. [Lógica de negócio central](#3-lógica-de-negócio-central)
4. [APIs REST](#4-apis-rest)
5. [Serviços de servidor](#5-serviços-de-servidor)
6. [Biblioteca do cliente (lib/api.js)](#6-biblioteca-do-cliente-libapiis)
7. [Página de Pagamentos (`/pagamentos`)](#7-página-de-pagamentos-pagamentos)
8. [Página de Inadimplentes (`/inadimplentes`)](#8-página-de-inadimplentes-inadimplentes)
9. [Formulário de Pagamento](#9-formulário-de-pagamento)
10. [Componentes de Analytics — Pagamentos](#10-componentes-de-analytics--pagamentos)
11. [Componentes de Inadimplência](#11-componentes-de-inadimplência)
12. [Notificações disparadas por pagamentos](#12-notificações-disparadas-por-pagamentos)
13. [Responsabilidade financeira (multi-inquilino)](#13-responsabilidade-financeira-multi-inquilino)
14. [Fluxo de dados completo](#14-fluxo-de-dados-completo)

---

## 1. Visão geral

O módulo de pagamentos cobre todo o ciclo financeiro de aluguéis no SaaS:

| Funcionalidade | Onde |
|---|---|
| Registrar / editar pagamentos | `/pagamentos` |
| Visualizar analytics de recebimentos | `/pagamentos` (aba Analytics) |
| Listar inadimplentes (pendentes + atrasados) | `/inadimplentes` |
| Analytics de inadimplência | `/inadimplentes` (aba Analytics) |
| APIs REST de CRUD | `/api/payments/**` |
| Geração automática de cobranças por período | `/api/payments/generate`, `/api/payments/sync` |
| Histórico de pagamentos por inquilino | `/api/payments/tenant-history` |

O sistema lida com dois valores distintos para cada pagamento:

- **`expectedAmount`** (`expected_amount` no BD): valor do aluguel devido (extraído do cadastro do inquilino via `rentValue`).
- **`amount`**: valor efetivamente pago.

A diferença entre os dois determina o **saldo pendente** e o **status**.

---

## 2. Banco de dados

### 2.1 Tabela `payments` (Supabase / PostgreSQL)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `TEXT` (PK) | Identificador único gerado por `generateId()` |
| `tenant_id` | `TEXT` (FK → `tenants.id`) | Referência ao inquilino |
| `month` | `INTEGER` | Mês de referência (1–12) |
| `year` | `INTEGER` | Ano de referência |
| `due_date` | `DATE` | Data de vencimento (padrão: dia 10 do mês) |
| `payment_date` | `DATE` | Data em que o pagamento foi realizado (null = não pago) |
| `amount` | `NUMERIC(10,2)` | Valor efetivamente pago |
| `expected_amount` | `NUMERIC(10,2)` | Valor do aluguel devido no período |
| `status` | `TEXT` | `'pago'` \| `'pendente'` \| `'atrasado'` |
| `organization_id` | `TEXT` (FK) | Presente quando o schema multi-tenant está ativo (coluna opcional) |
| `created_at` | `TIMESTAMPTZ` | Criação automática |
| `updated_at` | `TIMESTAMPTZ` | Atualizado a cada `UPDATE` |

> **Restrição de unicidade**: existe uma constraint `unique_payment` (ou equivalente) que impede dois registros com o mesmo `(tenant_id, month, year)`. Conflitos de `INSERT` são tratados como `UPDATE` no servidor.

### 2.2 Colunas relacionadas em `tenants`

| Coluna | Tipo | Relevância para pagamentos |
|---|---|---|
| `rent_value` | `NUMERIC` | Fonte do `expected_amount` |
| `start_date` | `DATE` | Define a partir de quando gerar cobranças |
| `status` | `TEXT` | Apenas inquilinos `'ativo'` entram na geração automática |
| `is_payment_responsible` | `BOOLEAN` | Filtra quem é o responsável financeiro do imóvel |
| `property_id` | `TEXT` (FK) | Vínculo com imóvel para filtros na página |
| `kitnet_number` | `TEXT` | Exibido na tabela de pagamentos |

### 2.3 Colunas relacionadas em `properties`

| Coluna | Relevância |
|---|---|
| `payment_responsible` | Define responsável de pagamento a nível de imóvel |

### 2.4 Migração — `add-expected-amount.sql`

```sql
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS expected_amount numeric(10,2);

UPDATE public.payments
SET expected_amount = amount
WHERE expected_amount IS NULL;
```

### 2.5 Migração — `tenants-full-form-and-payment-responsible.sql`

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_payment_responsible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS payment_responsible TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_payment_responsible ON tenants (is_payment_responsible);
```

### 2.6 Índices relevantes

```sql
CREATE INDEX IF NOT EXISTS tenants_payment_responsible_true_idx
  ON public.tenants (is_payment_responsible)
  WHERE is_payment_responsible = true;

-- (presentes em performance-indexes.sql)
CREATE INDEX IF NOT EXISTS tenants_status_property_idx
  ON public.tenants (status, property_id);
```

---

## 3. Lógica de negócio central

Localizada em `lib/calculations.js` e `server/modules/financial/payment-responsibility.core.cjs`.

### 3.1 Determinação do status de um pagamento

```
valorDevido  = expectedAmount ?? amount
valorPago    = amount

SE valorPago >= valorDevido E valorDevido > 0  → "pago"
SE valorPago > 0 E valorPago < valorDevido     → "pendente"
SE valorPago === 0:
   SE dueDate < hoje                           → "atrasado"
   SENÃO                                       → "pendente"
```

Funções envolvidas:
- `getPaymentStatus(payment)` — `lib/calculations.js`
- `getPendingAmount(payment)` — retorna `Math.max(0, valorDevido - valorPago)`
- `getPaymentRowData(payment, valorDevido)` — calcula status e saldo em contextos de tabela

### 3.2 Valor devido com condomínio

Nas páginas front-end, o `valorDevido` é **composto**:

```js
const valorDevido = inquilino.rentValue + (
  condominiumChargeWithRent
    ? condominiumByPeriod[`${ano}-${mes}`] ?? 0
    : 0
);
```

O rateio do condomínio por período vem de `fetchCondominiumOverview({ historyMonths: 60 })`.

### 3.3 Status de cores (paleta CSS)

| Status | Badge | Linha da tabela |
|---|---|---|
| `pago` | `emerald` (verde) | `bg-emerald-500/5` |
| `pendente` | `amber` (amarelo) | `bg-amber-500/10` |
| `atrasado` | `red` (vermelho) | `bg-red-500/10` |

---

## 4. APIs REST

Base path: `/api/payments`

### 4.1 `GET /api/payments`

Lista pagamentos financeiros com filtros opcionais.

**Query params:**

| Param | Tipo | Descrição |
|---|---|---|
| `month` | `number` | Filtra pelo mês |
| `year` | `number` | Filtra pelo ano |
| `tenantId` | `string` | Filtra por inquilino específico |
| `openOnly` | `boolean` | Se `true`, retorna apenas pagamentos com saldo em aberto (`amount < expected_amount`) |

**Resposta:** `Payment[]`

> Apenas inquilinos que são **responsáveis financeiros** têm seus pagamentos retornados (ver seção 13).

---

### 4.2 `POST /api/payments`

Cria ou atualiza um pagamento. Se já existir um registro com o mesmo `(tenantId, month, year)`, realiza `UPDATE` em vez de `INSERT`.

**Body:**

```json
{
  "tenantId": "string",
  "month": 4,
  "year": 2026,
  "expectedAmount": 800.00,
  "amount": 800.00,
  "dueDate": "2026-04-10",
  "paymentDate": "2026-04-08",
  "status": "pago",
  "organizationId": "string (opcional)"
}
```

**Regras:**
- `tenantId` obrigatório; deve pertencer a um responsável financeiro.
- Se `paymentDate` preenchido, `status` é forçado para `"pago"` e `amount` = `expectedAmount`.
- `expected_amount` é buscado do cadastro do inquilino (`rent_value`) quando não informado.
- Dispara notificação de pagamento recebido (ver seção 12).

**Resposta:** `Payment` (objeto criado ou atualizado)

---

### 4.3 `GET /api/payments/[id]`

Retorna um pagamento pelo ID.

**Resposta:** `Payment` | `404`

---

### 4.4 `PUT /api/payments/[id]`

Atualiza um pagamento existente.

**Body:** mesmos campos do `POST`, parciais aceitos.

**Regras adicionais:**
- Se `amount > expectedAmount`, o `amount` é truncado ao `expectedAmount`.
- Se `status === "pago"`, `paymentDate` é preenchida automaticamente com a data atual se não informada.
- Dispara notificação se pagamento for quitado.

**Resposta:** `Payment` atualizado

---

### 4.5 `DELETE /api/payments/[id]`

Remove um pagamento pelo ID.

**Resposta:** `{ ok: true }`

---

### 4.6 `POST /api/payments/generate`

Gera pagamentos históricos para um inquilino específico, do `startDate` até o mês atual. Pagamentos já existentes são ignorados. Registros criados têm `status = 'pago'`.

**Body:**

```json
{
  "tenantId": "string",
  "rentValue": 800.00,
  "startDate": "2024-01-01",
  "organizationId": "string (opcional)"
}
```

**Resposta:** `Payment[]` (todos os pagamentos do inquilino após a operação)

---

### 4.7 `POST /api/payments/sync`

Sincroniza pagamentos históricos para **todos os inquilinos ativos** (ou um específico via `tenantId`). Idem ao `/generate`, mas em lote.

**Body:**

```json
{
  "tenantId": "string (opcional)",
  "organizationId": "string (opcional)"
}
```

**Resposta:**

```json
{
  "ok": true,
  "tenantsProcessed": 5,
  "syncedPayments": 12
}
```

---

### 4.8 `GET /api/payments/tenant-history`

Retorna o histórico de pagamentos de um inquilino.

**Query params:**

| Param | Tipo | Descrição |
|---|---|---|
| `tenantId` | `string` | **Obrigatório** |
| `openOnly` | `boolean` | Se `true`, retorna apenas pagamentos em aberto |

**Resposta:** `Payment[]`

---

## 5. Serviços de servidor

### 5.1 `payment-responsibility.service.js`

Localizado em `server/modules/financial/`.

Gerencia o conceito de **responsabilidade financeira**: somente o inquilino marcado como responsável pelo pagamento de um imóvel pode ter cobranças, pagamentos e histórico financeiro. Inclui cache de 10 segundos para o índice de responsabilidade.

Funções exportadas:

| Função | Descrição |
|---|---|
| `listFinancialTenants(filters)` | Lista inquilinos que são responsáveis financeiros |
| `listFinancialPayments(filters)` | Lista pagamentos apenas dos responsáveis financeiros |
| `assertFinancialTenantById(id)` | Valida e retorna o inquilino; lança erro se não for responsável |
| `getFinancialPaymentById(id)` | Busca pagamento validando responsabilidade financeira |
| `getFinancialResponsibilityIndex()` | Retorna/cacheia o índice de responsabilidade |
| `filterFinancialTenantIds(ids[])` | Filtra uma lista de IDs mantendo apenas os responsáveis |
| `invalidateFinancialResponsibilityCache()` | Invalida o cache manualmente |

### 5.2 `payment-generation.service.js`

Localizado em `server/modules/financial/`.

Funções exportadas:

| Função | Descrição |
|---|---|
| `ensurePaidPaymentsUntilCurrentMonth({ tenantId, rentValue, startDate, organizationId })` | Gera os pagamentos históricos faltantes de `startDate` até o mês atual com `status = 'pago'` |
| `buildMissingPaidPayments({ tenantId, rentValue, startDate, existingKeys })` | Função pura que retorna a lista de pagamentos que precisam ser criados |

**Lógica de vencimento:** dia 10 de cada mês (`getDueDateForPeriod(month, year)`).

---

## 6. Biblioteca do cliente (`lib/api.js`)

Funções disponíveis para consumo nas páginas (client-side):

| Função | Endpoint chamado | Descrição |
|---|---|---|
| `fetchPayments(params)` | `GET /api/payments` | Lista pagamentos com filtros |
| `fetchTenantPaymentHistory(tenantId, params)` | `GET /api/payments/tenant-history` | Histórico de um inquilino |
| `createPayment(payload)` | `POST /api/payments` | Cria pagamento |
| `updatePayment(id, payload)` | `PUT /api/payments/[id]` | Atualiza pagamento |
| `syncPaymentsHistory(payload)` | `POST /api/payments/sync` | Sincroniza histórico em lote |
| `generatePaymentsForTenant(tenantId, rentValue, startDate)` | `POST /api/payments/generate` | Gera histórico de um inquilino |

---

## 7. Página de Pagamentos (`/pagamentos`)

**Arquivo:** `app/(app)/pagamentos/page.js`  
**Componente principal:** `PagamentosContent` (wrapped em `<Suspense>`)

### 7.1 Estados gerenciados

| Estado | Tipo | Descrição |
|---|---|---|
| `payments` | `Payment[]` | Lista de pagamentos do período selecionado |
| `tenants` | `Tenant[]` | Inquilinos financeiros ativos |
| `properties` | `Property[]` | Imóveis (para filtros) |
| `reportMonth` | `number \| null` | Mês do filtro de período |
| `reportYear` | `number \| null` | Ano do filtro de período |
| `filterKitnet` | `string` | Filtro por número de kitnet |
| `filterPropertyId` | `string` | Filtro por imóvel |
| `filterTenantId` | `string` | Filtro por inquilino (via querystring `?tenantId=`) |
| `search` | `string` | Busca textual por nome ou kitnet |
| `dialogOpen` | `boolean` | Controla abertura do modal de registro |
| `editingPayment` | `Payment \| null` | Pagamento em edição |
| `expandedTenantId` | `string \| null` | Inquilino com histórico expandido na tabela |
| `tenantHistoryById` | `Record<id, Payment[]>` | Cache local do histórico expandido |
| `condominiumChargeWithRent` | `boolean` | Se condomínio é cobrado junto com aluguel |
| `condominiumByPeriod` | `Record<"ano-mes", number>` | Valor do rateio de condomínio por período |
| `activeView` | `"tabela" \| "analytics"` | Aba ativa da página |

### 7.2 Carregamento de dados

Ao montar (e sempre que `reportMonth` ou `reportYear` mudam), executa em paralelo:

```js
Promise.all([
  fetchPayments({ month, year }),
  fetchTenants({ financialOnly: true }),
  fetchProperties(),
  fetchCondominiumSettings(),
])
```

Em seguida, busca `fetchCondominiumOverview({ month, year, historyMonths: N })` para montar o `condominiumByPeriod`.

### 7.3 Filtros disponíveis

- **Período**: seletores de mês e ano + botões de navegação (← →) + botão "Mês atual"
- **Busca textual**: campo de busca por nome do inquilino ou número da kitnet
- **Kitnet**: select com kitnets presentes nos inquilinos
- **Imóvel**: select com imóveis vinculados aos inquilinos
- **Inquilino**: via querystring `?tenantId=` (redireciona da página de inquilinos)

### 7.4 Tabela de pagamentos

- Agrupada por **imóvel** (coluna `propertyName`)
- Linhas com cor de fundo por status (pago = verde, pendente = amarelo, atrasado = vermelho)
- Ao clicar em uma linha, expande o **histórico completo** do inquilino (busca lazy via `ensureTenantHistory`)
- Histórico expandido mostra: mês/ano, vencimento, data de pagamento, valor devido, valor pago, saldo, status
- Botão de edição (ícone lápis) na tabela principal e no histórico expandido

### 7.5 Modal de registro/edição

- Disparado pelo botão **"Registrar pagamento"** no `PageHeader` ou pelo botão de edição
- Usa o componente `PaymentForm`
- Ao salvar: cria se não existe, atualiza se já existe para `(tenantId, month, year)`
- Após salvar: invalida o cache do histórico do inquilino e recarrega a lista

### 7.6 Aba Analytics

Componentes renderizados quando `activeView === "analytics"`:

| Componente | Descrição |
|---|---|
| `PaymentsAnalyticsStats` | 6 KPIs: total de pagamentos, total recebido, pendente, atrasado, receita prevista, taxa de adimplência |
| `PaymentsStatusDistribution` | Gráfico de pizza (Recharts) por status: Pago / Pendente / Atrasado |
| `PaymentsRevenueTimeline` | Gráfico de barras agrupadas (Recharts): Previsto vs Recebido por período |
| `PaymentsRevenueProgress` | Barra de progresso de recebimento + 3 cards: Receita Prevista, Recebida, Em aberto |
| `PaymentsTopDebts` | Tabela com top 5 maiores devedores do período |
| `InsightCard` | Card genérico de insight contextual |

### 7.7 Cálculos do painel Analytics

Produzidos pelo `useMemo` `analyticsData`:

```
totalPagamentos   = filtered.length
totalRecebido     = Σ valorPago
receitaPrevista   = Σ valorDevido
totalPendente     = Σ pendente (status === "pendente")
totalAtrasado     = Σ pendente (status === "atrasado")
valorAberto       = totalPendente + totalAtrasado
taxaAdimplencia   = (countPago / totalPagamentos) * 100
```

---

## 8. Página de Inadimplentes (`/inadimplentes`)

**Arquivo:** `app/(app)/inadimplentes/page.js`  
**Componente principal:** `InadimplentesPage`

### 8.1 Diferença em relação à página de Pagamentos

| Aspecto | Pagamentos | Inadimplentes |
|---|---|---|
| Filtro padrão | Todos os status | Apenas `pendente` e `atrasado` (`openOnly: true`) |
| Agrupamento na tabela | Por imóvel | Por inquilino |
| Criação de pagamentos | Sim (modal no header) | Não (apenas edição) |
| Filtro de período no carregamento | Sim (recarrega com filtro) | Não (carrega tudo, filtra no cliente) |

### 8.2 Estados gerenciados

| Estado | Tipo | Descrição |
|---|---|---|
| `grouped` | `GroupedTenant[]` | Pagamentos agrupados por inquilino |
| `tenants` | `Tenant[]` | Inquilinos financeiros |
| `reportMonth` | `number \| null` | Filtro de mês (apenas para analytics) |
| `reportYear` | `number \| null` | Filtro de ano (apenas para analytics) |
| `expandedId` | `string \| null` | Inquilino com detalhe expandido |
| `condominiumChargeWithRent` | `boolean` | Configuração de cobrança de condomínio |
| `condominiumByPeriod` | `Record<"ano-mes", number>` | Rateio de condomínio por período |
| `tenantHistoryById` | `Record<id, Payment[]>` | Cache do histórico por inquilino |
| `activeView` | `"tabela" \| "analytics"` | Aba ativa |

### 8.3 Estrutura `GroupedTenant`

```js
{
  tenantId: string,
  tenantName: string,
  kitnetNumber: string,
  totalPendente: number,   // soma de todos os saldos em aberto
  payments: PaymentRow[]   // pagamentos pendentes/atrasados, ordem: mais recente primeiro
}
```

### 8.4 Regras de construção dos grupos (`buildGroupedByTenant`)

1. Para cada pagamento, calcula `valorDevido = rentValue + condomínio`
2. Aplica `getPaymentRowData` — gera `pendente`, `status`, etc.
3. Filtra: inclui apenas `status !== "pago"`
4. Agrupa por `tenantId`
5. Ordena grupos por `totalPendente` decrescente (maior devedor no topo)
6. Dentro de cada grupo, ordena pagamentos por ano/mês decrescente

### 8.5 Tabela de inadimplentes

- Uma linha por **inquilino** com `totalPendente`
- Clique na linha → expande detalhe com todos os pagamentos em aberto do inquilino
- Detalhe expandido carrega histórico via `fetchTenantPaymentHistory(tenantId, { openOnly: true })`
- Botão de edição em cada linha do detalhe expandido → abre `PaymentForm` para edição
- O modal de edição **apenas atualiza** (não cria novos pagamentos)

### 8.6 Filtro de período na tabela

Os selects de mês e ano na aba tabela **não** recarregam da API — filtram no cliente via `rowInPeriod(row, reportMonth, reportYear)`.

- `reportMonth === null` → todos os meses
- `reportYear === null` → todos os anos

### 8.7 Aba Analytics

Componentes renderizados quando `activeView !== "tabela"`:

| Componente | Descrição |
|---|---|
| `InadimplenciaStats` | 4 KPIs: total de inquilinos inadimplentes, valor total em débito, total atrasado, total pendente |
| `InadimplenciaStatusChart` | Gráfico de pizza: Pendente vs Atrasado |
| `InadimplenciaTimeline` | Gráfico de barras: evolução do valor em débito por período (todos os períodos, não filtrado) |
| `TopDebtorsList` | Top 5 maiores devedores por valor total pendente |
| `InsightCard` | Card de insight contextual |

O painel de período (seletores de mês/ano + navegação) é exibido apenas na aba analytics.

### 8.8 Cálculos do painel Analytics (`dashboardData`)

- KPIs e pizza usam o **período selecionado** (`reportMonth`, `reportYear`)
- Linha do tempo usa **todos os períodos** disponíveis (para mostrar evolução histórica)

```
totalInadimplentes  = count(grupos com pagamentos no período)
valorTotalDebito    = Σ totalPendente dos grupos no período
totalAtrasado       = Σ pendente das linhas com status === "atrasado" no período
totalPendente       = Σ pendente das linhas com status === "pendente" no período
top5                = 5 grupos com maior totalPendente no período
top5ByParcelas      = 5 grupos com maior número de parcelas em aberto no período
```

---

## 9. Formulário de Pagamento

**Arquivo:** `components/forms/payment-form.jsx`  
**Componente:** `PaymentForm`

### 9.1 Props

| Prop | Tipo | Descrição |
|---|---|---|
| `payment` | `Payment \| null` | Pagamento em edição (null = criação) |
| `tenants` | `Tenant[]` | Lista de inquilinos ativos |
| `properties` | `Property[]` | Lista de imóveis (para filtro de unidade) |
| `onSave` | `(payload) => void` | Callback ao submeter |
| `onCancel` | `() => void` | Callback ao cancelar |
| `saving` | `boolean` | Estado de loading |

### 9.2 Campos do formulário

| Campo | Tipo | Notas |
|---|---|---|
| **Inquilino** | `select` com busca textual (combo) | Exibe `nome — Kitnet X`, filtra apenas `status === "ativo"` |
| **Mês** | `select` (1–12) | Pré-preenchido com mês atual |
| **Ano** | `select` | Pré-preenchido com ano atual |
| **Valor devido** | `input currency` | Auto-preenchido com `rentValue` do inquilino selecionado |
| **Valor pago** | `input currency` | Valor efetivamente pago |
| **Vencimento** | `input date` | Pré-preenchido com dia 10 do mês atual |
| **Data de pagamento** | `input date` | Se preenchido, status vira `"pago"` automaticamente |

### 9.3 Validações

- Valor pago não pode ser negativo
- Valor pago **não pode** ser maior que o valor devido
- O `expectedAmount` enviado ao servidor é sempre o `rentValue` do inquilino (não o campo editado)
- Status é derivado da data de pagamento: `paymentDate ? "pago" : "pendente"`

### 9.4 Formatação monetária

Usa funções internas:
- `formatCurrencyInput(value)` — converte dígitos para formato `0,00`
- `parseCurrencyInput(value)` — converte `"1.234,56"` → `1234.56`

Exibe em formato pt-BR (`Intl.NumberFormat` com `minimumFractionDigits: 2`).

---

## 10. Componentes de Analytics — Pagamentos

Todos em `components/payments-analytics/`.

### `PaymentsAnalyticsStats`

Props: `totalPagamentos`, `totalRecebido`, `totalPendente`, `totalAtrasado`, `receitaPrevista`, `taxaAdimplencia`, `formatCurrency`

6 cards em grid responsivo (`sm:2 / lg:3 / xl:6`):

| Card | Ícone | Cor |
|---|---|---|
| Total de pagamentos | `Receipt` | Slate |
| Total recebido | `Banknote` | Emerald |
| Total pendente | `Clock` | Amber |
| Total atrasado | `AlertTriangle` | Red |
| Receita prevista | `TrendingUp` | Blue |
| Taxa de adimplência | `Percent` | Emerald |

---

### `PaymentsStatusDistribution`

Props: `data: [{ name, value, count }]`, `formatCurrency`

- Gráfico de **donut** (Recharts `PieChart`) com `innerRadius=70`, `outerRadius=95`
- Paleta fixa: Pago = `#10b981`, Pendente = `#f59e0b`, Atrasado = `#ef4444`
- Labels externos com nome + percentual
- Tooltip customizado com valor e contagem

---

### `PaymentsRevenueTimeline`

Props: `data: [{ periodKey, label, previsto, recebido }]`, `formatCurrency`

- Gráfico de **barras agrupadas** (Recharts `BarChart`)
- Barras: `previsto` (azul) e `recebido` (verde)
- Tooltip mostra previsto, recebido e % de recebimento
- Dados ordenados cronologicamente por `periodKey` (`ano-mes`)

---

### `PaymentsRevenueProgress`

Props: `receitaPrevista`, `receitaRecebida`, `valorAberto`, `formatCurrency`

- 3 cards: Receita prevista, Receita recebida, Em aberto
- Barra de progresso de recebimento com `%` calculado

---

### `PaymentsTopDebts`

Props: `items: [{ tenantId, tenantName, kitnetNumber, totalPendente, parcelasEmAberto }]`, `formatCurrency`

- Tabela com ranking dos top 5 devedores
- Número de parcelas em aberto
- Valor em débito em vermelho

---

## 11. Componentes de Inadimplência

Todos em `components/inadimplencia/`.

### `InadimplenciaStats`

Props: `totalInadimplentes`, `valorTotalDebito`, `totalAtrasado`, `totalPendente`, `countAtrasados`, `countPendentes`, `formatCurrency`

4 cards em grid `sm:2 / lg:4`:

| Card | Ícone | Cor |
|---|---|---|
| Total de inquilinos inadimplentes | `Users` | Slate |
| Valor total em débito | `DollarSign` | Red |
| Pagamentos atrasados | `AlertTriangle` | Red |
| Pagamentos apenas pendentes | `Clock` | Amber |

---

### `InadimplenciaStatusChart`

Gráfico de pizza com distribuição Pendente vs Atrasado.

---

### `InadimplenciaTimeline`

Props: `data: [{ periodKey, label, value }]`, `formatCurrency`

- Gráfico de **barras simples** (vermelho), mostrando valor total em débito por período
- Gradiente: `hsl(0 84% 58%)` (vermelho)
- Dados ordenados cronologicamente

---

### `TopDebtorsList`

Props: `items: [{ tenantId, tenantName, kitnetNumber, totalPendente }]`, `formatCurrency`

- Lista `<ul>` com ranking de devedores
- Exibe nome, kitnet e valor em débito (vermelho)

---

## 12. Notificações disparadas por pagamentos

Quando um pagamento é **quitado** (via `POST` ou `PUT /api/payments`), o servidor dispara uma notificação assíncrona:

```js
createNotification({
  type: amount >= 2000 ? "payment_high_value" : "payment_received",
  title: "Pagamento recebido",
  message: `${tenantName} — Kitnet X — R$ XX,XX`,
  relatedEntity: "payment",
  relatedId: id,
  linkHref: "/pagamentos",
})
```

**Tipos de notificação** (definidos em `lib/notificationTypes.js`):

| Tipo | Ícone | Descrição |
|---|---|---|
| `payment_received` | `CreditCard` (verde) | Pagamento padrão recebido |
| `payment_high_value` | `CreditCard` (verde) | Pagamento de alto valor (≥ R$ 2.000,00) |

A criação de notificação é feita com `.catch(() => {})` — **não bloqueia** a resposta da API em caso de falha.

---

## 13. Responsabilidade financeira (multi-inquilino)

O sistema suporta imóveis com múltiplos inquilinos, mas apenas **um é o responsável financeiro** — quem paga o aluguel. Isso é controlado pelo campo `is_payment_responsible` em `tenants` e/ou `payment_responsible` em `properties`.

O **índice de responsabilidade financeira** é construído por `payment-responsibility.core.cjs` a partir de:
- `tenants.is_payment_responsible`
- `property_units.tenant_id`
- `properties.payment_responsible`

Cache em memória de **10 segundos** no servidor (`FINANCIAL_RESPONSIBILITY_CACHE_MS`).

**Impacto nas APIs:**
- `GET /api/payments` → retorna apenas pagamentos de inquilinos responsáveis
- `POST /api/payments` → valida que o `tenantId` é responsável financeiro
- `PUT /api/payments/[id]` → valida a responsabilidade antes de atualizar
- `GET /api/payments/tenant-history` → valida o `tenantId`

---

## 14. Fluxo de dados completo

### Registrar um pagamento (usuário)

```
Usuário abre modal (botão "Registrar pagamento")
  → PaymentForm (estado local)
  → handleSave() na página
    → verifica se existe pagamento para (tenantId, month, year)
    → createPayment() ou updatePayment() via lib/api.js
      → POST /api/payments ou PUT /api/payments/[id]
        → assertFinancialTenantById (validação)
        → INSERT ou UPDATE na tabela payments
        → createNotification (se pago)
    → load() recarrega lista
    → invalida cache de histórico do inquilino
```

### Visualizar inadimplentes

```
InadimplentesPage monta
  → fetchPayments({ openOnly: true })       — apenas em aberto
  → fetchTenants({ financialOnly: true })
  → fetchCondominiumSettings()
  → fetchCondominiumOverview({ historyMonths: 60 })
  → buildGroupedByTenant()                  — agrupa e calcula saldos
  → renderiza tabela agrupada por inquilino

Usuário clica em inquilino
  → ensureTenantHistory(tenantId)
    → fetchTenantPaymentHistory(tenantId, { openOnly: true })
  → expande detalhe com lista de pagamentos em aberto

Usuário muda para aba Analytics
  → dashboardData (useMemo) recalcula KPIs filtrados pelo período
  → InadimplenciaStats, InadimplenciaStatusChart, InadimplenciaTimeline, TopDebtorsList
```

### Geração automática de histórico

```
Inquilino cadastrado com startDate
  → Ao abrir histórico ou via sincronização manual
    → POST /api/payments/sync (ou /generate)
      → ensurePaidPaymentsUntilCurrentMonth()
        → busca payments existentes para o inquilino
        → calcula quais períodos (mês/ano) estão faltando
        → INSERT em lote com status = 'pago' e payment_date = due_date
```
