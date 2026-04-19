# Análise completa — Gráficos de barra e design system

**Objetivo:** Base para melhorar os gráficos de barra existentes (sem alterar código ainda).  
**Data:** Análise pré-implementação.

---

## 1. Biblioteca de gráficos

- **Biblioteca:** **Recharts** (`recharts` v2.12.7)
- **Uso:** `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Cell`, `ComposedChart`, `Legend`, `PieChart`, `Pie`, `AreaChart`, `Area`.
- **Localização:** `package.json` → `"recharts": "^2.12.7"`.

---

## 2. Componentes de gráficos existentes (e onde estão)

### 2.1 Módulo Obras

| Componente | Arquivo | Tipo | Onde é usado |
|------------|---------|------|------------------|
| **ObraCostsByCategoryChart** | `components/obra-reports/ObraCostsChart.jsx` | BarChart (barras por categoria) | `app/(app)/obras/page.js` (dashboard geral), `app/(app)/obras/[id]/dashboard/page.js` (dashboard da obra) |
| **ObraCostsEvolutionChart** | `components/obra-reports/ObraCostsChart.jsx` | BarChart (evolução por mês) | Mesmos dois lugares acima |

- **Distribuição por categoria:** `ObraCostsByCategoryChart` — categorias: Material, Mão de obra, Ferramentas, Projeto, Taxas, Outros.
- **Evolução de gastos:** `ObraCostsEvolutionChart` — gastos acumulados por mês (uma série).

### 2.2 Módulo Relatórios

| Componente | Arquivo | Tipo | Onde é usado |
|------------|---------|------|------------------|
| **RevenueVsExpensesChart** | `components/reports/ReportsChart.jsx` | BarChart (2 barras: Receita + Despesas) | `app/(app)/relatorios/page.js` |
| **PaymentDistributionChart** | `components/reports/ReportsChart.jsx` | PieChart | Relatórios (não é barra; fora do escopo) |

- **Receita vs Despesas:** `RevenueVsExpensesChart` — comparação mensal Receita / Despesas.

### 2.3 Módulo CRM

| Componente | Arquivo | Tipo | Onde é usado |
|------------|---------|------|------------------|
| **DemandAndVacancyCharts** | `components/crm-intelligence/DemandAndVacancyCharts.jsx` | 2 gráficos em um componente | `components/crm-intelligence/CRMIntelligenceContent.jsx` |
| ↳ Gráfico 1 | — | ComposedChart (Entradas + Saídas por mês) | "Entradas e saídas por mês" |
| ↳ Gráfico 2 | — | BarChart (Saldo líquido) | "Saldo líquido (entradas − saídas)" |

- **Entradas e saídas por mês:** ComposedChart com 2 `Bar` (entradas, saídas) — sazonalidade / base para retenção e rotatividade.
- **Saldo líquido:** BarChart com `dataKey="saldo"` (entradas − saídas).

**Observação:** Não existe um componente separado “Entradas vs saídas (últimos 12 meses)”; os últimos 12 meses vêm da API e alimentam o primeiro gráfico dentro de `DemandAndVacancyCharts`.

### 2.4 Outros gráficos (não barra / contexto)

- `components/dashboard/CostDistributionChart.jsx` — BarChart (dashboard principal; custos por categoria).
- `components/dashboard/ExpenseTimelineChart.jsx` — BarChart (timeline de gastos).
- `components/condominium/CondominiumEvolutionChart.jsx` — AreaChart (evolução condomínio).
- `components/charts/*` — CumulativeRevenueChart, OccupancyDonutChart, PaymentStatusPieChart, RevenueExpenseLineChart (linha/pizza).
- `components/crm-intelligence/ExitReasonsChart.jsx` — provavelmente pizza ou barra (motivos de saída).
- `components/inadimplencia/InadimplenciaStatusChart.jsx`.
- **ChartCard:** `components/cards/ChartCard.jsx` — wrapper Card (título, descrição, conteúdo) usado para envolver gráficos.

---

## 3. Como os dados são passados para os gráficos

### 3.1 ObraCostsByCategoryChart

- **Prop:** `data` (array).
- **Formato esperado:** `[{ name: string, value: number }, ...]`.
- **Origem (dashboard geral de obras):**  
  `app/(app)/obras/page.js` → `chartByCategory` = `COST_CATEGORIES.map(cat => ({ name: cat, value: report.byCategory[cat] || 0 })).filter(d => d.value > 0)`.
- **Origem (dashboard da obra):**  
  `app/(app)/obras/[id]/dashboard/page.js` → mesmo padrão a partir de `report.byCategory` (derivado de `costs` da obra).
- **Categorias fixas:** Material, Mão de obra, Ferramentas, Projeto, Taxas, Outros.

### 3.2 ObraCostsEvolutionChart

- **Prop:** `data` (array).
- **Formato esperado:** `[{ name: string, gasto: number }]` ou `[{ name: string, value: number }]`. O componente usa `dataKey = "gasto" in data[0] ? "gasto" : "value"`.
- **Origem (dashboard geral):**  
  `obras/page.js` → `chartEvolution`: agrupa `costs` por mês (`date.slice(0,7)`), ordena, monta `{ name: "Mmm/yy", gasto }`.
- **Origem (dashboard da obra):**  
  `obras/[id]/dashboard/page.js` → mesma lógica com `costs` da obra.

### 3.3 RevenueVsExpensesChart (Relatórios)

- **Prop:** `data` (array).
- **Formato esperado:** `[{ name: string, Receita: number, Despesas: number }, ...]`.
- **Origem:**  
  `app/(app)/relatorios/page.js` → `chartRevenueVsExpenses`: atualmente **um único ponto** — `[{ name: getMonthName(month).slice(0,3), Receita: stats.receivedRevenue, Despesas: stats.monthExpensesTotal }]`.
- **Observação:** Para “comparação mensal” em vários meses, a página precisaria montar um array com um item por mês.

### 3.4 DemandAndVacancyCharts (CRM)

- **Props:** `entriesByMonth`, `exitsByMonth`, `totalKitnets`.
- **Formato API:**  
  `GET /api/crm-intelligence/overview` retorna:
  - `entriesByMonth`: `[{ month: "YYYY-MM", count: number }, ...]` (12 meses).
  - `exitsByMonth`: mesmo formato.
- **Uso no componente:** Monta `combined`: para cada mês, `{ month, label: "Mmm/yy", entradas, saídas, saldo: entradas - saídas }`. Dois gráficos usam `combined`:
  - ComposedChart: `dataKey="label"`, barras `entradas` e `saídas`.
  - BarChart: `dataKey="label"`, barra `saldo`.

---

## 4. Design system (cores, tipografia, spacing)

### 4.1 Cores (CSS variables — `app/globals.css`)

- **Tema light (`:root`):**
  - `--background`: 0 0% 100%
  - `--foreground`: 0 0% 3.9%
  - `--primary`: 0 0% 9%
  - `--primary-foreground`: 0 0% 98%
  - `--secondary`: 0 0% 96.1%
  - `--muted`: 0 0% 96.1%
  - `--muted-foreground`: 0 0% 45.1%
  - `--accent`: 0 0% 96.1%
  - `--destructive`: 84.2% 60.2% (vermelho)
  - `--border`: 0 0% 89.8%
  - `--card`, `--input`, `--ring`
  - `--condo-accent`: 217 33% 42% (slate-azulado, página Condomínio)

- **Tema dark (`.dark`):** Mesmas variáveis com valores invertidos/escuros (background ~2%, foreground ~98%, primary branco, etc.).

- **Uso nos gráficos atuais:**
  - Grid/linhas: `className="stroke-muted/50"` ou `stroke-muted`.
  - Tooltip/cursor: `fill: "hsl(var(--muted))"`, `opacity: 0.3`.
  - Bordas do tooltip: `border-border`, `bg-card`.
  - CRM barras: `fill="hsl(var(--primary))"` e `#94a3b8` (slate) para saídas.
  - Cores hardcoded em gráficos: `#3b82f6` (azul), `#10b981` (verde), `#f59e0b` (âmbar), `#8b5cf6` (roxo), `#ec4899` (rosa), `#64748b` (slate). Relatórios: `#10b981` (receita), `#ef4444` (despesas).

### 4.2 Tailwind (`tailwind.config.js`)

- **Cores:** Mapeamento de `border`, `input`, `ring`, `background`, `foreground`, `primary`, `secondary`, `destructive`, `muted`, `accent`, `card` para `hsl(var(--...))`.
- **Border radius:** `lg: var(--radius)`, `md/sm` derivados. `--radius: 0.5rem` em globals.
- **Dark mode:** `darkMode: ["class"]`.
- **Plugins:** `tailwindcss-animate`.

### 4.3 Tipografia e spacing nos gráficos

- **Font size dos eixos:** `fontSize: 11` ou `12` nos ticks.
- **Altura padrão:** `h-[280px]` no container do gráfico.
- **Margens do Recharts:** `margin={{ top: 12, right: 12, left: 0, bottom: 0 }}` (obras/relatórios); CRM `top: 8, right: 8`.
- **YAxis width:** 48 (obras/relatórios).
- **Labels:** `text-sm`, `text-muted-foreground`, `font-semibold`, `tabular-nums` nos tooltips e cards.
- **Títulos de seção (dashboards):** `text-sm font-semibold uppercase tracking-wider text-muted-foreground` (mb-4).

### 4.4 Padrão de cards dos gráficos

- Card: `rounded-xl border border-border shadow-sm`, `overflow-hidden`.
- Header: `border-b border-border/50 bg-muted/20`, título `text-base font-semibold`, descrição via `CardDescription`.
- Conteúdo: `p-6` (ou `p-4`).

---

## 5. Estrutura dos dashboards

### 5.1 Dashboard geral de obras (`app/(app)/obras/page.js`)

1. Card “Lista de obras” (tabela).
2. Seção “Indicadores de todas as obras” (KPIs em grid 4 colunas).
3. “Progresso financeiro” (barra + valores).
4. Grid 2 colunas: “Distribuição por categoria” (ObraCostsByCategoryChart) e “Evolução de gastos” (ObraCostsEvolutionChart).
5. “Detalhamento financeiro” (accordion por categoria).
6. Grid 2 colunas: “Custo por trabalhador” e “Resumo geral”.

Dados: `dashboardData` de `fetchObrasDashboard()` → `obras`, `costs`, `workers`; agregados em `report`, `chartByCategory`, `chartEvolution`, `accordionCategories`.

### 5.2 Dashboard da obra (`app/(app)/obras/[id]/dashboard/page.js`)

Mesma ordem visual que o geral, mas dados de uma obra: `fetchObra(id)`, `fetchObraCosts(id)`, `fetchObraMaterials(id)`, `fetchObraWorkers(id)` → mesmo `report` / `chartByCategory` / `chartEvolution` por obra.

### 5.3 Relatórios (`app/(app)/relatorios/page.js`)

- KPIs e métricas (cards).
- Grid 2 colunas: card “Receita vs Despesas” com `RevenueVsExpensesChart` e card “Distribuição de pagamentos” com `PaymentDistributionChart`.
- Seção “Cálculo do lucro” (FinanceSummary).

Dados: `fetchTenants`, `fetchPayments`, `fetchExpenses` → `stats`, `monthDetail`, `chartRevenueVsExpenses` (1 mês), `chartPaymentDistribution`.

### 5.4 CRM (`app/(app)/crm/page.js` → CRMIntelligenceContent)

- Dashboard inteligente (números).
- Alertas.
- Satisfação.
- **Análise de demanda e vacância:** seção com `DemandAndVacancyCharts` (Entradas e saídas por mês + Saldo líquido).
- Depois: preço, perfil inquilinos, feedback, saídas, retenção.

Dados: `fetchCrmIntelligenceOverview()` → `overview.entriesByMonth`, `overview.exitsByMonth`, etc.

---

## 6. Resumo dos 6 gráficos de barra a aprimorar

| # | Módulo | Nome / descrição | Componente atual | Arquivo | Data prop / formato |
|---|--------|------------------|-------------------|---------|---------------------|
| 1 | Obras | Distribuição por categoria | ObraCostsByCategoryChart | `components/obra-reports/ObraCostsChart.jsx` | `data`: `[{ name, value }]` |
| 2 | Obras | Evolução de gastos | ObraCostsEvolutionChart | idem | `data`: `[{ name, gasto }]` ou `[{ name, value }]` |
| 3 | Relatórios | Receita vs Despesas | RevenueVsExpensesChart | `components/reports/ReportsChart.jsx` | `data`: `[{ name, Receita, Despesas }]` |
| 4 | CRM | Entradas e saídas por mês | DemandAndVacancyCharts (1º gráfico) | `components/crm-intelligence/DemandAndVacancyCharts.jsx` | `entriesByMonth`, `exitsByMonth` → `combined`: `[{ label, entradas, saídas }]` |
| 5 | CRM | Saldo líquido | DemandAndVacancyCharts (2º gráfico) | idem | `combined`: `[{ label, saldo }]` |
| 6 | CRM | Entradas vs saídas (últimos 12 meses) | Mesmo que #4 | idem | Mesmos dados; “últimos 12 meses” vem da API (last12). |

---

## 7. Padrões atuais dos gráficos de barra (Recharts)

- **Container:** `div` com `h-[280px] w-full` e `ResponsiveContainer width="100%" height="100%"`.
- **BarChart/ComposedChart:** `margin` top/right 8–12, left/bottom 0.
- **CartesianGrid:** `strokeDasharray="3 3"`, `className="stroke-muted/50"` ou `stroke-muted`, `vertical={false}` onde aplicável.
- **XAxis:** `dataKey="name"` ou `"label"`, `tick={{ fontSize: 11 ou 12 }}`, às vezes `tickLine={false}`.
- **YAxis:** `tickFormatter` em R$ (ex.: `R$ ${(v/1000).toFixed(0)}k`), `width={48}`, `tickLine={false}` no CRM.
- **Tooltip:** Componente customizado em React; fundo `bg-card`, borda `border-border`, `rounded-lg`, `shadow-lg`, `px-4 py-3`; conteúdo com `text-sm`, `text-muted-foreground`, `font-semibold`, `tabular-nums`; `formatCurrency` para valores.
- **Cursor:** `fill: "hsl(var(--muted))", opacity: 0.3`.
- **Bar:** `radius={[4, 4, 0, 0]}`, `maxBarSize={48}` ou 36; cores por `Cell` (categorias) ou `fill` fixo (#3b82f6, primary, etc.).

Nenhum uso de animação explícita (Recharts já anima por padrão), nem gradiente ou sombra nas barras.

---

## 8. Arquivos a considerar na implementação do AdvancedBarChart

- **Componentes de gráfico de barra a unificar/estilizar:**
  - `components/obra-reports/ObraCostsChart.jsx` (ObraCostsByCategoryChart, ObraCostsEvolutionChart)
  - `components/reports/ReportsChart.jsx` (RevenueVsExpensesChart)
  - `components/crm-intelligence/DemandAndVacancyCharts.jsx` (dois gráficos de barra)
- **Design system:**
  - `app/globals.css` (variáveis de cor e radius)
  - `tailwind.config.js` (cores e radius)
- **Páginas que montam os dados:**
  - `app/(app)/obras/page.js`
  - `app/(app)/obras/[id]/dashboard/page.js`
  - `app/(app)/relatorios/page.js`
  - `components/crm-intelligence/CRMIntelligenceContent.jsx` (passa props para DemandAndVacancyCharts)
- **Utilitários:** `lib/utils.js` (`formatCurrency`, etc.).

---

**Fim da análise.** Este documento serve como referência para implementar o componente `AdvancedBarChart` e aplicar o estilo minimalista e premium aos 6 gráficos de barra listados, sem alterar a lógica de dados já descrita.
