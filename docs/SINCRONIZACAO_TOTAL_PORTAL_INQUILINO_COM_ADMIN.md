# Sincronizacao Total do Portal do Inquilino com o Sistema Admin

## Objetivo

Garantir que o portal do inquilino mostre sempre os mesmos valores que aparecem hoje no sistema administrativo, sem diferenca entre:

- valor devido
- vencimento
- status

Isso deve valer:

- para meses atuais
- para meses futuros
- para meses passados

Se o admin mostra um valor atualizado na tabela, o portal do inquilino deve mostrar exatamente o mesmo valor.

---

## Problema identificado

Hoje a divergencia pode acontecer porque parte da logica atual **nao recalcula meses passados** em alguns fluxos.

Ou seja:

- o admin pode exibir dados baseados na tabela `payments`
- mas o portal pode estar lendo registros que nao foram ressincronizados para o historico
- com isso, o valor do portal fica diferente do valor mais atual esperado

### Ponto tecnico principal

No arquivo:

- [server/modules/financial/payment-responsibility.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/financial/payment-responsibility.service.js)

a leitura do historico usa `listFinancialPayments(...)`, e essa funcao hoje faz sincronizacao automatica apenas quando o periodo **nao e passado**:

```txt
if (periodRelation !== "past") {
  sincroniza expectedAmount/status
}
```

Resultado:

- meses atuais e futuros podem ser ajustados na leitura
- meses passados retornam “como estao”

Se o banco antigo nao foi atualizado corretamente antes, o portal continua vendo valor antigo.

---

## Onde os dados sao atualizados hoje

### 1. Alteracao de dados do inquilino

Arquivo:

- [server/modules/tenants/service/tenant.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/tenants/service/tenant.service.js)

Quando o aluguel (`rentValue`) do inquilino muda:

```js
await syncPaymentsOnRentValueChange({
  tenantId: id,
  oldRentValue: existingTenant.rentValue,
  newRentValue: payload.rentValue,
});
```

Essa rotina chama:

- [server/modules/financial/tenant-billing.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/financial/tenant-billing.service.js)

e nela existe uma regra importante:

- pagamentos com status `pago` ficam protegidos
- pagamentos que nao sao `pago` podem ser atualizados mesmo se forem de meses passados

Entao, quando o aluguel muda:

- o banco **e atualizado**
- mas apenas para parcelas nao quitadas

### 2. Alteracao de agua/energia

Arquivo:

- [app/api/water-energy/[id]/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/water-energy/[id]/route.js)

Aqui existe um bloqueio explicito:

```js
function canUpdateHistoricalExpectedAmount(month, year) {
  return getPeriodRelationToCurrent(...) !== "past";
}
```

Ou seja:

- se agua/energia mudar em mes passado
- o `expected_amount` daquele mes **nao e recalculado**

Esse e um dos motivos mais fortes para portal e admin ficarem diferentes quando se espera “valor atual” tambem no historico.

### 3. Edicao direta de pagamento

Arquivos:

- [app/api/payments/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/payments/route.js)
- [app/api/payments/[id]/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/payments/[id]/route.js)

Essas rotas atualizam diretamente a tabela `payments`:

- `due_date`
- `amount`
- `expected_amount` preservado/recalculado conforme fluxo
- `status`

Entao:

- quando o admin salva um pagamento, o banco e atualizado
- o portal deve ler novamente do banco/API e refletir isso sem cache antigo

---

## Regra desejada para o sistema

Como voce quer que o portal fique **identico aos valores atuais do admin**, a regra correta passa a ser:

### Regra funcional

O portal do inquilino deve sempre usar o valor **mais atual que estiver salvo na tabela `payments` no banco**, independentemente do mes ser passado, atual ou futuro.

### Regra de sincronizacao

Sempre que algum dado que impacta cobranca for alterado, o sistema deve atualizar a tabela `payments`, inclusive para meses passados quando for necessario refletir o valor atual do admin.

Esses dados incluem:

- aluguel do inquilino
- dia de pagamento
- valor base de condominio
- agua/energia marcada para adicionar ao aluguel
- ajustes manuais feitos no pagamento

### Regra de leitura do portal

O portal nao deve:

- manter valor em cache local por longos periodos
- confiar em snapshot antigo
- recalcular valor por conta propria

O portal deve:

1. buscar sempre pela API oficial
2. ler os dados mais recentes da tabela `payments`
3. exibir exatamente o que veio da API

---

## Contrato definitivo entre admin e portal

### Fonte unica da verdade

A fonte oficial para o portal deve ser:

- tabela `payments`
- exposta pela API `/api/payments/tenant-history`

### Campos obrigatorios

| Finalidade | Campo |
| --- | --- |
| Valor devido atual | `expectedAmount` |
| Vencimento atual | `dueDate` |
| Valor pago | `amount` |
| Status atual | `status` |

### Regra absoluta

O portal deve exibir o mesmo payload que o admin usa como base no backend.

Se o valor do admin mudou, o portal deve fazer nova leitura e mostrar o mesmo valor.

---

## Ajuste necessario na regra de sincronizacao

Para eliminar divergencia com meses passados, a regra atual precisa ser alterada conceitualmente para:

```txt
Sincronizar expected_amount e status para qualquer periodo
sempre que a alteracao de negocio exigir refletir o valor atual do admin,
desde que a politica da empresa permita alterar historico.
```

### Traduzindo para a pratica

Hoje existem guards que bloqueiam meses passados em alguns pontos.

Para o comportamento desejado por voce, o documento funcional deve exigir:

1. Remover o bloqueio de periodo passado nas rotas/servicos que recalculam cobranca.
2. Reprocessar tambem pagamentos historicos quando houver alteracao que impacte o valor devido.
3. Fazer o portal buscar novamente os dados apos qualquer alteracao relevante.

---

## Como deve funcionar quando eu altero dados no admin

### Cenario 1. Alterei o aluguel do inquilino

Comportamento esperado:

1. O admin salva o novo `rent_value` na tabela `tenants`.
2. O sistema recalcula os `payments.expected_amount` relacionados.
3. O recalculo deve atingir tambem meses passados, se a regra de negocio for “mostrar sempre o valor atual”.
4. O portal consulta novamente `/api/payments/tenant-history`.
5. O portal exibe o mesmo valor atualizado do admin.

### Cenario 2. Alterei agua/energia de um mes passado

Comportamento esperado:

1. O admin salva o novo consumo.
2. O sistema recalcula `expected_amount` da parcela daquele mes, mesmo sendo passado.
3. O banco passa a guardar o valor atual correto.
4. O portal busca novamente a API.
5. O portal mostra exatamente o novo valor.

### Cenario 3. Editei o pagamento manualmente

Comportamento esperado:

1. O admin atualiza o registro em `payments`.
2. O portal nao reutiliza dado antigo.
3. O portal faz nova leitura da API.
4. O valor mostrado fica identico ao admin.

---

## Regra de cache e atualizacao do portal

Para evitar divergencia, o portal do inquilino deve obedecer estas regras:

1. Nao persistir lista de pagamentos como verdade local.
2. Rebuscar pagamentos ao abrir a tela.
3. Rebuscar pagamentos ao voltar para a tela.
4. Rebuscar pagamentos logo apos qualquer confirmacao de alteracao no admin, se houver integracao em tempo real.
5. Se houver ISR, cache HTTP, SWR, React Query ou cache de fetch, a estrategia deve ser configurada para invalidacao imediata.

### Diretriz funcional

Se o admin alterou e salvou, o portal deve considerar o dado anterior invalido.

---

## Causa provavel da diferenca atual

Com base no codigo atual, a diferenca provavelmente vem desta combinacao:

1. O portal depende da tabela `payments`.
2. Nem toda alteracao ressincroniza meses passados.
3. A leitura do historico financeiro tambem evita sincronizar periodos passados.
4. Assim, o portal pode ler um `expected_amount` antigo para historico.

Em especial:

- [server/modules/financial/payment-responsibility.service.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/server/modules/financial/payment-responsibility.service.js) nao sincroniza meses passados na leitura.
- [app/api/water-energy/[id]/route.js](/c:/Users/Fábio%20de%20Souza/Documents/kitnets/app/api/water-energy/[id]/route.js) bloqueia atualizacao historica.

---

## Especificacao final para o documento do outro sistema

O portal do inquilino deve seguir exatamente esta especificacao:

### Regra 1

O portal sempre deve buscar os dados mais atuais do banco pela API oficial.

### Regra 2

O valor exibido no portal deve ser exatamente o `expectedAmount` atual da tabela `payments`.

### Regra 3

O vencimento exibido no portal deve ser exatamente o `dueDate` atual da tabela `payments`.

### Regra 4

Quando houver alteracao de aluguel, condominio, agua/energia, vencimento ou pagamento, a tabela `payments` deve ser atualizada inclusive para meses passados, se a necessidade for refletir o valor atual do admin.

### Regra 5

O portal deve invalidar qualquer cache e rebuscar os pagamentos atualizados.

### Regra 6

O portal nao pode usar `amount` como “valor devido”.

### Regra 7

O portal nao pode manter logica propria que gere valor diferente do admin.

---

## Resumo executivo

Se o objetivo e que o portal fique identico aos valores atuais do sistema administrativo, entao a regra deve ser:

```txt
sempre ler o payments atual do banco
+ sempre rebuscar apos alteracoes
+ permitir ressincronizacao de historico quando a alteracao impactar a cobranca
= portal identico ao admin
```

Hoje o comportamento ainda pode divergir porque parte da logica bloqueia atualizacao de meses passados.

Para o resultado que voce quer, o documento funcional correto e:

- o banco precisa refletir o valor atual em `payments`
- inclusive historico quando aplicavel
- e o portal precisa sempre puxar esse dado atualizado

