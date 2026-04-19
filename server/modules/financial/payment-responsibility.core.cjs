function normalizeTenantId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeEmail(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function appendMapEntry(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function addTenantIdsToSet(targetSet, tenantIds = []) {
  (tenantIds || []).forEach((tenantId) => {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (normalizedTenantId) targetSet.add(normalizedTenantId);
  });
}

function buildFinancialResponsibilityIndex({ tenants = [], units = [], properties = [] } = {}) {
  const responsibleTenantIdSet = new Set();
  const payerLinkedTenantIdSet = new Set();
  const flaggedResponsibleTenantIdSet = new Set();
  const legacyPropertyResponsibleTenantIdSet = new Set();
  const tenantIdsByEmail = new Map();
  const tenantIdsByPropertyEmail = new Map();

  (tenants || []).forEach((tenant) => {
    const tenantId = normalizeTenantId(tenant?.id ?? tenant?.tenant_id);
    if (!tenantId) return;
    const normalizedEmail = normalizeEmail(tenant?.email);
    const propertyId = normalizeTenantId(tenant?.propertyId ?? tenant?.property_id);

    appendMapEntry(tenantIdsByEmail, normalizedEmail, tenantId);
    appendMapEntry(
      tenantIdsByPropertyEmail,
      normalizedEmail && propertyId ? `${propertyId}::${normalizedEmail}` : null,
      tenantId
    );

    const isResponsible = normalizeBoolean(
      tenant?.isPaymentResponsible ?? tenant?.is_payment_responsible
    );
    if (!isResponsible) return;
    flaggedResponsibleTenantIdSet.add(tenantId);
    responsibleTenantIdSet.add(tenantId);
  });

  (units || []).forEach((unit) => {
    const tenantId = normalizeTenantId(unit?.tenantId ?? unit?.tenant_id);
    if (!tenantId) return;
    payerLinkedTenantIdSet.add(tenantId);
    responsibleTenantIdSet.add(tenantId);
  });

  (properties || []).forEach((property) => {
    const propertyId = normalizeTenantId(property?.id ?? property?.property_id);
    const normalizedEmail = normalizeEmail(
      property?.paymentResponsible ?? property?.payment_responsible
    );

    if (!normalizedEmail) return;

    const propertyScopedMatches =
      propertyId ? tenantIdsByPropertyEmail.get(`${propertyId}::${normalizedEmail}`) : null;

    if (propertyScopedMatches?.length) {
      addTenantIdsToSet(legacyPropertyResponsibleTenantIdSet, propertyScopedMatches);
      addTenantIdsToSet(responsibleTenantIdSet, propertyScopedMatches);
      return;
    }

    const globalMatches = tenantIdsByEmail.get(normalizedEmail) || [];
    if (globalMatches.length === 1) {
      addTenantIdsToSet(legacyPropertyResponsibleTenantIdSet, globalMatches);
      addTenantIdsToSet(responsibleTenantIdSet, globalMatches);
    }
  });

  // Fallback: if no financial responsibility rules are configured at all,
  // treat every tenant as financially responsible (legacy / unconfigured mode).
  const hasAnyResponsibilityConfig =
    flaggedResponsibleTenantIdSet.size > 0 ||
    payerLinkedTenantIdSet.size > 0 ||
    legacyPropertyResponsibleTenantIdSet.size > 0;

  if (!hasAnyResponsibilityConfig) {
    (tenants || []).forEach((tenant) => {
      const tenantId = normalizeTenantId(tenant?.id ?? tenant?.tenant_id);
      if (tenantId) responsibleTenantIdSet.add(tenantId);
    });
  }

  return {
    responsibleTenantIds: Array.from(responsibleTenantIdSet),
    responsibleTenantIdSet,
    payerLinkedTenantIds: Array.from(payerLinkedTenantIdSet),
    payerLinkedTenantIdSet,
    flaggedResponsibleTenantIds: Array.from(flaggedResponsibleTenantIdSet),
    flaggedResponsibleTenantIdSet,
    legacyPropertyResponsibleTenantIds: Array.from(legacyPropertyResponsibleTenantIdSet),
    legacyPropertyResponsibleTenantIdSet,
  };
}

function hasFinancialResponsibility(index, tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) return false;
  return !!index?.responsibleTenantIdSet?.has(normalizedTenantId);
}

function filterFinancialTenants(tenants = [], index) {
  return (tenants || []).filter((tenant) => hasFinancialResponsibility(index, tenant?.id));
}

function filterFinancialPayments(payments = [], index, filters = {}) {
  const filterTenantId = normalizeTenantId(filters?.tenantId);
  return (payments || []).filter((payment) => {
    const paymentTenantId = normalizeTenantId(payment?.tenantId ?? payment?.tenant_id);
    if (!hasFinancialResponsibility(index, paymentTenantId)) return false;
    if (filterTenantId && paymentTenantId !== filterTenantId) return false;
    return true;
  });
}

module.exports = {
  buildFinancialResponsibilityIndex,
  filterFinancialPayments,
  filterFinancialTenants,
  hasFinancialResponsibility,
  normalizeTenantId,
};
