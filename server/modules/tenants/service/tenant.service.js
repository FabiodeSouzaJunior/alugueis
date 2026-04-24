import { createNotification } from "@/lib/notificationService";
import { generateId } from "@/lib/generateId";
import {
  invalidateFinancialResponsibilityCache,
  listFinancialTenants,
} from "@/server/modules/financial/payment-responsibility.service";
import {
  ensurePaidPaymentsUntilCurrentMonth,
  ensureRecurringPaymentsForTenant,
} from "@/server/modules/financial/payment-generation.service";
import { syncPaymentsOnRentValueChange } from "@/server/modules/financial/tenant-billing.service";
import {
  detectTenantsHasOrganizationId,
  resolveOrganizationIdForTenant,
} from "@/lib/organizationScope";
import {
  assignTenantPayerLink,
  assignTenantResidentLink,
  clearTenantPayerLinks,
  clearTenantResidentLinks,
  deleteTenantRecord,
  findUnitPayerTenantId,
  findTenantByEmail,
  findTenantById,
  getSchemaSupportSummary,
  insertTenantRecord,
  listPayerUnitsByTenantId,
  listTenants,
  refreshPropertyPaymentResponsible,
  setPropertyPaymentResponsible,
  updateTenantHousingLink,
  updateTenantPaymentResponsibleStatus,
  updateTenantRecord,
} from "../repository/tenant.repository";
import { buildValidationError } from "../dto/tenant.dto";

function collectAffectedPropertyIds(previousTenant, payerUnits, nextTenant) {
  const ids = new Set();

  (payerUnits || []).forEach((unit) => {
    if (unit?.property_id) ids.add(String(unit.property_id));
  });

  if (previousTenant?.propertyId && previousTenant?.isPaymentResponsible) {
    ids.add(String(previousTenant.propertyId));
  }

  if (nextTenant?.propertyId) {
    ids.add(String(nextTenant.propertyId));
  }

  return ids;
}

async function ensureTenantSchemaReady(payload) {
  const support = await getSchemaSupportSummary();
  const missingColumns = [];

  if (!support.hasDocumentNumber) missingColumns.push("tenants.document_number");
  if (!support.hasAddress) missingColumns.push("tenants.address");
  if (!support.hasAddressStreet) missingColumns.push("tenants.address_street");
  if (!support.hasAddressNumber) missingColumns.push("tenants.address_number");
  if (!support.hasAddressNeighborhood) missingColumns.push("tenants.address_neighborhood");
  if (!support.hasAddressZipCode) missingColumns.push("tenants.address_zip_code");
  if (!support.hasBirthDate) missingColumns.push("tenants.birth_date");
  if (!support.hasEmail) missingColumns.push("tenants.email");
  if (!support.hasIsPaymentResponsible) missingColumns.push("tenants.is_payment_responsible");
  if (!support.hasPaymentDay) missingColumns.push("tenants.payment_day");

  if (payload?.isPaymentResponsible && !support.hasPropertyPaymentResponsible) {
    missingColumns.push("properties.payment_responsible");
  }

  if (missingColumns.length > 0) {
    throw buildValidationError(
      `A migracao do recurso de inquilinos ainda nao foi aplicada. Faltando: ${missingColumns.join(", ")}.`,
      500
    );
  }
}

async function resolveTenantOrganizationId(payload, auth = {}) {
  const columnSupport = await detectTenantsHasOrganizationId();
  if (!columnSupport.hasOrganizationId) return null;

  const organizationId = await resolveOrganizationIdForTenant(undefined, {
    propertyId: payload.propertyId,
    organizationId: payload.organizationId || auth.organizationId,
  });

  if (!organizationId) {
    throw buildValidationError(
      "Nao foi possivel definir organization_id. Vincule o inquilino a um imovel com organizacao ou cadastre uma organizacao.",
      400
    );
  }

  return organizationId;
}

async function assertTenantEmailIsUnique(email, currentTenantId = null, organizationId = null) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return;

  const existingTenant = await findTenantByEmail(normalizedEmail, {
    excludeTenantId: currentTenantId,
    organizationId,
  });

  if (existingTenant) {
    throw buildValidationError(
      "Este email ja esta cadastrado em outro inquilino. Cada inquilino deve ter um email unico.",
      400
    );
  }
}

async function assertTenantCanBePaymentResponsible(tenantId) {
  if (!tenantId) return null;

  await ensureTenantSchemaReady({ isPaymentResponsible: true });

  const tenant = await findTenantById(tenantId);
  if (!tenant) {
    throw buildValidationError("Inquilino nao encontrado.", 404);
  }

  if (!tenant.email) {
    throw buildValidationError(
      "O inquilino precisa ter email cadastrado antes de ser marcado como responsavel pelo pagamento.",
      400
    );
  }

  return tenant;
}

async function syncResponsibleFlagFromPayerLinks(tenantId, fallbackValue = false) {
  if (!tenantId) return;
  const payerUnits = await listPayerUnitsByTenantId(tenantId);
  await updateTenantPaymentResponsibleStatus(tenantId, payerUnits.length > 0 ? true : fallbackValue);
}

async function syncTenantAssociations({ tenantId, previousTenant, nextTenant }) {
  const payerUnits = await listPayerUnitsByTenantId(tenantId);
  const affectedPropertyIds = collectAffectedPropertyIds(previousTenant, payerUnits, nextTenant);
  let replacedUnitPayerTenantId = null;

  if (nextTenant?.isPaymentResponsible && nextTenant?.propertyId && nextTenant?.unitId) {
    replacedUnitPayerTenantId = await findUnitPayerTenantId({
      propertyId: nextTenant.propertyId,
      unitId: nextTenant.unitId,
    });
  }

  await clearTenantResidentLinks(tenantId);
  if (nextTenant?.unitId && nextTenant?.propertyId) {
    await assignTenantResidentLink({
      tenantId,
      propertyId: nextTenant.propertyId,
      unitId: nextTenant.unitId,
    });
  }

  await clearTenantPayerLinks(tenantId);

  if (nextTenant?.isPaymentResponsible) {
    if (nextTenant.propertyId && nextTenant.unitId) {
      await assertTenantCanBePaymentResponsible(tenantId);
      await assignTenantPayerLink({
        tenantId,
        propertyId: nextTenant.propertyId,
        unitId: nextTenant.unitId,
      });
      await updateTenantPaymentResponsibleStatus(tenantId, true);
      await refreshPropertyPaymentResponsible(nextTenant.propertyId);
      affectedPropertyIds.delete(String(nextTenant.propertyId));
    } else if (nextTenant.propertyId) {
      await setPropertyPaymentResponsible(nextTenant.propertyId, nextTenant.email);
      affectedPropertyIds.delete(String(nextTenant.propertyId));
    }
  }

  await Promise.all(
    Array.from(affectedPropertyIds)
      .filter(Boolean)
      .map((propertyId) => refreshPropertyPaymentResponsible(propertyId))
  );

  if (replacedUnitPayerTenantId && replacedUnitPayerTenantId !== tenantId) {
    await syncResponsibleFlagFromPayerLinks(replacedUnitPayerTenantId, false);
  }

  invalidateFinancialResponsibilityCache();
}

async function ensureFinancialPaymentsForTenant(tenantId, organizationId = null) {
  if (!tenantId) return null;

  const tenant = await findTenantById(tenantId);
  if (!tenant) return null;
  if (!tenant.isPaymentResponsible || tenant.status !== "ativo" || !tenant.startDate) {
    return tenant;
  }

  await ensurePaidPaymentsUntilCurrentMonth({
    tenantId: tenant.id,
    rentValue: tenant.rentValue,
    startDate: tenant.startDate,
    organizationId,
  });
  await ensureRecurringPaymentsForTenant({
    tenantId: tenant.id,
    startDate: tenant.startDate,
    organizationId,
  });

  return tenant;
}

export async function listTenantItems(filters, auth = {}) {
  if (filters?.financialOnly) {
    return listFinancialTenants(filters);
  }
  return listTenants({ ...filters, organizationId: auth.organizationId || null });
}

export async function getTenantItem(id, auth = {}) {
  return findTenantById(id, { organizationId: auth.organizationId || null });
}

export async function createTenantItem(payload, auth = {}) {
  await ensureTenantSchemaReady(payload);
  await assertTenantEmailIsUnique(payload.email, null, auth.organizationId || null);

  const id = payload.id || generateId();
  const organizationId = await resolveTenantOrganizationId(payload, auth);

  await insertTenantRecord({ ...payload, id }, organizationId);
  await syncTenantAssociations({
    tenantId: id,
    previousTenant: null,
    nextTenant: payload,
  });
  await ensureFinancialPaymentsForTenant(id, organizationId);

  const tenant = await findTenantById(id, { organizationId: auth.organizationId || organizationId || null });
  createNotification({
    type: "tenant_created",
    title: "Novo inquilino cadastrado",
    message: payload.kitnetNumber
      ? `Novo inquilino na Kitnet ${payload.kitnetNumber}`
      : "Novo inquilino cadastrado.",
    relatedEntity: "tenant",
    relatedId: id,
    linkHref: "/inquilinos",
  }).catch(() => {});

  return tenant;
}

export async function updateTenantItem(id, payload, auth = {}) {
  await ensureTenantSchemaReady(payload);

  const organizationIdFilter = auth.organizationId || null;
  const existingTenant = await findTenantById(id, { organizationId: organizationIdFilter });
  if (!existingTenant) {
    throw buildValidationError("Inquilino nao encontrado.", 404);
  }

  await assertTenantEmailIsUnique(payload.email, id, organizationIdFilter);

  const organizationId = await resolveTenantOrganizationId(payload, auth);
  await updateTenantRecord(id, payload, organizationId);

  if (existingTenant.rentValue !== payload.rentValue) {
    await syncPaymentsOnRentValueChange({
      tenantId: id,
      oldRentValue: existingTenant.rentValue,
      newRentValue: payload.rentValue,
    });
  }

  await syncTenantAssociations({
    tenantId: id,
    previousTenant: existingTenant,
    nextTenant: payload,
  });
  await ensureFinancialPaymentsForTenant(id, organizationId);

  return findTenantById(id, { organizationId: organizationIdFilter || organizationId || null });
}

export async function deleteTenantItem(id, auth = {}) {
  const organizationIdFilter = auth.organizationId || null;
  const existingTenant = await findTenantById(id, { organizationId: organizationIdFilter });
  if (!existingTenant) {
    throw buildValidationError("Inquilino nao encontrado.", 404);
  }

  await syncTenantAssociations({
    tenantId: id,
    previousTenant: existingTenant,
    nextTenant: null,
  });

  const affectedRows = await deleteTenantRecord(id, { organizationId: organizationIdFilter });
  if (!affectedRows) {
    throw buildValidationError("Inquilino nao encontrado.", 404);
  }

  invalidateFinancialResponsibilityCache();

  return { ok: true };
}

export async function syncTenantUnitAssignments({
  propertyId,
  unitId,
  unitLabel,
  payerTenantId,
  residentTenantIds = [],
  previousPayerTenantId = null,
  validatePayerTenant = false,
}) {
  const normalizedPropertyId = propertyId ? String(propertyId).trim() : null;
  const normalizedUnitId = unitId ? String(unitId).trim() : null;
  const normalizedPayerTenantId = payerTenantId ? String(payerTenantId).trim() : null;
  const normalizedPreviousPayerTenantId = previousPayerTenantId
    ? String(previousPayerTenantId).trim()
    : null;
  const normalizedResidentTenantIds = Array.from(
    new Set(
      (residentTenantIds || [])
        .map((tenantId) => (tenantId ? String(tenantId).trim() : ""))
        .filter(Boolean)
    )
  );

  if (!normalizedPropertyId || !normalizedUnitId) {
    throw buildValidationError("Imovel e unidade sao obrigatorios para sincronizar o responsavel.", 400);
  }

  if (validatePayerTenant && normalizedPayerTenantId) {
    await assertTenantCanBePaymentResponsible(normalizedPayerTenantId);
  }

  const linkedTenantIds = Array.from(
    new Set([normalizedPayerTenantId, ...normalizedResidentTenantIds].filter(Boolean))
  );

  await Promise.all(
    linkedTenantIds.map((linkedTenantId) =>
      updateTenantHousingLink(linkedTenantId, {
        propertyId: normalizedPropertyId,
        kitnetNumber: unitLabel || null,
      })
    )
  );

  if (normalizedPayerTenantId) {
    await clearTenantPayerLinks(normalizedPayerTenantId);
    await assignTenantPayerLink({
      tenantId: normalizedPayerTenantId,
      propertyId: normalizedPropertyId,
      unitId: normalizedUnitId,
    });
    await updateTenantPaymentResponsibleStatus(normalizedPayerTenantId, true);
  }

  if (
    normalizedPreviousPayerTenantId &&
    normalizedPreviousPayerTenantId !== normalizedPayerTenantId
  ) {
    await syncResponsibleFlagFromPayerLinks(normalizedPreviousPayerTenantId, false);
  }

  await refreshPropertyPaymentResponsible(normalizedPropertyId);
  invalidateFinancialResponsibilityCache();
  await ensureFinancialPaymentsForTenant(normalizedPayerTenantId);
}

export { assertTenantCanBePaymentResponsible };
