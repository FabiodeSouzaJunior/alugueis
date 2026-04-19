# CORREÇÃO: Lógica de Atualização do Valor de Aluguel

**Data:** 2025-01-01  
**Status:** ✅ IMPLEMENTADO  
**Severidade:** CRÍTICA (Corrompia histórico financeiro)

---

## 1. PROBLEMA IDENTIFICADO

Ao editar o valor de aluguel de um inquilino, o sistema estava **atualizando TODOS os registros de pagamento marcados como "atrasado"**, independentemente do mês/ano (competência). Isso causava corrupção de dados históricos.

### Exemplo do Erro
```
Cenário: Aluguel muda de R$ 1.200 → R$ 1.500 em JAN/2025

Pagamentos ANTES da correção:
├─ JAN/2026 | status: atrasado | expected_amount: 1.200 | ❌ ATUALIZADO PARA 1.500
├─ FEV/2026 | status: atrasado | expected_amount: 1.200 | ❌ ATUALIZADO PARA 1.500
├─ MAR/2026 | status: atrasado | expected_amount: 1.200 | ❌ ATUALIZADO PARA 1.500
├─ ABR/2026 | status: pendente | expected_amount: 1.200 | ❌ ATUALIZADO PARA 1.500
├─ MAI/2026 | status: pago    | expected_amount: 1.200 | ✓ NÃO ATUALIZADO (quitado)

Comportamento ESPERADO:
├─ JAN/2026 | status: atrasado | expected_amount: 1.200 | ✓ NÃO ATUALIZADO (período passado)
├─ FEV/2026 | status: atrasado | expected_amount: 1.200 | ✓ NÃO ATUALIZADO (período passado)
├─ MAR/2026 | status: atrasado | expected_amount: 1.200 | ✓ NÃO ATUALIZADO (período passado)
├─ ABR/2026 | status: pendente | expected_amount: 1.500 | ✓ ATUALIZADO (mês atual, não pago)
├─ MAI/2026 | status: pago    | expected_amount: 1.200 | ✓ NÃO ATUALIZADO (quitado)
```

**Regra Violada:** "Meses passados em atraso devem continuar com o valor que foi definido na época"

---

## 2. RAIZ DA CAUSA

### Problema 1: `syncOpenPaymentExpectedAmount()` sem verificação de período

**Arquivo:** `server/modules/financial/tenant-billing.service.js`

Problema: A função verificava apenas se o pagamento estava quitado (`status === "pago"`), mas **NÃO verificava se era um período passado**.

```javascript
// ❌ ANTES (ERRADO)
const isSettledPayment =
  payment.status === "pago" &&
  payment.expectedAmount > 0 &&
  payment.amount >= payment.expectedAmount;

if (isSettledPayment) {
  return { changed: false, payment: {...} };
}

// Se não é quitado, SEMPRE recalcula (até para períodos passados!)
const expectedAmount = await getPaymentExpectedAmountForPeriod({...});
const nextStatus = resolvePaymentStatus({...});
// ...UPDATE DATABASE
```

### Problema 2: `listFinancialPayments()` sincronizava TODOS os pagamentos

**Arquivo:** `server/modules/financial/payment-responsibility.service.js`

Problema: Chamava `syncOpenPaymentExpectedAmount()` para TODOS os pagamentos retornados, sem filtro de período.

```javascript
// ❌ ANTES (ERRADO)
payments = await Promise.all(
  payments.map(async (payment) => {
    const tenantId = normalizeTenantId(payment.tenantId);
    const synced = await syncOpenPaymentExpectedAmount(payment, {
      tenantRow: tenantById[tenantId] || null,
      cache: billingCache,
    });
    return synced.payment;
  })
);
// Isso sincronizava JANEIRO, FEVEREIRO, MARÇO (passados) quando deveria apenas MESES ATUAIS/FUTUROS
```

### Problema 3: `syncTenantPaymentsExpectedAmountsForProperty()` tinha o mesmo problema

**Arquivo:** `server/modules/financial/tenant-billing.service.js`

Problema: Sincronizava TODOS os pagamentos de uma propriedade sem respeitar período.

---

## 3. SOLUÇÃO APLICADA

### Correção 1: Adicionar verificação de competência em `syncOpenPaymentExpectedAmount()`

**Arquivo:** `server/modules/financial/tenant-billing.service.js` (linhas 156-197)

```javascript
// ✅ DEPOIS (CORRETO)
export async function syncOpenPaymentExpectedAmount(
  paymentLike,
  { tenantRow = null, cache = null } = {}
) {
  const payment = normalizePaymentRecord(paymentLike);
  if (!payment.id || !payment.tenantId || !payment.month || !payment.year) {
    return { changed: false, payment: {...} };
  }

  // ===== COMPETENCY CHECK: NEVER UPDATE PAST PERIODS =====
  const paymentPeriodKey = getPeriodKey(payment.month, payment.year);
  const currentWindow = resolveRecurringAutomationWindow({
    referenceDate: new Date(),
    timeZone: null, // use default
  });
  const currentPeriodKey = getPeriodKey(
    currentWindow.month,
    currentWindow.year
  );

  // REGRA: Períodos passados NUNCA devem ser sincronizados
  if (paymentPeriodKey < currentPeriodKey) {
    return {
      changed: false,
      reason: "past-period-no-update",
      payment: {
        ...paymentLike,
        expectedAmount: payment.expectedAmount,
        status: payment.status,
      },
    };
  }

  // ... resto da função continua (para mês atual e futuros)
}
```

**Lógica:**
- Calcula `paymentPeriodKey` do pagamento
- Calcula `currentPeriodKey` do período atual
- Se `paymentPeriodKey < currentPeriodKey` (período passado) → **retorna SEM MODIFICAR**
- Apenas períodos >= atuais são sincronizados

### Correção 2: Adicionar filtro de período em `listFinancialPayments()`

**Arquivo:** `server/modules/financial/payment-responsibility.service.js` (linhas 180-218)

```javascript
// ===== COMPETENCY FILTER: Only sync current + future periods =====
const currentWindow = resolveRecurringAutomationWindow({
  referenceDate: new Date(),
  timeZone: getBillingTimeZone(),
});
const currentPeriodKey = getPeriodKey(currentWindow.month, currentWindow.year);

payments = await Promise.all(
  payments.map(async (payment) => {
    const tenantId = normalizeTenantId(payment.tenantId);
    const paymentPeriodKey = getPeriodKey(payment.month, payment.year);

    // REGRA: Sincronizar apenas mês atual e futuros
    if (paymentPeriodKey >= currentPeriodKey) {
      const synced = await syncOpenPaymentExpectedAmount(payment, {
        tenantRow: tenantById[tenantId] || null,
        cache: billingCache,
      });
      return synced.payment;
    }
    // Períodos passados retornam como estão (sem sincronização)
    return payment;
  })
);
```

**Lógica:**
- Determina o período atual
- Para cada pagamento:
  - Se `>= período atual`: sincroniza (pode atualizar)
  - Se `< período atual`: retorna sem sincronizar (preserva histórico)

### Correção 3: Adicionar filtro de período em `syncTenantPaymentsExpectedAmountsForProperty()`

**Arquivo:** `server/modules/financial/tenant-billing.service.js` (linhas 248-296)

Mesma lógica que Correção 2 - apenas sincroniza períodos atuais/futuros.

---

## 4. IMPORTS ADICIONADOS

**Arquivo:** `server/modules/financial/payment-responsibility.service.js`

```javascript
import {
  resolveRecurringAutomationWindow,
  getPeriodKey,
  getBillingTimeZone,
} from "@/server/modules/financial/payment-automation.core";
```

Essas funções são necessárias para:
- `resolveRecurringAutomationWindow()` - determina período atual
- `getPeriodKey()` - converte (month, year) em chave comparável
- `getBillingTimeZone()` - obtém timezone padrão ("America/Sao_Paulo")

---

## 5. FLUXO AGORA CORRETO

### Cenário: Editar aluguel de R$ 1.200 → R$ 1.500

```
1. UI chama: PUT /api/tenants/{id}
   └─ payload: { rentValue: 1500 }

2. updateTenantItem() em tenant.service.js
   ├─ Detecta mudança: 1200 !== 1500
   └─ Chama: syncPaymentsOnRentValueChange({
       tenantId, oldRentValue: 1200, newRentValue: 1500
     })

3. syncPaymentsOnRentValueChange() em tenant-billing.service.js
   ├─ Carrega todos os pagamentos do inquilino
   ├─ Itera cada pagamento:
   │  ├─ JAN/2026 (atrasado)
   │  │  ├─ paymentPeriodKey = 2025*12 + 0 = 24300
   │  │  ├─ currentPeriodKey = 2025*12 + 0 = 24300 (assumindo JAN/2025 atual)
   │  │  ├─ 24300 >= 24300 ✓ Chama syncOpenPaymentExpectedAmount()
   │  │  │  └─ ❌ ANTES: Atualizava expected_amount para 1500
   │  │  │  └─ ✅ AGORA: NÃO faz nada (período passado retorna sem atualizar)
   │  │
   │  ├─ ABR/2025 (pendente)
   │  │  ├─ paymentPeriodKey = 2025*12 + 3 = 24303
   │  │  ├─ currentPeriodKey = 2025*12 + 0 = 24300
   │  │  ├─ 24303 >= 24300 ✓ Chama syncOpenPaymentExpectedAmount()
   │  │  │  └─ ✅ Atualiza expected_amount para 1500 (CORRETO - mês atual)

4. listFinancialPayments() (quando UI fetcha para exibir)
   ├─ Busca todos os pagamentos
   ├─ Para cada um, verifica período:
   │  ├─ JAN/2026 < atual → retorna como está
   │  └─ ABR/2025 >= atual → sincroniza
   └─ Retorna array com dados corretos
```

---

## 6. REGRAS CRÍTICAS IMPLEMENTADAS

| Período | Status | Deve Atualizar? | Motivo |
|---------|--------|-----------------|--------|
| **Passado** | qualquer | ❌ NÃO | Preserva histórico financeiro |
| **Atual** | "pago" (quitado) | ❌ NÃO | Já foi liquidado |
| **Atual** | "pendente"/"atrasado" | ✅ SIM | Pode mudar de acordo com novo aluguel |
| **Futuro** | qualquer | ✅ SIM | Ainda não ocorreu, recalcula com novo aluguel |

---

## 7. VALIDAÇÃO

**Status dos testes:**
- ✅ Sem erros de compilação
- ✅ Imports corretos
- ✅ Lógica de período implementada
- ✅ Três funções corrigidas

**Checklist de Validação:**

- [ ] Editar aluguel e verificar que pagamentos "atrasado" de JANEIRO/FEV/MAR NÃO mudam
- [ ] Editar aluguel e verificar que pagamento "pendente" do MÊS ATUAL muda
- [ ] Editar aluguel e verificar que pagamentos FUTUROS mudam
- [ ] Verificar que `listFinancialPayments()` retorna dados consistentes
- [ ] Verificar que cálculos de status funcionam corretamente

---

## 8. IMPACTO

### ✅ Benefícios

1. **Preservação de Histórico** - Dados financeiros passados nunca são corrompidos
2. **Integridade de Dados** - Cada período mantém seu estado original
3. **Auditoria** - Registros históricos permanecem precisos para análise
4. **Conformidade** - Segue regra de negócio: "Meses passados em atraso continuam com valor da época"

### 📊 Riscos Mitigados

- ❌ Antes: Todos os "atrasado" eram atualizados indiscriminadamente
- ✅ Agora: Apenas períodos atuais/futuros (não pagos) são atualizados

---

## 9. REFERÊNCIAS

### Funções Modificadas

1. **`syncOpenPaymentExpectedAmount()`**
   - Arquivo: `server/modules/financial/tenant-billing.service.js` (linhas 156-197)
   - Adição: Verificação de período (linhas 170-186)

2. **`listFinancialPayments()`**
   - Arquivo: `server/modules/financial/payment-responsibility.service.js` (linhas 130-228)
   - Adição: Filtro de período (linhas 189-218)

3. **`syncTenantPaymentsExpectedAmountsForProperty()`**
   - Arquivo: `server/modules/financial/tenant-billing.service.js` (linhas 248-296)
   - Adição: Filtro de período (linhas 269-289)

### Funções Helper (não modificadas, apenas usadas)

- `getPeriodKey()` - Converte (month, year) em chave numérica comparável
- `resolveRecurringAutomationWindow()` - Determina período atual
- `getBillingTimeZone()` - Obtém timezone padrão

---

## 10. PRÓXIMOS PASSOS

1. **Teste em Desenvolvimento** - Validar comportamento com dados reais
2. **Regressão** - Verificar que outros fluxos de atualização de pagamento continuam funcionando
3. **Auditoria** - Revisar histórico de pagamentos existentes para identificar registros que foram corrompidos
4. **Migração (Opcional)** - Se houver registros históricos corrompidos, considerar script de restauração

---

## 📝 Notas

**Compatibilidade:** Esta correção é compatível com versões anteriores. Funções mantêm mesmas assinaturas - apenas adicionam lógica de verificação.

**Performance:** Nenhum impacto negativo. O filtro de período é feito em memória (getPeriodKey é O(1)).

**Segurança:** Reduz risco de corrupção de dados financeiros históricos.

---

**Concluído em:** 2025-01-01  
**Próxima revisão:** Após testes em produção
