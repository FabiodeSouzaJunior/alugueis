# spec-tabeladepagamentos.md

## Contexto

Portal do Inquilino — seção de pagamentos. O inquilino acessa o portal com o e-mail cadastrado no sistema e visualiza **apenas os seus próprios pagamentos**, sem acesso a dados de outros inquilinos.

---

## Lógica de status (regras exatas do sistema atual)

A tabela principal usa a seguinte regra para calcular o `status` de cada pagamento:

```
valorDevido = tenant.rentValue ?? payment.expectedAmount ?? payment.amount
valorPago   = payment.amount (numérico, padrão 0)

se valorPago >= valorDevido  E valorDevido > 0  → "pago"
se valorPago > 0  E valorPago < valorDevido      → "pendente"
se valorPago == 0:
    se payment.dueDate < hoje                    → "atrasado"
    caso contrário                               → "pendente"
```

> Implementado em `lib/calculations.js` → `getPaymentStatus()` e replicado em `app/(app)/pagamentos/page.js` → `getStatusPagamentos()`.

---

## Campos disponíveis no objeto `payment` (retorno da API)

| Campo            | Tipo   | Descrição                              |
|------------------|--------|----------------------------------------|
| `id`             | string | Identificador único                    |
| `tenantId`       | string | ID do inquilino                        |
| `month`          | number | Mês de competência (1–12)              |
| `year`           | number | Ano de competência                     |
| `dueDate`        | string | Data de vencimento (`YYYY-MM-DD`)      |
| `paymentDate`    | string | Data em que foi pago (`YYYY-MM-DD`)    |
| `amount`         | number | Valor efetivamente pago                |
| `expectedAmount` | number | Valor esperado (pode ser `null`)       |
| `status`         | string | `"pago"` / `"pendente"` / `"atrasado"`|

---

## Tabela simplificada para o Portal do Inquilino

### Colunas exibidas

| Coluna        | Fonte no objeto `payment`          | Formatação                         |
|---------------|------------------------------------|------------------------------------|
| **Período**   | `month` + `year`                   | `getMonthName(month) + " " + year` |
| **Vencimento**| `dueDate`                          | `formatDate(dueDate)` ou `"-"`     |
| **Status**    | calculado via regra acima          | Badge colorido (ver abaixo)        |

### Badge de status

| Status     | Classes Tailwind                                                                                         | Rótulo   |
|------------|----------------------------------------------------------------------------------------------------------|----------|
| `pago`     | `bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30`  | Pago     |
| `pendente` | `bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30`            | Pendente |
| `atrasado` | `bg-red-500/20 text-red-600 dark:bg-red-500/25 dark:text-red-300 border-red-500/30`                      | Atrasado |

---

## Endpoint de dados

```
GET /api/payments/tenant-history?tenantId={id}
```

- Requer autenticação do inquilino.
- Retorna todos os pagamentos do `tenantId` informado (histórico completo, sem filtro de mês/ano).
- O `tenantId` deve ser resolvido a partir do **e-mail do inquilino logado**.

### Como resolver tenantId a partir do e-mail

1. O inquilino faz login com seu e-mail.
2. Consultar a tabela de inquilinos filtrando por `email = email_logado`.
3. Usar o `id` retornado como `tenantId` em todas as chamadas.

Referência: `app/api/payments/tenant-history/route.js` — valida que o `tenantId` existe antes de retornar os dados (`assertFinancialTenantById`).

---

## Ordenação dos registros

Os pagamentos devem ser exibidos do mais recente ao mais antigo:

```
sort por: year DESC, month DESC, dueDate DESC
```

---

## Implementação de referência (componente simplificado)

```jsx
// components/portal-inquilino/TabelaPagamentos.jsx
"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, getMonthName } from "@/lib/utils";

function getStatus(payment) {
  const valorDevido = Number(payment.expectedAmount ?? payment.amount) || 0;
  const valorPago   = Number(payment.amount) || 0;
  const hoje        = new Date().toISOString().split("T")[0];

  if (valorPago >= valorDevido && valorDevido > 0) return "pago";
  if (valorPago > 0 && valorPago < valorDevido)    return "pendente";
  if (valorPago === 0)
    return (payment.dueDate || "") < hoje ? "atrasado" : "pendente";
  return "pendente";
}

const badgeClass = {
  pago:     "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-500/30",
  pendente: "bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border-amber-500/30",
  atrasado: "bg-red-500/20 text-red-600 dark:bg-red-500/25 dark:text-red-300 border-red-500/30",
};

const badgeLabel = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado" };

export function TabelaPagamentos({ payments = [] }) {
  const sorted = [...payments].sort((a, b) => {
    if (Number(b.year) !== Number(a.year)) return Number(b.year) - Number(a.year);
    if (Number(b.month) !== Number(a.month)) return Number(b.month) - Number(a.month);
    return (b.dueDate || "").localeCompare(a.dueDate || "");
  });

  if (sorted.length === 0)
    return <p className="py-8 text-center text-muted-foreground">Nenhum pagamento encontrado.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Período</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((p) => {
          const status = getStatus(p);
          return (
            <TableRow key={p.id}>
              <TableCell>{getMonthName(p.month)} {p.year}</TableCell>
              <TableCell>{formatDate(p.dueDate) || "-"}</TableCell>
              <TableCell>
                <Badge className={badgeClass[status]}>
                  {badgeLabel[status]}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

---

## Notas de segurança

- O `tenantId` **nunca** deve vir do `query string` diretamente no portal do inquilino — deve sempre ser derivado da sessão autenticada do usuário logado.
- O endpoint `/api/payments/tenant-history` deve validar que o `tenantId` requisitado corresponde ao inquilino da sessão ativa, evitando IDOR (Insecure Direct Object Reference — OWASP A01).
