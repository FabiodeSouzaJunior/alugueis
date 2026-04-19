# Teste - Atualização de Valor de Aluguel

## Teste 1: Mês Atual Pendente

### Preparação
1. Crie um inquilino com:
   - rentValue = 1200
   - startDate = (data anterior ao mês atual)
   - isPaymentResponsible = true

2. Verifique que existe pagamento para o mês atual com:
   - status = "pendente"
   - amount = 0
   - expected_amount = 1200

### Execução
```bash
PUT /api/tenants/[tenantId]
{
  "rentValue": 1400,
  ... (outros campos)
}
```

### Validação Esperada
- O pagamento do mês atual deve ter:
  - expected_amount = 1400 ✓ (ATUALIZADO)
  - status = "pendente" ✓ (mantém pendente)
  - amount = 0 ✓ (sem pagamento)

### Verificação no DB
```sql
SELECT id, month, year, status, expected_amount, amount 
FROM payments 
WHERE tenant_id = '[tenantId]' AND YEAR(DATE_TRUNC('month', CURRENT_DATE)) = YEAR(CURRENT_DATE)
ORDER BY month DESC LIMIT 1;
```

---

## Teste 2: Mês Atual Pago

### Preparação
1. Crie um inquilino com:
   - rentValue = 1200
   - startDate = (data anterior ao mês atual)
   - isPaymentResponsible = true

2. Crie/registre um pagamento para o mês anterior com:
   - status = "pago"
   - amount = 1200
   - expected_amount = 1200

3. Verifique que existe pagamento para o mês atual:
   - status = "pago" (simule um pagamento recebido)
   - amount = 1200
   - expected_amount = 1200

### Execução
```bash
PUT /api/tenants/[tenantId]
{
  "rentValue": 1400,
  ... (outros campos)
}
```

### Validação Esperada
- O pagamento do mês atual deve PERMANECER:
  - expected_amount = 1200 ✓ (NÃO ALTERADO)
  - status = "pago" ✓ (mantém pago)
  - amount = 1200 ✓ (mantém valor original)

### Verificação no DB
```sql
SELECT id, month, year, status, expected_amount, amount 
FROM payments 
WHERE tenant_id = '[tenantId]' 
ORDER BY year DESC, month DESC LIMIT 2;
-- O mês anterior deve estar intacto
-- O mês atual deve estar intacto
```

---

## Teste 3: Múltiplos Períodos

### Preparação
1. Crie um inquilino com:
   - rentValue = 1200
   - startDate = (data há 3+ meses atrás)
   - isPaymentResponsible = true

2. Gere pagamentos históricos via POST /api/payments/generate (ou espere a sincronização)

3. Verifique o estado dos pagamentos:
```sql
SELECT month, year, status, expected_amount, amount 
FROM payments 
WHERE tenant_id = '[tenantId]'
ORDER BY year ASC, month ASC;
```

### Execução
```bash
PUT /api/tenants/[tenantId]
{
  "rentValue": 1500,
  ... (outros campos)
}
```

### Validação Esperada

**Meses Passados (antes do mês atual):**
- Todos os pagamentos "pago" devem estar INTACTOS ✓
- expected_amount original deve ser preservado

**Mês Atual:**
- Se "pendente" → expected_amount = 1500 ✓ (ATUALIZADO)
- Se "pago" e quitado → expected_amount original ✓ (NÃO ALTERADO)

**Meses Futuros:**
- Todos os pagamentos abertos → expected_amount = 1500 ✓ (ATUALIZADO)

### Verificação no DB
```sql
SELECT month, year, status, expected_amount, amount,
       CASE WHEN month < MONTH(CURRENT_DATE()) THEN 'PASSADO'
            WHEN month = MONTH(CURRENT_DATE()) THEN 'ATUAL'
            ELSE 'FUTURO' END as periodo
FROM payments 
WHERE tenant_id = '[tenantId]'
ORDER BY year ASC, month ASC;
```

---

## Teste 4: Sem Mudança de Aluguel

### Preparação
Crie um inquilino com rentValue = 1200

### Execução
```bash
PUT /api/tenants/[tenantId]
{
  "rentValue": 1200,  -- MESMO VALOR
  ... (outros campos)
}
```

### Validação Esperada
- Nenhum pagamento deve ser alterado
- `syncPaymentsOnRentValueChange()` deve retornar `{ changed: false, reason: "same-rent-value", updatedPayments: 0 }`

---

## Teste 5: Integração com Condomínio

### Preparação
1. Crie um imóvel com condomínio
2. Crie um inquilino com:
   - rentValue = 1200
   - propertyId = (imóvel com condomínio)
   - isPaymentResponsible = true

3. Verifique que o expected_amount inclui condomínio:
   - expected_amount = 1200 + [condominiumAmount]

### Execução
```bash
PUT /api/tenants/[tenantId]
{
  "rentValue": 1400,
  ... (outros campos)
}
```

### Validação Esperada
- O expected_amount deve ser recalculado:
  - expected_amount = 1400 + [mesmoCondominiumAmount]
- O condomínio NÃO muda (apenas aluguel base)
- Valor total aumenta em 200

---

## Teste 6: Integração com Água/Luz

### Preparação
1. Crie um inquilino com:
   - rentValue = 1200
   - isPaymentResponsible = true

2. Registre consumo de água/luz com add_to_rent = true:
   - water_usage = 50
   - electricity_usage = 30

3. Verifique expected_amount:
   - expected_amount = 1200 + 50 + 30 = 1280

### Execução
```bash
PUT /api/tenants/[tenantId]
{
  "rentValue": 1400,
  ... (outros campos)
}
```

### Validação Esperada
- O expected_amount deve ser:
  - expected_amount = 1400 + 50 + 30 = 1480
- Água/luz são mantidos (apenas base do aluguel muda)

---

## Script de Teste Manual (SQL)

```sql
-- Verificar inquilino
SELECT id, name, rent_value, status FROM tenants 
WHERE id = '[tenantId]';

-- Verificar todos os pagamentos
SELECT 
  id, 
  month, 
  year,
  status, 
  expected_amount, 
  amount,
  CURRENT_DATE() as hoje,
  DATE_TRUNC('month', CURRENT_DATE()) as mes_atual
FROM payments 
WHERE tenant_id = '[tenantId]'
ORDER BY year ASC, month ASC;

-- Verificar histórico antes/depois
-- Execute antes do PUT para capturar estado inicial
-- Execute depois do PUT para verificar mudanças
```

---

## Critérios de Sucesso

✅ Pagamentos antigos pagos: NUNCA são alterados
✅ Mês atual pendente: SEMPRE atualizado para novo aluguel
✅ Mês atual pago: NUNCA é alterado
✅ Meses futuros pendentes: SEMPRE recebem novo aluguel
✅ Condomínio: respeitado e recalculado se houver
✅ Água/luz: respeitado e recalculado se houver
✅ Status "atrasado": recalculado com novo expected_amount
✅ Integridade do histórico: preservada 100%
✅ Sem UPDATE em massa incorreto
✅ Cache de sincronização funciona
