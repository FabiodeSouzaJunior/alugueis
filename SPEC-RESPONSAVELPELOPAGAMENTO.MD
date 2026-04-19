# SPEC-RESPONSAVELPELOPAGAMENTO.MD

## 1. Objetivo

Garantir que a funcionalidade de **Responsavel pelo Pagamento** seja totalmente integrada entre as paginas de **Inquilinos** e **Imoveis**, respeitando a arquitetura, validacoes existentes e fluxo de dados, de forma que:

- Ao registrar um inquilino como responsavel pelo pagamento, ele apareca automaticamente na unidade correspondente na pagina de imoveis.
- Ao registrar um responsavel pelo pagamento na pagina de imoveis, a informacao seja refletida no registro do inquilino.
- O email do responsavel seja sempre obrigatorio antes de marcar como responsavel pelo pagamento.

---

## 2. Contexto

- Projeto com **frontend feature-based** (`features/`) e **modular monolith backend** (`server/modules/`), API em `app/api/`.
- Atualmente, paginas de Imoveis e Inquilinos tem formularios separados.
- A opcao de responsavel pelo pagamento existe, mas nao ha **sincronizacao automatica** entre as paginas nem validacao de email obrigatoria ao marcar o responsavel.

---

## 3. Requisitos Funcionais

### 3.1 Sincronizacao entre paginas

1. Registrar inquilino como responsavel pelo pagamento na pagina de **Inquilinos**:
   - Deve analisar a unidade onde o inquilino mora.
   - Registrar automaticamente na pagina de **Imoveis**, na unidade correspondente, como responsavel pelo pagamento.

2. Registrar responsavel pelo pagamento na pagina de **Imoveis**:
   - Deve criar ou atualizar o registro do inquilino correspondente.
   - Marcar o inquilino como responsavel pelo pagamento no registro do inquilino.

### 3.2 Validacao de email

- Antes de marcar um inquilino como responsavel pelo pagamento em qualquer pagina:
  - **Email e obrigatorio**
  - Caso nao esteja preenchido, nao permitir marcar como responsavel
  - Mensagem de erro clara deve ser exibida ao usuario

### 3.3 Consistencia de dados

- Responsavel pelo pagamento deve ser unico por unidade? *(se sim, implementar validacao de unicidade)*
- Atualizacoes de dados devem refletir automaticamente em ambas as paginas.
- Toda logica deve respeitar os **DTOs existentes** e o fluxo de dados ja implementado.

---

## 4. Fluxo de Usuario

### 4.1 Na pagina de Inquilinos

1. Usuario cria ou edita inquilino.
2. Marca ou desmarca "Responsavel pelo Pagamento".
3. Se marcado:
   - Email e obrigatorio
   - Validacao e realizada
4. Registro e persistido no backend.
5. Sistema atualiza automaticamente a unidade correspondente na pagina de imoveis.

### 4.2 Na pagina de Imoveis

1. Usuario seleciona unidade e clica em "Adicionar Responsavel pelo Pagamento".
2. Formulario solicita todos os dados do inquilino, incluindo **email obrigatorio**.
3. Ao submeter:
   - Inquilino e criado ou atualizado
   - Marcado como responsavel pelo pagamento
   - Registro sincronizado automaticamente na pagina de Inquilinos

---

## 5. Regras de Arquitetura

- **Frontend:**
  - Usar componentes, hooks e servicos existentes (`features/tenants/` e `features/imoveis/`)
  - Modal/div de cadastro deve ser consistente entre paginas
  - Validacoes devem ser reusaveis e centralizadas

- **Backend:**
  - Controller, service e repository no modulo `tenants` devem tratar criacao/atualizacao
  - Toda persistencia deve garantir **integridade e sincronizacao** entre imovel e inquilino
  - Logica de negocio nao deve estar em API routes

- **API:**
  - Rotas existentes de tenants devem ser usadas
  - Endpoint adicional para sincronizacao entre imovel e inquilino pode ser criado se necessario

---

## 6. Regras de UX/UI

- Checkbox/toggle "Responsavel pelo Pagamento" visivel e intuitivo
- Campos obrigatorios claramente indicados
- Mensagem de erro se email nao preenchido
- Atualizacao automatica na interface (lista de inquilinos e unidade de imovel)
- Reutilizar estilos e componentes existentes

---

## 7. Testes Recomendados

1. Criar inquilino como responsavel na pagina de Inquilinos -> verificar atualizacao automatica na unidade do imovel
2. Criar responsavel na pagina de Imoveis -> verificar atualizacao no registro do inquilino
3. Tentar marcar responsavel sem email -> validar que nao e permitido
4. Editar responsavel -> validar sincronizacao bidirecional
5. Verificar validacoes de email, CPF/documento e demais campos obrigatorios

---

## 8. Observacoes

- Toda a logica deve ser implementada **respeitando a arquitetura feature-based e modular monolith**.
- Reutilize codigo existente sempre que possivel para evitar duplicacao.
- Sincronizacao e validacao de dados sao obrigatorias para consistencia entre paginas.
