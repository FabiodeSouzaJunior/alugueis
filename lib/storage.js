const KEYS = {
  TENANTS: "kitnets_tenants",
  PAYMENTS: "kitnets_payments",
  MAINTENANCE: "kitnets_maintenance",
  EXPENSES: "kitnets_expenses",
};

function safeParse(key, defaultValue = []) {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

function safeSet(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("localStorage set error", e);
  }
}

export function getTenants() {
  return safeParse(KEYS.TENANTS);
}

export function setTenants(tenants) {
  safeSet(KEYS.TENANTS, tenants);
}

export function getPayments() {
  return safeParse(KEYS.PAYMENTS);
}

export function setPayments(payments) {
  safeSet(KEYS.PAYMENTS, payments);
}

export function getMaintenance() {
  return safeParse(KEYS.MAINTENANCE);
}

export function setMaintenance(items) {
  safeSet(KEYS.MAINTENANCE, items);
}

export function getExpenses() {
  return safeParse(KEYS.EXPENSES);
}

export function setExpenses(items) {
  safeSet(KEYS.EXPENSES, items);
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
