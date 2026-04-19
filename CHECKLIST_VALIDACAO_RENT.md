# ✅ CHECKLIST DE VALIDAÇÃO - Regra de Alteração de Aluguel

## Após alterar um inquilino, verifique:

---

## 📋 TESTE 1: Mês Atual Pendente

### Setup
```sql
-- Criar inquilino
INSERT INTO tenants (id, name, rent_value, is_payment_responsible, status, start_date)
VALUES ('tenant-001', 'João Silva', 1200, true, 'ativo', '2024-01-01');

-- Criar pagamento do mês atual (PENDENTE)
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount)
VALUES (
  'payment-001',
  'tenant-001',
  4,  -- ATUAL = abril
  2026,
  'pendente',  -- AINDA NÃO FOI PAGO
  1200,  -- valor antigo
  0
);
```

### Ação
```bash
PUT /api/tenants/tenant-001
{
  "rentValue": 1500,
  "name": "João Silva",
  ...
}
```

### Verificação
```sql
SELECT id, status, expected_amount, amount
FROM payments
WHERE id = 'payment-001';

-- ✅ ESPERADO:
-- | id | status | expected_amount | amount |
-- | payment-001 | pendente | 1500 | 0 |
```

**Resultado:** ✅ PASSA / ❌ FALHA  
**Log esperado:** "syncPaymentsOnRentValueChange: updated 1 payment"

---

## 📋 TESTE 2: Mês Atual Pago

### Setup
```sql
-- Inquilino já existe

-- Criar pagamento do mês atual (PAGO)
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount, payment_date)
VALUES (
  'payment-002',
  'tenant-001',
  4,  -- ATUAL = abril
  2026,
  'pago',  -- JÁ FOI PAGO
  1200,  -- valor original
  1200,  -- PAGAMENTO RECEBIDO
  '2026-04-15'
);
```

### Ação
```bash
PUT /api/tenants/tenant-001
{
  "rentValue": 1600,  -- NOVO VALOR
  "name": "João Silva",
  ...
}
```

### Verificação
```sql
SELECT id, status, expected_amount, amount
FROM payments
WHERE id = 'payment-002';

-- ✅ ESPERADO (NÃO DEVE MUDAR):
-- | id | status | expected_amount | amount |
-- | payment-002 | pago | 1200 | 1200 |
```

**Resultado:** ✅ PASSA / ❌ FALHA  
**Validação:** expected_amount deve permanecer 1200

---

## 📋 TESTE 3: Múltiplos Períodos

### Setup
```sql
-- Meses anteriores (já pagos)
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount, payment_date)
VALUES
  ('p-mar', 'tenant-001', 3, 2026, 'pago', 1200, 1200, '2026-03-15'),
  ('p-fev', 'tenant-001', 2, 2026, 'pago', 1200, 1200, '2026-02-15');

-- Mês atual (pendente)
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount)
VALUES ('p-abr', 'tenant-001', 4, 2026, 'pendente', 1200, 0);

-- Meses futuros (pendentes)
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount)
VALUES
  ('p-mai', 'tenant-001', 5, 2026, 'pendente', 1200, 0),
  ('p-jun', 'tenant-001', 6, 2026, 'pendente', 1200, 0);
```

### Ação
```bash
PUT /api/tenants/tenant-001
{
  "rentValue": 1500,
  "name": "João Silva",
  ...
}
```

### Verificação
```sql
SELECT month, status, expected_amount, amount
FROM payments
WHERE tenant_id = 'tenant-001'
ORDER BY month ASC;

-- ✅ ESPERADO:
-- | month | status | expected_amount | amount |
-- |   2   | pago   |      1200       |  1200  | ← INTACTO (passado, pago)
-- |   3   | pago   |      1200       |  1200  | ← INTACTO (passado, pago)
-- |   4   | pendente|      1500       |   0    | ← ATUALIZADO (mês atual)
-- |   5   | pendente|      1500       |   0    | ← ATUALIZADO (futuro)
-- |   6   | pendente|      1500       |   0    | ← ATUALIZADO (futuro)
```

**Resultado:** ✅ PASSA / ❌ FALHA

---

## 📋 TESTE 4: Mesmo Valor (Sem Mudança)

### Setup
```bash
PUT /api/tenants/tenant-001
{
  "rentValue": 1500,  -- MESMO QUE JÁ ESTÁ NO DB
  "name": "João Silva",
  ...
}
```

### Verificação
```sql
SELECT id, expected_amount
FROM payments
WHERE tenant_id = 'tenant-001';

-- ✅ ESPERADO: Nenhuma alteração
-- ANTES == DEPOIS
```

**Resultado:** ✅ PASSA / ❌ FALHA  
**Log esperado:** "syncPaymentsOnRentValueChange: same-rent-value (no updates)"

---

## 📋 TESTE 5: Com Condomínio

### Setup
```sql
-- Property com condomínio
INSERT INTO properties (id, condominium_base_value)
VALUES ('prop-001', 300);

-- Inquilino atribuído à propriedade
UPDATE tenants SET property_id = 'prop-001' WHERE id = 'tenant-001';

-- Pagamentos com condomínio incluído
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount)
VALUES ('p-cond', 'tenant-001', 4, 2026, 'pendente', 1500, 0);
-- esperado_amount = rent_value (1200) + condominium (300) = 1500
```

### Ação
```bash
PUT /api/tenants/tenant-001
{
  "rentValue": 1400,  -- aumentou de 1200 para 1400
  "name": "João Silva",
  ...
}
```

### Verificação
```sql
SELECT expected_amount
FROM payments
WHERE id = 'p-cond';

-- ✅ ESPERADO: 1700
-- = rent_value (1400) + condominium (300)
```

**Resultado:** ✅ PASSA / ❌ FALHA

---

## 📋 TESTE 6: Com Água/Luz (add_to_rent = true)

### Setup
```sql
-- Consumo associado ao inquilino com add_to_rent = true
INSERT INTO water_energy_consumption (tenant_id, month, year, water_usage, electricity_usage, add_to_rent)
VALUES ('tenant-001', 4, 2026, 50, 30, true);

-- Pagamento antes do aumento
INSERT INTO payments (id, tenant_id, month, year, status, expected_amount, amount)
VALUES ('p-agua', 'tenant-001', 4, 2026, 'pendente', 1280, 0);
-- esperado_amount = rent_value (1200) + água (50) + luz (30) = 1280
```

### Ação
```bash
PUT /api/tenants/tenant-001
{
  "rentValue": 1500,
  "name": "João Silva",
  ...
}
```

### Verificação
```sql
SELECT expected_amount
FROM payments
WHERE id = 'p-agua';

-- ✅ ESPERADO: 1580
-- = rent_value (1500) + água (50) + luz (30)
```

**Resultado:** ✅ PASSA / ❌ FALHA

---

## 🔍 VERIFICAÇÕES NO BANCO DE DADOS

### Query Diagnóstica Completa
```sql
SELECT 
  p.id,
  p.month,
  p.year,
  p.status,
  p.expected_amount,
  p.amount,
  p.payment_date,
  CASE 
    WHEN p.month < MONTH(NOW()) THEN 'PASSADO'
    WHEN p.month = MONTH(NOW()) THEN 'ATUAL'
    ELSE 'FUTURO'
  END as periodo,
  CASE
    WHEN p.status = 'pago' AND p.amount >= p.expected_amount THEN 'PAGO_QUITADO'
    WHEN p.status = 'pendente' AND p.amount = 0 THEN 'ABERTO'
    WHEN p.status = 'atrasado' THEN 'ATRASADO'
    ELSE 'OUTRO'
  END as condicao,
  NOW() as data_verificacao
FROM payments p
WHERE p.tenant_id = 'tenant-001'
ORDER BY p.year ASC, p.month ASC;
```

### O que Observar
- ✅ Meses PASSADO com status PAGO_QUITADO: expected_amount INTACTO
- ✅ Meses ATUAL com status ABERTO: expected_amount ATUALIZADO
- ✅ Meses FUTURO com status ABERTO: expected_amount ATUALIZADO
- ✅ Nenhum UPDATE em massa (cada pagamento foi sincronizado)

---

## 🐛 Se Encontrar Problemas

### Erro: "Invalid time zone specified: null"
**Solução:** Verifique se `getBillingTimeZone()` foi importado em tenant-billing.service.js
```javascript
import { getBillingTimeZone } from "@/server/modules/financial/payment-automation.core";
```

### Problema: Pagamentos não foram atualizados
**Verificar:**
1. ✅ Inquilino existe no banco
2. ✅ Pagamentos existem no banco
3. ✅ rentValue foi realmente alterado (não é igual ao anterior)
4. ✅ Verifique logs do console para mensagens de erro

### Problema: Pagamentos pagos foram alterados
**Causa:** Lógica de `isSettledPayment` pode estar falhando  
**Verificar:**
```sql
-- Deve retornar true para:
SELECT 
  status = 'pago' AND expected_amount > 0 AND amount >= expected_amount as is_settled
FROM payments
WHERE id = 'payment-id';
```

---

## ✅ CHECKLIST FINAL

- [ ] Teste 1: Mês atual pendente ✅
- [ ] Teste 2: Mês atual pago ✅
- [ ] Teste 3: Múltiplos períodos ✅
- [ ] Teste 4: Mesmo valor ✅
- [ ] Teste 5: Com condomínio ✅
- [ ] Teste 6: Com água/luz ✅
- [ ] Banco de dados: verificação diagnóstica ✅
- [ ] Logs sem erros ✅
- [ ] Integridade dos dados preservada ✅

---

## 📞 SUPORTE

Se algum teste falhar, colete:
1. ID do inquilino
2. ID do pagamento problemático
3. Valores ANTES e DEPOIS
4. Mensagens de erro (console/logs)
5. Status do pagamento (pendente/pago/atrasado)
