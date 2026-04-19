const assert = require("node:assert/strict");

const {
  buildFinancialResponsibilityIndex,
  filterFinancialPayments,
  filterFinancialTenants,
  hasFinancialResponsibility,
} = require("../server/modules/financial/payment-responsibility.core.cjs");

function createScenario() {
  const tenants = [
    { id: "joao", name: "Joao", isPaymentResponsible: true },
    { id: "maria", name: "Maria", isPaymentResponsible: false },
    { id: "ana", name: "Ana", isPaymentResponsible: false },
  ];

  const units = [{ id: "unit-101", tenantId: "joao" }];
  const payments = [
    { id: "pay-1", tenantId: "joao", status: "pendente", amount: 0, expectedAmount: 1000 },
    { id: "pay-2", tenantId: "maria", status: "pendente", amount: 0, expectedAmount: 1000 },
  ];

  return {
    tenants,
    units,
    payments,
    index: buildFinancialResponsibilityIndex({ tenants, units }),
  };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("responsavel pelo pagamento aparece nas consultas financeiras", () => {
  const { tenants, payments, index } = createScenario();

  const visibleTenants = filterFinancialTenants(tenants, index);
  const visiblePayments = filterFinancialPayments(payments, index);

  assert.deepEqual(visibleTenants.map((tenant) => tenant.id), ["joao"]);
  assert.deepEqual(visiblePayments.map((payment) => payment.tenantId), ["joao"]);
});

runCase("nao responsavel nunca aparece na inadimplencia ou no historico financeiro", () => {
  const { payments, index } = createScenario();

  const overduePayments = filterFinancialPayments(payments, index);
  const mariaHistory = filterFinancialPayments(payments, index, { tenantId: "maria" });

  assert.equal(overduePayments.some((payment) => payment.tenantId === "maria"), false);
  assert.deepEqual(mariaHistory, []);
});

runCase("o indice bloqueia criacao financeira para inquilino nao responsavel", () => {
  const { index } = createScenario();

  assert.equal(hasFinancialResponsibility(index, "joao"), true);
  assert.equal(hasFinancialResponsibility(index, "maria"), false);
  assert.equal(hasFinancialResponsibility(index, "ana"), false);
});

runCase("pagador vinculado pela unidade entra no dominio financeiro mesmo com flag legado inconsistente", () => {
  const tenants = [
    { id: "leticia", name: "Leticia", isPaymentResponsible: false },
    { id: "diego", name: "Diego", isPaymentResponsible: false },
  ];
  const units = [{ id: "unit-201", tenantId: "leticia" }];
  const payments = [
    { id: "pay-leticia", tenantId: "leticia", status: "pendente", amount: 0, expectedAmount: 900 },
    { id: "pay-diego", tenantId: "diego", status: "pendente", amount: 0, expectedAmount: 900 },
  ];

  const index = buildFinancialResponsibilityIndex({ tenants, units });
  const visiblePayments = filterFinancialPayments(payments, index);

  assert.equal(hasFinancialResponsibility(index, "leticia"), true);
  assert.equal(hasFinancialResponsibility(index, "diego"), false);
  assert.deepEqual(visiblePayments.map((payment) => payment.tenantId), ["leticia"]);
});

runCase("responsavel legado do imovel continua aparecendo nas consultas financeiras", () => {
  const tenants = [
    {
      id: "carlos",
      name: "Carlos",
      email: "carlos@kitnets.test",
      propertyId: "prop-1",
      isPaymentResponsible: false,
    },
    {
      id: "bruna",
      name: "Bruna",
      email: "bruna@kitnets.test",
      propertyId: "prop-1",
      isPaymentResponsible: false,
    },
  ];
  const properties = [
    {
      id: "prop-1",
      paymentResponsible: "carlos@kitnets.test",
    },
  ];
  const payments = [
    { id: "pay-carlos", tenantId: "carlos", status: "pendente", amount: 0, expectedAmount: 950 },
    { id: "pay-bruna", tenantId: "bruna", status: "pendente", amount: 0, expectedAmount: 950 },
  ];

  const index = buildFinancialResponsibilityIndex({ tenants, properties });
  const visiblePayments = filterFinancialPayments(payments, index);
  const visibleTenants = filterFinancialTenants(tenants, index);

  assert.equal(hasFinancialResponsibility(index, "carlos"), true);
  assert.equal(hasFinancialResponsibility(index, "bruna"), false);
  assert.deepEqual(visibleTenants.map((tenant) => tenant.id), ["carlos"]);
  assert.deepEqual(visiblePayments.map((payment) => payment.tenantId), ["carlos"]);
});

console.log("financial responsibility tests passed");
