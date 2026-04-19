# Kitnets — Gestão de Imóveis

Sistema pessoal de gestão de kitnets: aluguéis, pagamentos, manutenção e despesas. Interface em preto e branco, minimalista e responsiva.

## Stack

- **Next.js 14** (App Router)
- **JavaScript**
- **TailwindCSS** + **shadcn/ui** (Radix UI)
- **lucide-react**
- **Recharts** (gráficos)
- **localStorage** (persistência local, sem backend)

## Como rodar

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). A raiz redireciona para `/dashboard`.

## Módulos

| Rota           | Descrição                                      |
|----------------|------------------------------------------------|
| `/dashboard`   | Visão geral: kitnets, receita, lucro, gráficos |
| `/inquilinos`  | Cadastro de inquilinos (CRUD)                  |
| `/pagamentos`  | Registro e filtros de pagamentos               |
| `/inadimplentes` | Pagamentos pendentes e atrasados            |
| `/manutencao`  | Tarefas de manutenção                          |
| `/despesas`    | Despesas do prédio                             |
| `/relatorios`  | Resumo financeiro e lucro                      |

## Regras de negócio

- Ao **adicionar um inquilino ativo** com data de entrada, são geradas automaticamente as parcelas de pagamento (vencimento no dia 10).
- **Status do pagamento**: Pago (quando há data de pagamento), Atrasado (vencimento passou e sem pagamento), Pendente (demais).
- **Lucro do mês** = Receita recebida − Despesas do mês.

## Estrutura

```
app/
  (app)/           # layout com sidebar + header
    dashboard/
    inquilinos/
    pagamentos/
    inadimplentes/
    manutencao/
    despesas/
    relatorios/
components/
  ui/              # Card, Table, Dialog, Button, etc.
  layout/          # Sidebar, Header
  forms/           # Formulários em modais
lib/
  storage.js       # localStorage (tenants, payments, maintenance, expenses)
  utils.js         # cn, formatCurrency, formatDate
  calculations.js # status de pagamento, totais, dashboard
  payments-generation.js # geração de parcelas ao cadastrar inquilino
```

Dados ficam no **localStorage** (chaves `kitnets_tenants`, `kitnets_payments`, `kitnets_maintenance`, `kitnets_expenses`). Para limpar: DevTools → Application → Local Storage → Clear.
