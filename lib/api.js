const BASE = "";
// Capture at load time so bundler doesn't drop the reference at call site
const SafeError = (function () {
  try {
    if (typeof globalThis !== "undefined" && globalThis.Error) return globalThis.Error;
    if (typeof Error !== "undefined") return Error;
  } catch (_) {}
  return null;
})();

function createError(msg) {
  // Never depend on constructors here (avoids "undefined is not a function" in some bundles)
  const e = { name: "Error", message: msg };
  throw e;
}

async function getAuthToken() {
  try {
    const { getBrowserSupabaseClient } = await import("@/lib/supabase-browser");
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function authHeaders(extra = {}) {
  const token = await getAuthToken();
  const headers = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function handleRes(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : (res.statusText || "Request failed");
    createError(msg);
  }
  return data;
}

async function authFetch(url, options = {}) {
  const headers = await authHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}

export async function fetchTenants(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/tenants${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function createTenant(payload) {
  const res = await authFetch(`${BASE}/api/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateTenant(id, payload) {
  const res = await authFetch(`${BASE}/api/tenants/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteTenant(id) {
  const res = await authFetch(`${BASE}/api/tenants/${id}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchPayments(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/payments${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function fetchTenantPaymentHistory(tenantId, params = {}) {
  const q = new URLSearchParams({
    tenantId,
    ...params,
  }).toString();
  const res = await authFetch(`${BASE}/api/payments/tenant-history?${q}`);
  return handleRes(res);
}

export async function syncPaymentsHistory(payload = {}) {
  const res = await authFetch(`${BASE}/api/payments/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function createPayment(payload) {
  const res = await authFetch(`${BASE}/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updatePayment(id, payload) {
  const res = await authFetch(`${BASE}/api/payments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function generatePaymentsForTenant(tenantId, rentValue, startDate) {
  const res = await authFetch(`${BASE}/api/payments/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, rentValue, startDate }),
  });
  return handleRes(res);
}

export async function fetchMaintenance() {
  const res = await authFetch(`${BASE}/api/maintenance`);
  return handleRes(res);
}

export async function fetchDashboardOverview(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/dashboard/overview${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function createMaintenance(payload) {
  const res = await authFetch(`${BASE}/api/maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateMaintenance(id, payload) {
  const res = await authFetch(`${BASE}/api/maintenance/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchExpenses() {
  const res = await authFetch(`${BASE}/api/expenses`);
  return handleRes(res);
}

export async function createExpense(payload) {
  const res = await authFetch(`${BASE}/api/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateExpense(id, payload) {
  const res = await authFetch(`${BASE}/api/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteExpense(id) {
  const res = await authFetch(`${BASE}/api/expenses/${id}`, { method: "DELETE" });
  return handleRes(res);
}

// —— Água e Luz (water-energy consumption)
export async function fetchWaterEnergyConsumption(params = {}) {
  const sp = new URLSearchParams();
  if (params.month != null && params.month !== "") sp.set("month", String(params.month));
  if (params.year != null && params.year !== "") sp.set("year", String(params.year));
  const qs = sp.toString();
  const res = await authFetch(`${BASE}/api/water-energy${qs ? `?${qs}` : ""}`);
  return handleRes(res);
}

export async function createWaterEnergyConsumption(payload) {
  const res = await authFetch(`${BASE}/api/water-energy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateWaterEnergyConsumption(id, payload) {
  const res = await authFetch(`${BASE}/api/water-energy/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteWaterEnergyConsumption(id) {
  const res = await authFetch(`${BASE}/api/water-energy/${id}`, { method: "DELETE" });
  return handleRes(res);
}

// —— Obras
export async function fetchObras() {
  const res = await authFetch(`${BASE}/api/obras`);
  return handleRes(res);
}

/** Dados agregados de todas as obras para o dashboard da listagem */
export async function fetchObrasDashboard() {
  const res = await authFetch(`${BASE}/api/obras/dashboard`);
  return handleRes(res);
}

export async function fetchObra(id) {
  const res = await authFetch(`${BASE}/api/obras/${id}`);
  return handleRes(res);
}

export async function createObra(payload) {
  const res = await authFetch(`${BASE}/api/obras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateObra(id, payload) {
  const res = await authFetch(`${BASE}/api/obras/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObra(id) {
  const res = await authFetch(`${BASE}/api/obras/${id}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchObraCosts(obraId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/costs`);
  return handleRes(res);
}

export async function createObraCost(obraId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/costs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateObraCost(obraId, costId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/costs/${costId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObraCost(obraId, costId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/costs/${costId}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchObraMaterials(obraId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/materials`);
  return handleRes(res);
}

export async function createObraMaterial(obraId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/materials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateObraMaterial(obraId, materialId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/materials/${materialId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObraMaterial(obraId, materialId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/materials/${materialId}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchObraWorkers(obraId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/workers`);
  return handleRes(res);
}

export async function createObraWorker(obraId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/workers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateObraWorker(obraId, workerId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/workers/${workerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObraWorker(obraId, workerId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/workers/${workerId}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchObraStages(obraId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stages`);
  return handleRes(res);
}

export async function createObraStage(obraId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateObraStage(obraId, stageId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stages/${stageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObraStage(obraId, stageId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stages/${stageId}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchObraStageWorkers(obraId, params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stage-workers${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function createObraStageWorker(obraId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stage-workers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObraStageWorker(obraId, linkId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/stage-workers/${linkId}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchObraAgenda(obraId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/agenda`);
  return handleRes(res);
}

export async function createObraAgendaItem(obraId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/agenda`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateObraAgendaItem(obraId, agendaId, payload) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/agenda/${agendaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteObraAgendaItem(obraId, agendaId) {
  const res = await authFetch(`${BASE}/api/obras/${obraId}/agenda/${agendaId}`, { method: "DELETE" });
  return handleRes(res);
}

// —— Condomínio
export async function fetchCondominiumBaseValues(propertyId) {
  const q = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : "";
  const res = await authFetch(`${BASE}/api/condominium/base-values${q}`);
  return handleRes(res);
}

export async function createCondominiumBaseValue(payload) {
  const res = await authFetch(`${BASE}/api/condominium/base-values`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteCondominiumBaseValue(id) {
  const res = await authFetch(`${BASE}/api/condominium/base-values/${id}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchCondominiumExpenses(propertyId) {
  const q = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : "";
  const res = await authFetch(`${BASE}/api/condominium/expenses${q}`);
  return handleRes(res);
}

export async function createCondominiumExpense(payload) {
  const res = await authFetch(`${BASE}/api/condominium/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateCondominiumExpense(id, payload) {
  const res = await authFetch(`${BASE}/api/condominium/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteCondominiumExpense(id) {
  const res = await authFetch(`${BASE}/api/condominium/expenses/${id}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchCondominiumSettings(propertyId) {
  const q = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : "";
  const res = await authFetch(`${BASE}/api/condominium/settings${q}`);
  return handleRes(res);
}

export async function updateCondominiumSettings(payload) {
  const res = await authFetch(`${BASE}/api/condominium/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchCondominiumOverview(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/condominium/overview${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function fetchCondominiumAmountForMonth(month, year, propertyId) {
  let url = `${BASE}/api/condominium/amount?month=${Number(month)}&year=${Number(year)}`;
  if (propertyId) url += `&propertyId=${encodeURIComponent(propertyId)}`;
  const res = await authFetch(url);
  const data = await handleRes(res);
  return Number(data?.amount) || 0;
}

// —— CRM Inteligência de Inquilinos
export async function fetchCrmIntelligenceOverview() {
  const res = await authFetch(`${BASE}/api/crm-intelligence/overview`);
  return handleRes(res);
}

export async function fetchTenantSatisfaction(tenantId) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await authFetch(`${BASE}/api/crm-intelligence/satisfaction${q}`);
  return handleRes(res);
}

export async function createTenantSatisfaction(payload) {
  const res = await authFetch(`${BASE}/api/crm-intelligence/satisfaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchTenantFeedback(tenantId) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await authFetch(`${BASE}/api/crm-intelligence/feedback${q}`);
  return handleRes(res);
}

export async function createTenantFeedback(payload) {
  const res = await authFetch(`${BASE}/api/crm-intelligence/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchTenantExits(tenantId) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await authFetch(`${BASE}/api/crm-intelligence/exits${q}`);
  return handleRes(res);
}

export async function createTenantExit(payload) {
  const res = await authFetch(`${BASE}/api/crm-intelligence/exits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchTenantInteractions(tenantId) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await authFetch(`${BASE}/api/crm-intelligence/interactions${q}`);
  return handleRes(res);
}

export async function createTenantInteraction(payload) {
  const res = await authFetch(`${BASE}/api/crm-intelligence/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

// —— Página de avaliação (moradores) e resident_evaluations
export async function fetchAvaliacaoKitnets() {
  const res = await authFetch(`${BASE}/api/avaliacao/kitnets`);
  return handleRes(res);
}

export async function submitAvaliacao(payload) {
  const res = await authFetch(`${BASE}/api/avaliacao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchResidentEvaluations(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/resident-evaluations${q ? `?${q}` : ""}`);
  return handleRes(res);
}

// —— Imóveis
export async function fetchProperties() {
  const res = await authFetch(`${BASE}/api/properties`);
  return handleRes(res);
}

// —— Saques
export async function fetchWithdrawals() {
  const res = await authFetch(`${BASE}/api/payments/withdrawals`);
  return handleRes(res);
}

export async function createWithdrawal(payload) {
  const res = await authFetch(`${BASE}/api/payments/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchOwnerWallet() {
  const res = await authFetch(`${BASE}/api/owner/wallet`);
  return handleRes(res);
}

export async function fetchOwnerWalletLedger(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/owner/wallet/ledger${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function fetchOwnerWithdrawals(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/owner/withdrawals${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function fetchOwnerWithdrawalById(id) {
  const res = await authFetch(`${BASE}/api/owner/withdrawals/${encodeURIComponent(id)}`);
  return handleRes(res);
}

export async function createOwnerWithdrawal(payload) {
  const res = await authFetch(`${BASE}/api/owner/withdrawals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function fetchOwnerPayoutMethods() {
  const res = await authFetch(`${BASE}/api/owner/payout-methods`);
  return handleRes(res);
}

export async function createOwnerPayoutMethod(payload) {
  const res = await authFetch(`${BASE}/api/owner/payout-methods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function createProperty(payload) {
  const res = await authFetch(`${BASE}/api/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updateProperty(id, payload) {
  const res = await authFetch(`${BASE}/api/properties/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deleteProperty(id) {
  const res = await authFetch(`${BASE}/api/properties/${id}`, { method: "DELETE" });
  return handleRes(res);
}

export async function fetchPropertiesDashboard() {
  const res = await authFetch(`${BASE}/api/properties/dashboard`);
  return handleRes(res);
}

export async function fetchPropertyUnits(propertyId) {
  const res = await authFetch(`${BASE}/api/properties/${propertyId}/units`);
  return handleRes(res);
}

export async function createPropertyUnit(propertyId, payload) {
  const res = await authFetch(`${BASE}/api/properties/${propertyId}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function updatePropertyUnit(propertyId, unitId, payload) {
  const res = await authFetch(`${BASE}/api/properties/${propertyId}/units/${unitId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}

export async function deletePropertyUnit(propertyId, unitId) {
  const res = await authFetch(`${BASE}/api/properties/${propertyId}/units/${unitId}`, { method: "DELETE" });
  return handleRes(res);
}

// —— Notificações
export async function fetchNotifications(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await authFetch(`${BASE}/api/notifications${q ? `?${q}` : ""}`);
  return handleRes(res);
}

export async function markNotificationRead(id) {
  const res = await authFetch(`${BASE}/api/notifications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ read: true }),
  });
  return handleRes(res);
}

export async function markAllNotificationsRead() {
  const res = await authFetch(`${BASE}/api/notifications/read-all`, { method: "PATCH" });
  return handleRes(res);
}

export async function fetchNotificationPreferences() {
  const res = await authFetch(`${BASE}/api/notification-preferences`);
  return handleRes(res);
}

export async function updateNotificationPreferences(payload) {
  const res = await authFetch(`${BASE}/api/notification-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleRes(res);
}
