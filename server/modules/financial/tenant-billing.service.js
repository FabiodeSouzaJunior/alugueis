import { pool } from "@/lib/db";
import { getCondominiumBaseAmountForMonth } from "@/lib/condominium";
import { calculateTenantAmountDue, normalizeMoney } from "@/lib/tenant-billing";
import { generateId } from "@/lib/generateId";
import { getDueDateForPeriod } from "@/lib/payment-dates";
import {
  detectPaymentsHasOrganizationId,
  resolveOrganizationIdForPayment,
} from "@/lib/organizationScope";
import {
  resolveCalculatedPaymentStatus,
  getPeriodKey,
  getCurrentPeriodKey,
  getPeriodRelationToCurrent,
  getBillingTimeZone,
} from "@/server/modules/financial/payment-automation.core";

function normalizePaymentRecord(paymentLike = {}) {
  const rawExpectedAmount = paymentLike.expectedAmount ?? paymentLike.expected_amount;

  return {
    id: paymentLike.id ?? null,
    tenantId: paymentLike.tenantId ?? paymentLike.tenant_id ?? null,
    month: Number(paymentLike.month),
    year: Number(paymentLike.year),
    amount: normalizeMoney(paymentLike.amount),
    paymentDate: paymentLike.paymentDate ?? paymentLike.payment_date ?? null,
    dueDate: paymentLike.dueDate ?? paymentLike.due_date ?? null,
    expectedAmount: normalizeMoney(rawExpectedAmount),
    hasExpectedAmount: rawExpectedAmount != null && rawExpectedAmount !== "",
    status: String(paymentLike.status || "").toLowerCase(),
    createdAt: paymentLike.createdAt ?? paymentLike.created_at ?? null,
    updatedAt: paymentLike.updatedAt ?? paymentLike.updated_at ?? null,
  };
}

function resolvePaymentStatus({ paymentDate, dueDate, amount, expectedAmount }) {
  return resolveCalculatedPaymentStatus({
    paymentDate,
    dueDate,
    amount: normalizeMoney(amount),
    expectedAmount: normalizeMoney(expectedAmount),
  });
}

async function readTenantBillingRow(tenantId) {
  const [rows] = await pool.query(
    "SELECT id, rent_value, property_id, payment_day FROM tenants WHERE id = ?",
    [tenantId]
  );
  return rows?.[0] || null;
}

async function getCachedCondominiumAmountForPeriod({ month, year, propertyId, cache = null }) {
  const cacheKey = `${propertyId || "__default__"}:${year}-${month}`;
  if (cache?.condominiumByPeriod?.has(cacheKey)) {
    return cache.condominiumByPeriod.get(cacheKey);
  }

  const amount = await getCondominiumBaseAmountForMonth(
    Number(month),
    Number(year),
    propertyId
  );
  if (cache?.condominiumByPeriod) {
    cache.condominiumByPeriod.set(cacheKey, amount);
  }
  return amount;
}

async function getTenantChargeableAdditionsForPeriod({
  tenantId,
  month,
  year,
  cache = null,
}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : "";
  if (!normalizedTenantId) return 0;

  const cacheKey = `${normalizedTenantId}:${year}-${month}`;
  if (cache?.chargeableAdditionsByPeriod?.has(cacheKey)) {
    return cache.chargeableAdditionsByPeriod.get(cacheKey);
  }

  const [rows] = await pool.query(
    `SELECT water_usage, electricity_usage, add_to_rent
       FROM water_energy_consumption
      WHERE tenant_id = ? AND month = ? AND year = ?`,
    [normalizedTenantId, Number(month), Number(year)]
  );

  const row = rows?.[0] || null;
  const addToRent =
    row?.add_to_rent === true ||
    row?.add_to_rent === 1 ||
    row?.add_to_rent === "1" ||
    row?.add_to_rent === "true";
  const additionalCharges = addToRent
    ? normalizeMoney(row?.water_usage) + normalizeMoney(row?.electricity_usage)
    : 0;

  if (cache?.chargeableAdditionsByPeriod) {
    cache.chargeableAdditionsByPeriod.set(cacheKey, additionalCharges);
  }

  return additionalCharges;
}

export async function getTenantAmountDueForPeriod({
  tenantId,
  month,
  year,
  tenantRow = null,
  cache = null,
}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : "";
  if (!normalizedTenantId) return 0;

  const tenant = tenantRow || (await readTenantBillingRow(normalizedTenantId));
  if (!tenant) return 0;

  const condominiumValue = await getCachedCondominiumAmountForPeriod({
    month,
    year,
    propertyId: tenant.property_id || tenant.propertyId || null,
    cache,
  });

  return calculateTenantAmountDue({
    rentValue: tenant.rent_value ?? tenant.rentValue ?? 0,
    condominiumValue,
  });
}

export async function getPaymentExpectedAmountForPeriod({
  tenantId,
  month,
  year,
  tenantRow = null,
  cache = null,
}) {
  const tenantAmountDue = await getTenantAmountDueForPeriod({
    tenantId,
    month,
    year,
    tenantRow,
    cache,
  });
  const additionalCharges = await getTenantChargeableAdditionsForPeriod({
    tenantId,
    month,
    year,
    cache,
  });

  return calculateTenantAmountDue({
    rentValue: tenantAmountDue,
    extraCharges: additionalCharges,
  });
}

export async function syncOpenPaymentExpectedAmount(
  paymentLike,
  {
    tenantRow = null,
    cache = null,
    ignorePeriodGuard = false,
    preserveManualExpectedAmount = false,
  } = {}
) {
  const payment = normalizePaymentRecord(paymentLike);
  if (!payment.id || !payment.tenantId || !payment.month || !payment.year) {
    return {
      changed: false,
      payment: {
        ...paymentLike,
        expectedAmount: payment.expectedAmount,
        status: payment.status || paymentLike?.status || "pendente",
      },
    };
  }

  // REGRA: status "pago" protege o registro independente de qualquer outra condição.
  const isSettledPayment = payment.status === "pago";
  if (isSettledPayment) {
    return {
      changed: false,
      reason: "settled-payment",
      payment: {
        ...paymentLike,
        expectedAmount: payment.expectedAmount,
        status: payment.status,
      },
    };
  }

  // Guarda de período: bloqueia meses passados, a menos que ignorePeriodGuard esteja ativo.
  // Quando ignorePeriodGuard=true, apenas o status determina se o pagamento é atualizado.
  if (!ignorePeriodGuard) {
    const periodRelation = getPeriodRelationToCurrent({
      month: payment.month,
      year: payment.year,
      referenceDate: new Date(),
      timeZone: getBillingTimeZone(),
    });

    if (periodRelation === "past") {
      return {
        changed: false,
        reason: "past-period-no-update",
        payment: {
          ...paymentLike,
          expectedAmount: payment.expectedAmount,
          status: payment.status,
        },
      };
    }
  }

  const expectedAmount = await getPaymentExpectedAmountForPeriod({
    tenantId: payment.tenantId,
    month: payment.month,
    year: payment.year,
    tenantRow,
    cache,
  });

  if (
    preserveManualExpectedAmount &&
    payment.hasExpectedAmount &&
    payment.expectedAmount !== expectedAmount
  ) {
    const currentStatus = resolvePaymentStatus({
      paymentDate: payment.paymentDate,
      dueDate: payment.dueDate,
      amount: payment.amount,
      expectedAmount: payment.expectedAmount,
    });

    if (currentStatus !== payment.status) {
      await pool.query(
        `UPDATE payments
            SET status = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [currentStatus, payment.id]
      );
    }

    return {
      changed: currentStatus !== payment.status,
      reason: "stored-expected-amount-preserved",
      payment: {
        ...paymentLike,
        expectedAmount: payment.expectedAmount,
        status: currentStatus,
      },
    };
  }

  const nextStatus = resolvePaymentStatus({
    paymentDate: payment.paymentDate,
    dueDate: payment.dueDate,
    amount: payment.amount,
    expectedAmount,
  });
  const changed =
    expectedAmount !== payment.expectedAmount ||
    nextStatus !== (payment.status || "pendente");

  if (changed) {
    await pool.query(
      `UPDATE payments
          SET expected_amount = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [expectedAmount, nextStatus, payment.id]
    );
  }

  return {
    changed,
    payment: {
      ...paymentLike,
      expectedAmount,
      status: nextStatus,
    },
  };
}

export async function syncTenantPaymentsExpectedAmountsForProperty(propertyId) {
  const normalizedPropertyId = propertyId != null ? String(propertyId).trim() : "";
  if (!normalizedPropertyId) {
    return { updatedRows: 0, skippedRows: 0 };
  }

  const [tenantRows] = await pool.query(
    "SELECT id, rent_value, property_id FROM tenants WHERE property_id = ?",
    [normalizedPropertyId]
  );

  let updatedRows = 0;
  let skippedRows = 0;
  const cache = {
    condominiumByPeriod: new Map(),
    chargeableAdditionsByPeriod: new Map(),
  };

  const currentPeriodKey = getCurrentPeriodKey({
    referenceDate: new Date(),
    timeZone: getBillingTimeZone(),
  });

  for (const tenantRow of tenantRows || []) {
    const [paymentRows] = await pool.query(
      `SELECT id, tenant_id, month, year, amount, payment_date, due_date, status, expected_amount
         FROM payments
        WHERE tenant_id = ?`,
      [tenantRow.id]
    );

    for (const paymentRow of paymentRows || []) {
      const paymentPeriodKey = getPeriodKey(paymentRow.month, paymentRow.year);
      
      // REGRA: Sincronizar apenas mês atual e futuros
      if (paymentPeriodKey >= currentPeriodKey) {
        const result = await syncOpenPaymentExpectedAmount(paymentRow, {
          tenantRow,
          cache,
        });
        if (result.changed) updatedRows += 1;
        else skippedRows += 1;
      } else {
        // Períodos passados não são sincronizados
        skippedRows += 1;
      }
    }
  }

  return { updatedRows, skippedRows };
}

export async function buildMissingPaymentForTenant({
  tenantId,
  month,
  year,
  tenantRow = null,
  cache = null,
}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : "";
  if (!normalizedTenantId) return null;

  const tenant = tenantRow || (await readTenantBillingRow(normalizedTenantId));
  if (!tenant) return null;

  const expectedAmount = await getPaymentExpectedAmountForPeriod({
    tenantId: normalizedTenantId,
    month,
    year,
    tenantRow: tenant,
    cache,
  });
  const tenantPaymentDay = tenant.payment_day ?? tenant.paymentDay;

  return {
    id: generateId(),
    tenantId: normalizedTenantId,
    month: Number(month),
    year: Number(year),
    dueDate: getDueDateForPeriod(Number(month), Number(year), tenantPaymentDay),
    amount: expectedAmount,
    expectedAmount,
  };
}

export async function resolveTenantPaymentOrganizationId({
  tenantId,
  organizationId = null,
}) {
  const columnSupport = await detectPaymentsHasOrganizationId();
  if (!columnSupport.hasOrganizationId) return null;

  const resolvedOrganizationId = await resolveOrganizationIdForPayment(pool, {
    tenantId,
    organizationId,
  });
  if (!resolvedOrganizationId) {
    throw new Error(
      "Nao foi possivel definir organization_id dos pagamentos. Verifique o inquilino e a organizacao."
    );
  }
  return resolvedOrganizationId;
}

export async function syncPaymentsOnRentValueChange({
  tenantId,
  oldRentValue = 0,
  newRentValue = 0,
  referenceDate = new Date(),
  timeZone = null,
} = {}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : "";
  if (!normalizedTenantId) {
    return { changed: false, reason: "missing-tenant-id", updatedPayments: 0 };
  }

  const oldValue = normalizeMoney(oldRentValue);
  const newValue = normalizeMoney(newRentValue);
  if (oldValue === newValue) {
    return { changed: false, reason: "same-rent-value", updatedPayments: 0 };
  }

  const [paymentRows] = await pool.query(
    `SELECT id, tenant_id, month, year, amount, payment_date, due_date, status, expected_amount
       FROM payments
      WHERE tenant_id = ?
      ORDER BY year ASC, month ASC`,
    [normalizedTenantId]
  );

  if (!paymentRows || paymentRows.length === 0) {
    return { changed: false, reason: "no-payments", updatedPayments: 0 };
  }

  const tenant = await readTenantBillingRow(normalizedTenantId);
  const cache = {
    condominiumByPeriod: new Map(),
    chargeableAdditionsByPeriod: new Map(),
  };

  let updatedPayments = 0;

  // REGRA: se guia pelo status — pagamentos não "pago" (pendente/atrasado) são
  // atualizados independentemente do período. ignorePeriodGuard=true desabilita
  // a guarda de período dentro de syncOpenPaymentExpectedAmount.
  for (const paymentRow of paymentRows) {
    const result = await syncOpenPaymentExpectedAmount(paymentRow, {
      tenantRow: tenant,
      cache,
      ignorePeriodGuard: true,
    });

    if (result.changed) {
      updatedPayments += 1;
    }
  }

  return {
    changed: updatedPayments > 0,
    reason: "rent-value-changed",
    updatedPayments,
  };
}
