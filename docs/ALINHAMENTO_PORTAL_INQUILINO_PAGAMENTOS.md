# Alinhamento do Portal do Inquilino com o Sistema Admin

## Objetivo

Garantir que o portal do inquilino exiba e cobre exatamente o mesmo:

- valor devido
- vencimento
- status do pagamento

que já são definidos no sistema admin.

O portal do inquilino nao deve recalcular esses campos com regra propria nem usar `amount` como se fosse "valor devido".

---

## Regra oficial do sistema admin

No sistema atual, o pagamento correto do inquilino e definido assim:

- `payments.expected_amount` = valor devido do periodo
- `payments.amount` = valor pago
- `payments.due_date` = vencimento
- `payments.status` = status calculado da cobranca

### Regra mais importante

O portal do inquilino deve usar:

- **Valor devido:** `expectedAmount`
- **Vencimento:** `dueDate`
- **Valor pago:** `amount`
- **Status:** `status`

Se o portal usar `amount` como valor devido, ele vai mostrar o dado errado, porque `amount` representa o que ja foi pago, nao o que deve ser pago.

---

## Origem correta dos dados

### API que deve abastecer o portal

Endpoint:

```txt
GET /api/payments/tenant-history?tenantId={tenantId}
```

Arquivo:

- [app/api/payments/tenant-history/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/payments/tenant-history/route.js)

Essa rota chama:

- [server/modules/financial/payment-responsibility.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/financial/payment-responsibility.service.js)

que por sua vez retorna pagamentos usando `listFinancialPayments(...)`.

### Conversao do banco para o payload da API

Arquivo:

- [lib/db.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/lib/db.js)

Mapeamento oficial:

```js
{
  id: row.id,
  tenantId: row.tenant_id,
  month: row.month,
  year: row.year,
  dueDate: row.due_date,
  paymentDate: row.payment_date,
  amount: Number(row.amount) ?? 0,
  expectedAmount: Number(row.expected_amount) ?? null,
  status: row.status ?? "pendente",
}
```

Ou seja:

- banco `expected_amount` -> API `expectedAmount`
- banco `due_date` -> API `dueDate`
- banco `amount` -> API `amount`

---

## Como o valor devido e definido no admin

Arquivo principal:

- [server/modules/financial/tenant-billing.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/financial/tenant-billing.service.js)

Funcao oficial:

```js
getPaymentExpectedAmountForPeriod({ tenantId, month, year })
```

### Composicao do valor devido

O `expectedAmount` e calculado como:

```txt
aluguel
+ condominio do periodo
+ consumos adicionais marcados para adicionar ao aluguel
= valor devido final
```

Na implementacao atual:

- aluguel vem de `tenants.rent_value`
- condominio vem da base mensal do imovel
- adicionais vem de agua/energia quando `add_to_rent = true`

Arquivos envolvidos:

- [server/modules/financial/tenant-billing.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/financial/tenant-billing.service.js)
- [lib/tenant-billing.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/lib/tenant-billing.js)

### Regra de sincronizacao

Para mes atual e futuros, o admin pode sincronizar `expected_amount` caso a cobranca ainda nao esteja quitada.

Mas existe uma protecao importante:

- se `status === "pago"`, o registro fica protegido
- periodos passados nao devem ser recalculados no fluxo normal de exibicao

Isso evita alterar cobrancas antigas ja fechadas.

---

## Como o vencimento e definido no admin

Arquivo:

- [lib/payment-dates.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/lib/payment-dates.js)

Funcao oficial:

```js
getDueDateForPeriod(month, year, paymentDay)
```

### Regra

O vencimento e montado com base no:

- mes da parcela
- ano da parcela
- dia de pagamento do inquilino (`tenants.payment_day`)

Se o dia configurado for maior que o ultimo dia do mes, o sistema usa o ultimo dia do mes.

Exemplos:

- `payment_day = 10` em `2026-05` -> vencimento `2026-05-10`
- `payment_day = 31` em `2026-02` -> vencimento `2026-02-28` ou `2026-02-29`

### Regra para o portal

O portal do inquilino nao deve inventar outro vencimento.

Deve sempre exibir o `dueDate` retornado pela API.

---

## Como o portal deve exibir

Se o portal receber um pagamento assim:

```json
{
  "id": "pag_123",
  "month": 5,
  "year": 2026,
  "dueDate": "2026-05-10",
  "amount": 0,
  "expectedAmount": 1580,
  "status": "pendente"
}
```

deve renderizar:

- Valor devido: `R$ 1.580,00`
- Vencimento: `10/05/2026`
- Valor pago: `R$ 0,00`
- Status: `Pendente`

### Regra de renderizacao obrigatoria

```js
const valorDevido = Number(payment.expectedAmount) || 0;
const vencimento = payment.dueDate || null;
const valorPago = Number(payment.amount) || 0;
const status = payment.status || "pendente";
```

### Regra que nao deve ser usada

```js
const valorDevido = Number(payment.amount) || 0;
```

Essa regra esta errada para o portal do inquilino.

---

## Regras funcionais para o inquilino pagar o valor certo e no prazo certo

O portal do inquilino deve seguir exatamente estas regras:

1. Buscar os pagamentos do inquilino pela API oficial.
2. Mostrar `expectedAmount` como valor devido.
3. Mostrar `dueDate` como vencimento.
4. Mostrar `amount` apenas como valor pago.
5. Mostrar `status` retornado pelo backend, sem recalculo paralelo no frontend.
6. Se houver pagamento em aberto, priorizar o mais antigo vencido ou o proximo a vencer.
7. Nao permitir pagamento acima do valor devido.

Essa ultima regra ja existe no backend:

- [app/api/payments/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/payments/route.js)
- [app/api/payments/[id]/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/payments/[id]/route.js)

O backend impede registrar `amount > expectedAmount`.

---

## Contrato que o portal do inquilino deve respeitar

### Campo correto por finalidade

| Finalidade | Campo correto |
| --- | --- |
| Valor devido | `expectedAmount` |
| Vencimento | `dueDate` |
| Valor pago | `amount` |
| Status | `status` |
| Periodo de referencia | `month` + `year` |

### Fluxo correto

1. Admin define aluguel, dia de pagamento e demais componentes da cobranca.
2. Backend gera ou sincroniza a parcela na tabela `payments`.
3. O valor final fica salvo em `expected_amount`.
4. O vencimento final fica salvo em `due_date`.
5. O portal do inquilino apenas consome e exibe esses dados.
6. O pagamento realizado pelo inquilino atualiza `amount` e `status`, mas nao redefine a regra da cobranca no frontend.

---

## Recomendacao de implementacao no portal do inquilino

Se houver uma funcao como `getPaymentBaseAmount(payment)`, ela deve retornar:

```js
function getPaymentBaseAmount(payment) {
  return Number(payment.expectedAmount) || 0;
}
```

Se houver um formatter de card/tabela:

```js
function getDisplayAmount(payment) {
  return formatPaymentCurrency(Number(payment.expectedAmount) || 0);
}
```

E o vencimento deve continuar sendo:

```js
formatDate(payment.dueDate)
```

### Fallback aceitavel

Somente se o portal ainda estiver consumindo payload legado:

```js
const valorDevido =
  payment.expectedAmount != null
    ? Number(payment.expectedAmount)
    : 0;
```

Nao usar fallback para `payment.amount` como valor devido, porque isso mascara erro de integracao.

---

## Regra de negocio final

Para o inquilino pagar o valor devido certo e no prazo certo, o portal deve obedecer ao sistema admin:

- o valor correto da cobranca e o `expectedAmount`
- o prazo correto da cobranca e o `dueDate`
- ambos devem vir do backend
- o frontend nao deve substituir essas regras por calculo proprio

Em resumo:

```txt
Portal do inquilino = espelho fiel da cobranca do admin
```

Se o outro sistema hoje estiver mostrando diferente, a correcao deve ser feita para ele consumir:

- `expectedAmount` como "Valor devido"
- `dueDate` como "Vencimento"

e nunca:

- `amount` como "Valor devido"

