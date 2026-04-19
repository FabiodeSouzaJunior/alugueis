import { getTenants, getPayments, setPayments, generateId } from "./storage";

function getNextDueDate(startDate, month, year) {
  const d = new Date(year, month - 1, 10); // vencimento dia 10
  return d.toISOString().split("T")[0];
}

export function generatePaymentsForTenant(tenantId, rentValue, startDate) {
  const start = new Date(startDate);
  const payments = getPayments();
  const existing = payments.filter((p) => p.tenantId === tenantId);
  const existingKeys = new Set(existing.map((p) => `${p.month}-${p.year}`));

  const toAdd = [];
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  for (let y = start.getFullYear(); y <= endYear; y++) {
    const startMonth = y === start.getFullYear() ? start.getMonth() + 1 : 1;
    const lastMonth = y === endYear ? endMonth : 12;
    for (let m = startMonth; m <= lastMonth; m++) {
      const key = `${m}-${y}`;
      if (existingKeys.has(key)) continue;
      const dueDate = getNextDueDate(startDate, m, y);
      toAdd.push({
        id: generateId(),
        tenantId,
        month: m,
        year: y,
        dueDate,
        paymentDate: null,
        amount: 0,
        status: "pendente",
      });
    }
  }

  if (toAdd.length > 0) {
    setPayments([...payments, ...toAdd]);
  }
}

export function regenerateAllPaymentsFromTenants() {
  const tenants = getTenants().filter((t) => t.status === "ativo");
  const payments = getPayments();
  const existingByTenant = {};
  payments.forEach((p) => {
    if (!existingByTenant[p.tenantId]) existingByTenant[p.tenantId] = new Set();
    existingByTenant[p.tenantId].add(`${p.month}-${p.year}`);
  });

  const toAdd = [];
  const now = new Date();
  tenants.forEach((tenant) => {
    const start = new Date(tenant.startDate);
    const existing = existingByTenant[tenant.id] || new Set();
    for (let y = start.getFullYear(); y <= now.getFullYear(); y++) {
      const startMonth = y === start.getFullYear() ? start.getMonth() + 1 : 1;
      const endMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12;
      for (let m = startMonth; m <= endMonth; m++) {
        const key = `${m}-${y}`;
        if (existing.has(key)) continue;
        const dueDate = getNextDueDate(tenant.startDate, m, y);
        toAdd.push({
          id: generateId(),
          tenantId: tenant.id,
          month: m,
          year: y,
          dueDate,
          paymentDate: null,
          amount: 0,
          status: "pendente",
        });
      }
    }
  });

  if (toAdd.length > 0) {
    setPayments([...payments, ...toAdd]);
  }
}
