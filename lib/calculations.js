const today = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

function getExpected(payment) {
  const raw = payment.expectedAmount;
  const expected =
    raw != null && raw !== "" && !isNaN(Number(raw)) ? Number(raw) : null;
  return expected != null ? expected : Number(payment.amount) || 0;
}

export function getPendingAmount(payment) {
  const expected = getExpected(payment);
  const paid = Number(payment.amount) || 0;
  return Math.max(0, expected - paid);
}

/**
 * Soma de todos os valores pendentes dos pagamentos.
 * Para cada pagamento: pendente = valorDevido - valorPago.
 * Só inclui na soma quando pendente > 0 (não usa status).
 * @param {Array} payments - Lista de pagamentos
 * @returns {number} Total pendente
 */
export function getTotalPending(payments) {
  if (!Array.isArray(payments)) return 0;
  return payments.reduce((total, payment) => {
    const pendente = getPendingAmount(payment);
    return total + pendente;
  }, 0);
}

export function getPaymentStatus(payment) {
  const expected = getExpected(payment);
  const paid = Number(payment.amount) || 0;

  if (paid >= expected && expected > 0) return "pago";
  if (paid > 0 && paid < expected) return "pendente";
  if (paid === 0) {
    const due = payment.dueDate || "";
    return due && due < today() ? "atrasado" : "pendente";
  }
  return "pendente";
}

export function getCurrentMonthYear() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function getPaymentsForMonth(payments, month, year) {
  if (!Array.isArray(payments)) return [];
  return payments.filter(
    (p) => Number(p.month) === Number(month) && Number(p.year) === Number(year)
  );
}

export function getExpensesForMonth(expenses, month, year) {
  if (!Array.isArray(expenses)) return [];
  return expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() + 1 === Number(month) && d.getFullYear() === Number(year);
  });
}

export function getDashboardNumbers(tenants, payments, expenses) {
  tenants = tenants || [];
  payments = payments || [];
  expenses = expenses || [];
  const { month, year } = getCurrentMonthYear();
  const monthPayments = getPaymentsForMonth(payments, month, year);
  const monthExpenses = getExpensesForMonth(expenses, month, year);

  const activeTenants = tenants.filter((t) => t.status === "ativo");
  const totalKitnets = 12;
  const occupied = activeTenants.length;
  const empty = Math.max(0, totalKitnets - occupied);

  const expectedRevenue = monthPayments.reduce((s, p) => s + getExpected(p), 0);
  const receivedRevenue = monthPayments
    .filter((p) => p.paymentDate)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdueAmount = payments
    .filter((p) => {
      const status = getPaymentStatus(p);
      return status === "atrasado" || (status === "pendente" && (p.dueDate || "") < today());
    })
    .reduce((s, p) => s + getPendingAmount(p), 0);
  const totalMonthExpenses = monthExpenses.reduce((s, e) => s + Number(e.value || 0), 0);
  const profit = receivedRevenue - totalMonthExpenses;

  return {
    totalKitnets,
    occupied,
    empty,
    expectedRevenue,
    receivedRevenue,
    overdueAmount,
    profit,
    monthExpensesTotal: totalMonthExpenses,
  };
}

export function getDashboardNumbersYear(tenants, payments, expenses, year) {
  tenants = tenants || [];
  payments = payments || [];
  expenses = expenses || [];

  const activeTenants = tenants.filter((t) => t.status === "ativo");
  const totalKitnets = 12;
  const occupied = activeTenants.length;
  const empty = Math.max(0, totalKitnets - occupied);

  const yearPayments = payments.filter((p) => Number(p.year) === year);
  const expectedRevenue = yearPayments.reduce((s, p) => s + getExpected(p), 0);
  const receivedRevenue = (payments || [])
    .filter((p) => p.paymentDate && new Date(p.paymentDate).getFullYear() === year)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdueAmount = payments
    .filter((p) => Number(p.year) === year)
    .filter((p) => {
      const status = getPaymentStatus(p);
      return status === "atrasado" || (status === "pendente" && (p.dueDate || "") < today());
    })
    .reduce((s, p) => s + getPendingAmount(p), 0);
  const totalYearExpenses = (expenses || [])
    .filter((e) => e.date && new Date(e.date).getFullYear() === year)
    .reduce((s, e) => s + Number(e.value || 0), 0);
  const profit = receivedRevenue - totalYearExpenses;

  return {
    totalKitnets,
    occupied,
    empty,
    expectedRevenue,
    receivedRevenue,
    overdueAmount,
    profit,
    totalExpenses: totalYearExpenses,
  };
}

export function getOverdueDays(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/**
 * Dados calculados para exibição de uma linha de pagamento.
 * Regras:
 * - pendente = valorDevido - valorPago (mínimo 0)
 * - diasAtraso: só quando pendente > 0 e data de vencimento já passou; senão null (exibir "-")
 * - status: "pago" | "pendente" | "atrasado" — definido apenas por valorPago vs valorDevido (mesma lógica da página Pagamentos)
 *   - valorPago === valorDevido → "pago"
 *   - valorPago === 0 → "atrasado"
 *   - valorPago > 0 e valorPago < valorDevido → "pendente"
 */
export function getPaymentRowData(payment, expectedAmountOverride = null) {
  const valorDevido =
    expectedAmountOverride != null && !isNaN(Number(expectedAmountOverride))
      ? Number(expectedAmountOverride)
      : getExpected(payment);
  const valorPago = Number(payment.amount) || 0;
  const pendente = Math.max(0, valorDevido - valorPago);

  const dueDate = payment.dueDate || "";
  const vencimentoPassou = !!dueDate && dueDate < today();
  const diasAtraso =
    pendente > 0 && vencimentoPassou ? getOverdueDays(dueDate) : null;

  let status;
  if (valorPago >= valorDevido && valorDevido > 0) {
    status = "pago";
  } else if (valorPago === 0) {
    status = "atrasado";
  } else {
    status = "pendente";
  }

  return {
    valorDevido,
    valorPago,
    pendente,
    diasAtraso,
    status,
  };
}

/**
 * Distribuição de pagamentos por status (para gráfico de pizza).
 * @param {Array} payments - Lista de pagamentos
 * @returns {Array<{ name: string, value: number, count: number }>}
 */
export function getPaymentStatusDistribution(payments) {
  if (!Array.isArray(payments)) {
    return [
      { name: "Pago", value: 0, count: 0 },
      { name: "Pendente", value: 0, count: 0 },
      { name: "Atrasado", value: 0, count: 0 },
    ];
  }
  const acc = { pago: { value: 0, count: 0 }, pendente: { value: 0, count: 0 }, atrasado: { value: 0, count: 0 } };
  payments.forEach((p) => {
    const status = getPaymentStatus(p);
    const pending = getPendingAmount(p);
    const paid = Number(p.amount) || 0;
    const expected = getExpected(p);
    if (status === "pago") {
      acc.pago.value += paid;
      acc.pago.count += 1;
    } else if (status === "atrasado") {
      acc.atrasado.value += pending;
      acc.atrasado.count += 1;
    } else {
      acc.pendente.value += pending;
      acc.pendente.count += 1;
    }
  });
  return [
    { name: "Pago", value: acc.pago.value, count: acc.pago.count },
    { name: "Pendente", value: acc.pendente.value, count: acc.pendente.count },
    { name: "Atrasado", value: acc.atrasado.value, count: acc.atrasado.count },
  ];
}

/**
 * Números do dashboard para um mês/ano específicos.
 */
export function getDashboardNumbersForPeriod(tenants, payments, expenses, month, year) {
  tenants = tenants || [];
  payments = payments || [];
  expenses = expenses || [];
  const monthPayments = getPaymentsForMonth(payments, month, year);
  const monthExpenses = getExpensesForMonth(expenses, month, year);

  const activeTenants = tenants.filter((t) => t.status === "ativo");
  const totalKitnets = 12;
  const occupied = activeTenants.length;
  const empty = Math.max(0, totalKitnets - occupied);

  const expectedRevenue = monthPayments.reduce((s, p) => s + getExpected(p), 0);
  const receivedRevenue = monthPayments
    .filter((p) => p.paymentDate)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const overdueAmount = payments
    .filter((p) => {
      const status = getPaymentStatus(p);
      return status === "atrasado" || (status === "pendente" && (p.dueDate || "") < today());
    })
    .reduce((s, p) => s + getPendingAmount(p), 0);
  const totalMonthExpenses = monthExpenses.reduce((s, e) => s + Number(e.value || 0), 0);
  const profit = receivedRevenue - totalMonthExpenses;

  return {
    totalKitnets,
    occupied,
    empty,
    expectedRevenue,
    receivedRevenue,
    overdueAmount,
    profit,
    monthExpensesTotal: totalMonthExpenses,
  };
}
