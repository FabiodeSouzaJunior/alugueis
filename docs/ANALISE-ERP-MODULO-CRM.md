# Análise completa do ERP — base para o módulo CRM

Documento de análise do sistema antes da implementação do módulo CRM. Objetivo: mapear arquitetura, padrões visuais, fluxo de dados e entidades reutilizáveis para um CRM de leads/negociações integrado ao ERP.

---

## 1. Arquitetura do projeto

### 1.1 Stack tecnológica

| Camada | Tecnologia | Uso no ERP |
|--------|------------|------------|
| Framework | Next.js 14 (App Router) | Rotas em `app/`, API em `app/api/` |
| UI | React 18, Radix UI, Tailwind CSS, CVA, clsx | Componentes acessíveis e temáticos |
| Ícones | lucide-react | Sidebar, cards, botões, formulários |
| Gráficos | Recharts | Dashboard, Relatórios, Inadimplentes, Condomínio |
| Banco | MySQL (mysql2/promise) | Persistência via `lib/db.js` |
| Datas | date-fns (e funções em lib/utils) | Filtros, vencimentos, formatação |
| Calendário | react-big-calendar | Agenda (obras) |

Não há biblioteca de drag-and-drop no projeto; o Kanban do CRM precisará de uma (ex.: `@dnd-kit/core` + `@dnd-kit/sortable`) ou implementação com HTML5 DnD.

### 1.2 Estrutura de pastas

```
kitnets/
├── app/
│   ├── layout.js                 # Root: HTML, globals.css, tema
│   ├── page.js                   # Redirect / → /dashboard
│   ├── (app)/                    # Grupo de rotas (URL sem segmento extra)
│   │   ├── layout.js             # Envolve tudo em DashboardLayout
│   │   ├── dashboard/
│   │   ├── inquilinos/
│   │   ├── pagamentos/
│   │   ├── inadimplentes/
│   │   ├── obras/ + obras/[id]/...
│   │   ├── manutencao/
│   │   ├── despesas/
│   │   ├── relatorios/
│   │   ├── condominio/
│   │   └── crm/                  # (a criar)
│   └── api/
│       ├── tenants/
│       ├── tenants/[id]/
│       ├── payments/ (+ generate)
│       ├── expenses/
│       ├── maintenance/
│       ├── condominium/          # base-values, expenses, settings, overview, amount
│       └── obras/ + obras/[id]/...
├── components/
│   ├── layout/                   # dashboard-layout, sidebar, header
│   ├── ui/                       # Button, Card, Input, Label, Select, Table, Tabs, Badge, Dialog, Dropdown
│   ├── forms/                    # tenant-form, payment-form
│   ├── dashboard/                # DashboardStatCard, ProjectProgressList, charts...
│   ├── reports/                  # RevenueVsExpensesChart, PaymentDistributionChart, StatsCard...
│   ├── payments-analytics/      # KPIs e gráficos da página Pagamentos
│   ├── inadimplencia/            # Stats, donut, timeline, TopDebtorsList
│   ├── condominium/              # Dashboard, BaseValueManager, ExpenseSplit, Composition, History, Settings
│   └── obra-reports/             # Gráficos e listas de obras
├── context/
│   └── page-header.jsx           # setPageHeader({ title, description, action })
├── lib/
│   ├── db.js                     # pool MySQL + mappers (rowToTenant, rowToPayment, ...)
│   ├── api.js                    # fetchTenants, createTenant, fetchPayments, ...
│   ├── calculations.js           # getExpected, getPaymentStatus, getDashboardNumbers...
│   ├── condominium.js            # getCondominiumAmountForMonth, getCondominiumChargeWithRent
│   ├── generateId.js             # IDs para inserts
│   └── utils.js                  # cn, formatCurrency, formatDate, getMonthName
└── scripts/migrations/           # SQL (add-expected-amount, condominium-tables...)
```

### 1.3 Fluxo de dados

- **Cliente:** páginas em `app/(app)/*` usam `lib/api.js` (fetch para `/api/...`).
- **Servidor:** rotas em `app/api/*` usam `pool` e mappers de `lib/db.js`; respostas em JSON.
- **Cálculos:** feitos no cliente com dados já carregados (ex.: `lib/calculations.js`); nenhuma persistência em localStorage.
- **Cabeçalho da página:** cada página chama `usePageHeader()` e `setPageHeader({ title, description, action })` para título, descrição e botão principal (ex.: "Adicionar Inquilino").

---

## 2. Organização das pastas e componentes

### 2.1 Padrão de página

- Uma **page.js** por rota (client component com `"use client"`).
- Carregamento: `useState` + `useCallback(load)` + `useEffect(() => load(), [load])`.
- Erro de carga: estado `loadError` exibido em Card ou mensagem.
- Ação principal no header: `Dialog` com `DialogTrigger` (Button) e formulário dentro de `DialogContentWithClose`.

### 2.2 Componentes UI disponíveis (shadcn-style)

- **Card**, **CardHeader**, **CardTitle**, **CardDescription**, **CardContent**
- **Button**, **Input**, **Label**
- **Select**, **SelectTrigger**, **SelectValue**, **SelectContent**, **SelectItem**
- **Table**, **TableHeader**, **TableBody**, **TableRow**, **TableHead**, **TableCell**
- **Badge**, **Tabs**, **Dialog** (e **DialogContentWithClose**, **DialogFooter**)
- **Dropdown** (dropdown-menu)

Padrão visual: bordas `border-border`, fundo `bg-card`, texto `text-foreground` / `text-muted-foreground`, cantos `rounded-lg` ou `rounded-xl`, sombra `shadow-sm`, hover `hover:shadow-md`.

### 2.3 Padrão de formulário

- Componentes em `components/forms/`: controlados com `useState(form)` e `onChange` atualizando estado.
- Submit: `onSave(payload)` recebe objeto pronto; a página chama a API (create/update) e fecha o dialog.
- Exemplo: **TenantForm** usa `name`, `phone`, `kitnetNumber`, `rentValue`, `startDate`, `status`, `observacao`; formata valor com máscara e envia número.

### 2.4 Padrão de listagem

- **Card** com **CardHeader** (título + descrição) e, quando há filtro, inputs/selects no header ou logo abaixo.
- **Table** com **TableHeader** fixo e **TableBody** mapeando itens.
- Ações por linha: botões ghost (Pencil, Trash2) ou link para detalhe.
- Busca: estado `search` e filtro no cliente sobre a lista carregada.

---

## 3. Padrão visual já utilizado

### 3.1 Cards analíticos (KPIs)

- **DashboardStatCard** (`components/dashboard/DashboardStatCard.jsx`): `rounded-xl border border-border bg-card p-4 shadow-sm`, título em `text-xs font-medium text-muted-foreground`, valor em `text-lg font-semibold tabular-nums`, ícone em `h-10 w-10 rounded-lg bg-muted/50`. Variantes `positive` (emerald) e `negative` (red).
- **CondominiumDashboard** e **PaymentsAnalyticsStats**: grid de cards (sm:grid-cols-2 lg:grid-cols-3 ou mais), mesmo estilo de borda, ícone, título, valor, descrição opcional.

### 3.2 Seções e títulos

- Título de seção: `h1` ou `h2` com `text-2xl` ou `text-lg font-semibold tracking-tight text-foreground`.
- Descrição: `text-sm text-muted-foreground` abaixo do título.
- Espaçamento entre seções: `space-y-6` ou `space-y-8` no container da página.

### 3.3 Tabelas

- **Table** com cabeçalho em **TableHead**, células em **TableCell**; valores numéricos com `tabular-nums`; linhas alternadas ou hover via Tailwind.
- Cards de tabela: `Card` com `CardHeader` (border-b, bg-muted/20) e `CardContent` com a tabela.

### 3.4 Gráficos (Recharts)

- **ResponsiveContainer** com altura fixa (ex.: 280px).
- **BarChart**, **AreaChart**, **PieChart** com **CartesianGrid**, **XAxis**, **YAxis**, **Tooltip**, **Legend**.
- Cores: `hsl(var(--primary))`, `hsl(var(--chart-2))` etc., ou cores semânticas (emerald, red, amber).
- Tooltip customizado: componente que recebe `active`, `payload`, `label` e formata com `formatCurrency` quando for valor.

### 3.5 Modais e painéis

- **Dialog** com **DialogContentWithClose** (título + botão fechar) e **DialogFooter** para Cancelar / Salvar.
- Mensagem de erro dentro do dialog: `rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive`.

### 3.6 Sidebar e navegação

- Itens com `rounded-lg px-3 py-2.5 text-sm font-medium`, estado ativo `bg-primary text-primary-foreground`, inativo `text-muted-foreground hover:bg-muted`.
- Ícone + label por item; ícones lucide-react 5x5.

---

## 4. Tenants (inquilinos), kitnets, pagamentos e relatórios

### 4.1 Entidade Tenant (inquilino)

- **Tabela:** `tenants`.
- **Campos (DB → JS):** id, name, phone, kitnet_number → kitnetNumber, rent_value → rentValue, start_date → startDate, status, observacao, created_at, updated_at.
- **API:** GET/POST `/api/tenants`, GET/PUT/DELETE `/api/tenants/[id]`.
- **Cliente:** `fetchTenants()`, `createTenant(payload)`, `updateTenant(id, payload)`, `deleteTenant(id)`, `generatePaymentsForTenant(tenantId, rentValue, startDate)`.
- **Payload de criação:** name, phone, kitnetNumber, rentValue, startDate, status ("ativo"), observacao.
- **Página Inquilinos:** listagem com busca (nome, kitnet, telefone), dialog para criar/editar com **TenantForm**; ao criar inquilino ativo com startDate, chama `generatePaymentsForTenant` para gerar parcelas.

### 4.2 Kitnets

- **Não existe tabela kitnets.** “Kitnet” é o número da unidade: campo `tenants.kitnet_number` (string).
- Lista de kitnets na UI: `[...new Set(tenants.map(t => t.kitnetNumber).filter(Boolean))].sort()` (ex.: página Pagamentos para filtro).
- Para o CRM: “kitnet de interesse” pode ser um desses números ou um texto livre (ex.: “qualquer” ou número futuro); convém alinhar se haverá lista fixa de unidades ou livre.

### 4.3 Pagamentos

- **Tabela:** `payments` (tenant_id, month, year, due_date, payment_date, amount, expected_amount, status).
- **API:** GET/POST `/api/payments`, GET/PUT/DELETE `/api/payments/[id]`, POST `/api/payments/generate`.
- **Geração de parcelas:** recebe tenantId, rentValue, startDate; cria uma linha por mês desde start até hoje com expected_amount = rentValue (ou + condomínio se configurado).
- **Integração CRM → Inquilino:** ao converter lead em inquilino, usar `createTenant` + `generatePaymentsForTenant` replica o fluxo já existente na página Inquilinos.

### 4.4 Relatórios

- **Página Relatórios:** busca tenants, payments, expenses; usa `getDashboardNumbers`, `getPaymentsForMonth`, `getExpensesForMonth`; exibe totais, tendências, gráficos (receita x despesas, distribuição) e resumo financeiro.
- Dados são agregados no cliente; não há endpoint específico de “relatório”, apenas dados brutos das APIs.

---

## 5. Fluxo de dados: front-end, API e banco

### 5.1 Cliente → API

- Todas as chamadas passam por `lib/api.js`: `fetch(BASE + '/api/...')` com método, headers `Content-Type: application/json` e body quando aplicável.
- Tratamento de erro: `const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || res.statusText); return data;`.
- Parâmetros de query: `URLSearchParams(params)` no GET (ex.: `fetchPayments({ month, year, tenantId })`).

### 5.2 API → Banco

- Cada rota importa `pool` e mappers de `lib/db.js`.
- Inserts/updates usam `generateId()` para novos IDs (string tipo `timestamp-random`).
- Datas: armazenadas como DATE/DATETIME; mappers convertem para string ISO `YYYY-MM-DD` com `toISOString().split("T")[0]`.
- Números: `Number(row.column) ?? 0` ou tratamento de null no mapper.

### 5.3 Padrão de erro e loading

- Páginas: estado `loading` (ex.: skeleton ou “Carregando...”) e `loadError` (mensagem em Card ou texto destrutivo).
- Em caso de falha na API, `loadError` é preenchido e a listagem pode ficar vazia ou mostrar mensagem de “verifique o servidor/banco”.

---

## 6. Entidades existentes e reutilização para o CRM

### 6.1 Entidades que podem ser reutilizadas

| Entidade | Uso no CRM |
|----------|------------|
| **tenants** | Destino da conversão: lead convertido vira registro em tenants; mesmo schema (name, phone, kitnetNumber, rentValue, startDate, status, observacao). |
| **API createTenant / generatePaymentsForTenant** | “Converter em inquilino” = createTenant + opcionalmente generatePaymentsForTenant. |
| **Lista de kitnets** | Derivada de tenants (ou fixa); filtro “kitnet de interesse” no CRM pode usar a mesma lista ou uma lista de unidades disponíveis. |

### 6.2 Entidades novas necessárias (CRM)

- **crm_leads** (ou `crm_leads`): lead com nome, telefone, email, origem, kitnet de interesse, orçamento, data do primeiro contato, estágio (stage_id ou stage slug), observações, tenant_id (preenchido quando convertido).
- **crm_stages** (ou estágios fixos no código): Novo contato, Interessado, Visitou imóvel, Em negociação, Contrato enviado, Convertido, Perdido — podem ser tabela configurável ou constantes.
- **crm_interactions**: histórico de interações (lead_id, tipo, descrição, data/hora); tipo pode ser enum (ligação, mensagem, visita, proposta, contrato).

### 6.3 Relacionamentos

- **Lead** → 1:N **Interactions**.
- **Lead** → N:1 **Stage** (ou stage como string/código).
- **Lead** → 0:1 **Tenant** (quando convertido; tenant_id em crm_leads).
- **Kitnet de interesse**: string (número ou “qualquer”); não precisa de FK se for texto ou referência à mesma lista de unidades do sistema.

---

## 7. Pontos de integração do CRM

### 7.1 Navegação

- Adicionar item **CRM** no array `items` de `components/layout/sidebar.jsx` (href `/crm`, ícone adequado, ex.: Users ou Target).

### 7.2 Conversão lead → inquilino

- Reutilizar `createTenant(payload)` com dados do lead (name, phone, kitnetNumber = kitnet de interesse, rentValue = orçamento ou valor combinado, startDate = hoje ou data combinada, status = "ativo", observacao = observações do lead).
- Opcional: `generatePaymentsForTenant(tenant.id, tenant.rentValue, tenant.startDate)` para criar primeiras parcelas.
- Após sucesso: atualizar lead (stage = “Convertido”, tenant_id = tenant.id) para manter rastreabilidade.

### 7.3 Consistência de dados

- Ao listar inquilinos, não é necessário diferenciar “veio do CRM” ou “cadastrado direto”; o vínculo lead → tenant serve para histórico e relatórios do CRM (ex.: “conversões por mês”).

### 7.4 Relatórios e dashboard do CRM

- Métricas (total leads, novos, em negociação, convertidos, taxa de conversão, tempo médio) e gráficos (distribuição por estágio, origem, conversões por mês) calculados no cliente a partir de dados de leads e interactions, ou via endpoint agregado (ex.: GET `/api/crm/overview`).

---

## 8. Sugestão de estrutura do módulo CRM

### 8.1 Rotas

- `/crm` — página principal: dashboard (Seção 1) + pipeline Kanban (Seção 2) + filtros (Seção 6).
- `/crm/lead/[id]` (opcional) — página de perfil do lead com detalhes (Seção 3), histórico de interações (Seção 4) e botão “Converter em inquilino” (Seção 5). Alternativa: painel lateral (drawer/sheet) na mesma página `/crm` ao clicar no card.

### 8.2 APIs sugeridas

- GET/POST `/api/crm/leads` (lista com filtros; criar lead).
- GET/PUT/DELETE `/api/crm/leads/[id]` (detalhe, atualizar estágio/dados, deletar).
- GET/POST `/api/crm/leads/[id]/interactions` (histórico; registrar interação).
- POST `/api/crm/leads/[id]/convert` (criar tenant, opcionalmente gerar pagamentos, atualizar lead com tenant_id e estágio “Convertido”).
- GET `/api/crm/overview` (métricas agregadas para o dashboard).
- GET `/api/crm/stages` (se estágios forem configuráveis) ou estágios fixos no front.

### 8.3 Componentes sugeridos

- **CRMDashboard** — grid de cards de KPIs (total leads, novos, em negociação, convertidos, taxa de conversão, tempo médio).
- **LeadPipeline** — Kanban com colunas por estágio; cards arrastáveis (requer lib DnD).
- **LeadCard** — card compacto no Kanban (nome, telefone, kitnet interesse, data primeiro contato, status).
- **LeadDetailsPanel** — drawer ou página com todos os campos do lead + observações + botão converter.
- **LeadInteractionsTimeline** — lista ou timeline de interações (tipo, descrição, data/hora) + formulário para nova interação.
- **LeadConversionFlow** — modal ou passo a passo: confirma dados (nome, telefone, kitnet, valor, data início), chama createTenant (+ generatePaymentsForTenant), atualiza lead.
- Filtros: busca por nome; Select por estágio, origem, kitnet de interesse (reutilizar padrão de Select já usado em outras páginas).

### 8.4 Banco de dados

- **crm_stages** (opcional): id, name, sort_order — ou estágios fixos no código.
- **crm_leads**: id, name, phone, email, source (origem), kitnet_interest, budget (orçamento), first_contact_at, stage_id (ou stage como string), notes, tenant_id (nullable), created_at, updated_at.
- **crm_interactions**: id, lead_id, type (enum ou string), description, occurred_at, created_at.

---

## 9. Resumo executivo

| Tema | Conclusão |
|------|-----------|
| **Arquitetura** | Next.js 14 App Router, MySQL, lib/db + lib/api; páginas client com load/error state; padrão de formulário em dialog e listagem em Card + Table. |
| **Organização** | Módulos por domínio (dashboard, reports, condominium, inadimplencia, forms, ui); novo módulo em `components/crm/` e `app/(app)/crm/`. |
| **Padrão visual** | Cards com rounded-xl, border-border, shadow-sm; grids responsivos; Recharts para gráficos; ícones lucide; tipografia semântica (títulos, muted-foreground). |
| **Tenants/Kitnets/Pagamentos** | Tenant = registro em tenants com kitnetNumber; kitnets = lista derivada; conversão = createTenant + generatePaymentsForTenant. |
| **Fluxo de dados** | Páginas → lib/api.js → API routes → lib/db.js → MySQL; IDs com generateId(); datas em ISO date string. |
| **Reutilização** | TenantForm não precisa ser reutilizado no CRM; createTenant e generatePaymentsForTenant sim; componentes UI (Card, Table, Dialog, Select, Button, Input, Badge) e padrão de página (usePageHeader, load, loadError) reutilizáveis. |
| **CRM** | Novas tabelas crm_leads e crm_interactions; estágios fixos ou tabela crm_stages; Kanban com lib DnD; conversão integrada a tenants e pagamentos. |

Este documento serve de base para implementar o módulo CRM com o mesmo nível de qualidade e integração do restante do ERP, com design SaaS moderno e experiência alinhada a produtos como Salesforce, HubSpot, Pipedrive e Linear.
