# Análise do ERP — CRM & Inteligência de Inquilinos

Documento de análise para o módulo especializado em gestão e inteligência sobre inquilinos e kitnets.

---

## 1. Inquilinos (tenants)

- **Tabela:** `tenants`
- **Campos:** id, name, phone, kitnet_number, rent_value, start_date, status, observacao, created_at, updated_at
- **Status:** "ativo" | outro (ex.: "inativo"); não existe campo `end_date` — saída é implícita pelo status
- **Uso:** listagem em Inquilinos, Pagamentos, Inadimplentes, Relatórios; valor devido vem de `rent_value`; kitnet = `kitnet_number`
- **Gap para o CRM:** não há registro de data de saída nem motivo da saída; não há avaliação de satisfação nem feedback estruturado

---

## 2. Kitnets / Unidades

- **Não existe tabela `kitnets`.** Unidade = número da kitnet (string) em `tenants.kitnet_number`
- **Total de unidades:** fixo em `lib/calculations.js`: `totalKitnets = 12` (ocupadas = tenants ativos, vazias = 12 - ocupadas)
- **Lista de kitnets na UI:** `[...new Set(tenants.map(t => t.kitnetNumber).filter(Boolean))].sort()`

---

## 3. Pagamentos e inadimplência

- **Tabela:** `payments` (tenant_id, month, year, due_date, payment_date, amount, expected_amount, status)
- **Cálculo de status:** `lib/calculations.js` — getExpected, getPaymentStatus, getPendingAmount; valor devido = tenant.rentValue ?? payment.expectedAmount
- **Inadimplentes:** página filtra pagamentos pendentes/atrasados, agrupa por inquilino, mostra totais e top 5
- **Dados reutilizáveis:** lista de pagamentos por tenant, datas de pagamento/vencimento, atrasos (dias) para métricas de retenção e alertas

---

## 4. Dashboards e relatórios

- **Dashboard principal:** getDashboardNumbersYear (receita, despesas, lucro, ocupação), gráfico anual receita x despesas, obras, atividades recentes, alertas
- **Relatórios:** getDashboardNumbers (mês), totais e tendências, gráficos (receita x despesas, distribuição de pagamentos)
- **Inadimplentes:** totais, donut por status, timeline, top 5
- **Padrão:** dados carregados via lib/api.js, cálculos no cliente (useMemo), cards com rounded-xl e Recharts

---

## 5. Dados existentes reutilizáveis

| Fonte | Uso no CRM de Inteligência |
|-------|-----------------------------|
| tenants (ativo/inativo, start_date, kitnet_number, rent_value) | Ocupação, tempo de permanência, perfil, preço |
| payments (payment_date, due_date, amount, expected_amount) | Histórico de pagamentos/atrasos, renovação implícita, alertas |
| totalKitnets = 12 | Taxa de ocupação, vacância |
| getPaymentStatus, getPendingAmount | Atrasos e indicadores de risco |

---

## 6. Novas entidades necessárias

- **tenant_satisfaction:** avaliações 1–5 (conforto, limpeza, infraestrutura, localização, custo-benefício, geral) + data
- **tenant_feedback:** comentários/sugestões com categoria (infraestrutura, internet, segurança, limpeza, manutenção)
- **tenant_exits:** data de saída, motivo (mudança cidade, preço, estrutura, trabalho etc.) para inquilinos inativos
- **tenant_interactions:** linha do tempo (entrada, reclamação, manutenção, renovação, etc.)

---

## 7. Integração com o CRM atual

- O CRM em `/crm` hoje é focado em **leads** (pipeline, conversão). O novo conteúdo é **Inteligência de Inquilinos** (satisfação, demanda, preço, retenção, saídas, alertas).
- Estratégia: mesma rota `/crm` com **abas** ou **submenu**: "Inteligência" (novo dashboard) e "Leads" (pipeline atual), ou página principal = Inteligência e link "Pipeline de leads" para o Kanban.
