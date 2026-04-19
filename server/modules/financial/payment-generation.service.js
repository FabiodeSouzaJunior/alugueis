import { pool } from "@/lib/db";
import {
  buildMissingPaymentForTenant,
  resolveTenantPaymentOrganizationId,
} from "@/server/modules/financial/tenant-billing.service";
import { listFinancialTenants } from "@/server/modules/financial/payment-responsibility.service";
import {
  buildHistoricalPeriodsToCurrentMonth,
  buildRecurringPeriodsToEnsure,
  getBillingTimeZone,
  resolveCalculatedPaymentStatus,
} from "@/server/modules/financial/payment-automation.core";

function isUniquePaymentConstraintError(error) {
  const message = String(error?.message || "");
  return error?.code === "23505" || /unique_payment|duplicate key/i.test(message);
}

function normalizeStartDate(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

async function readTenantBillingRow(tenantId) {
  const [tenantRows] = await pool.query(
    "SELECT id, rent_value, property_id, payment_day, start_date, status FROM tenants WHERE id = ?",
    [tenantId]
  );
  return tenantRows?.[0] || null;
}

async function listTenantPaymentRows(tenantId) {
  const [rows] = await pool.query(
    `SELECT id, tenant_id, month, year, due_date, payment_date, amount, expected_amount, status
       FROM payments
      WHERE tenant_id = ?
      ORDER BY year ASC, month ASC`,
    [tenantId]
  );
  return rows || [];
}

async function insertGeneratedPayment({
  payment,
  amount,
  expectedAmount,
  paymentDate = null,
  status,
  organizationId = null,
}) {
  try {
    if (organizationId) {
      await pool.query(
        `INSERT INTO payments (id, tenant_id, month, year, due_date, payment_date, amount, expected_amount, status, organization_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.id,
          payment.tenantId,
          payment.month,
          payment.year,
          payment.dueDate,
          paymentDate,
          amount,
          expectedAmount,
          status,
          organizationId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO payments (id, tenant_id, month, year, due_date, payment_date, amount, expected_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.id,
          payment.tenantId,
          payment.month,
          payment.year,
          payment.dueDate,
          paymentDate,
          amount,
          expectedAmount,
          status,
        ]
      );
    }

    return {
      ...payment,
      amount,
      expectedAmount,
      paymentDate,
      status,
    };
  } catch (error) {
    if (!isUniquePaymentConstraintError(error)) {
      throw error;
    }

    return null;
  }
}

export async function ensurePaidPaymentsUntilCurrentMonth({
  tenantId,
  startDate,
  organizationId = null,
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : "";
  if (!normalizedTenantId) return [];

  const normalizedStartDate = normalizeStartDate(startDate);
  if (!normalizedStartDate) return [];

  const existingRows = await listTenantPaymentRows(normalizedTenantId);
  const existingKeys = new Set(
    (existingRows || []).map((row) => `${Number(row.month)}-${Number(row.year)}`)
  );

  const tenant = await readTenantBillingRow(normalizedTenantId);
  const paymentsToInsert = [];

  for (const period of buildHistoricalPeriodsToCurrentMonth({
    startDate: normalizedStartDate,
    referenceDate,
    timeZone,
  })) {
    const periodKey = `${period.month}-${period.year}`;
    if (existingKeys.has(periodKey)) continue;
    const payment = await buildMissingPaymentForTenant({
      tenantId: normalizedTenantId,
      month: period.month,
      year: period.year,
      tenantRow: tenant,
    });
    if (payment) paymentsToInsert.push(payment);
  }

  if (!paymentsToInsert.length) return [];

  const resolvedOrganizationId = await resolveTenantPaymentOrganizationId({
    tenantId: normalizedTenantId,
    organizationId,
  });

  for (const payment of paymentsToInsert) {
    await insertGeneratedPayment({
      payment,
      amount: payment.amount,
      expectedAmount: payment.expectedAmount,
      paymentDate: payment.dueDate,
      status: "pago",
      organizationId: resolvedOrganizationId,
    });
  }

  return paymentsToInsert;
}

export async function ensureRecurringPaymentsForTenant({
  tenantId,
  startDate = null,
  organizationId = null,
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : "";
  if (!normalizedTenantId) {
    return {
      tenantId: null,
      createdPayments: [],
      historicalPayments: [],
      skipped: true,
      reason: "missing-tenant-id",
    };
  }

  const tenant = await readTenantBillingRow(normalizedTenantId);
  if (!tenant) {
    return {
      tenantId: normalizedTenantId,
      createdPayments: [],
      historicalPayments: [],
      skipped: true,
      reason: "tenant-not-found",
    };
  }

  const normalizedStartDate = normalizeStartDate(startDate || tenant.start_date);
  if (!normalizedStartDate) {
    return {
      tenantId: normalizedTenantId,
      createdPayments: [],
      historicalPayments: [],
      skipped: true,
      reason: "missing-start-date",
    };
  }

  if (String(tenant.status || "").toLowerCase() !== "ativo") {
    return {
      tenantId: normalizedTenantId,
      createdPayments: [],
      historicalPayments: [],
      skipped: true,
      reason: "inactive-tenant",
    };
  }

  let paymentRows = await listTenantPaymentRows(normalizedTenantId);
  let historicalPayments = [];

  if (paymentRows.length === 0) {
    historicalPayments = await ensurePaidPaymentsUntilCurrentMonth({
      tenantId: normalizedTenantId,
      startDate: normalizedStartDate,
      organizationId,
      referenceDate,
      timeZone,
    });
    paymentRows = await listTenantPaymentRows(normalizedTenantId);
  }

  const automationWindow = buildRecurringPeriodsToEnsure({
    startDate: normalizedStartDate,
    paymentDay: tenant.payment_day,
    existingPeriods: paymentRows,
    referenceDate,
    timeZone,
  });

  if (!automationWindow.periods.length) {
    return {
      tenantId: normalizedTenantId,
      createdPayments: [],
      historicalPayments,
      skipped: false,
      targetPeriod: automationWindow.targetPeriod,
      todayIsoDate: automationWindow.todayIsoDate,
    };
  }

  const resolvedOrganizationId = await resolveTenantPaymentOrganizationId({
    tenantId: normalizedTenantId,
    organizationId,
  });

  const billingCache = {
    condominiumByPeriod: new Map(),
    chargeableAdditionsByPeriod: new Map(),
  };
  const createdPayments = [];

  for (const period of automationWindow.periods) {
    const draftPayment = await buildMissingPaymentForTenant({
      tenantId: normalizedTenantId,
      month: period.month,
      year: period.year,
      tenantRow: tenant,
      cache: billingCache,
    });
    if (!draftPayment) continue;

    const createdPayment = await insertGeneratedPayment({
      payment: draftPayment,
      amount: 0,
      expectedAmount: draftPayment.expectedAmount,
      paymentDate: null,
      status: resolveCalculatedPaymentStatus({
        paymentDate: null,
        dueDate: draftPayment.dueDate,
        amount: 0,
        expectedAmount: draftPayment.expectedAmount,
        todayIsoDate: automationWindow.todayIsoDate,
      }),
      organizationId: resolvedOrganizationId,
    });

    if (createdPayment) {
      createdPayments.push(createdPayment);
    }
  }

  return {
    tenantId: normalizedTenantId,
    createdPayments,
    historicalPayments,
    skipped: false,
    targetPeriod: automationWindow.targetPeriod,
    todayIsoDate: automationWindow.todayIsoDate,
  };
}

export async function syncRecurringPaymentsForFinancialTenants({
  tenantId = null,
  organizationId = null,
  referenceDate = new Date(),
  timeZone = getBillingTimeZone(),
} = {}) {
  const normalizedTenantId = tenantId != null ? String(tenantId).trim() : null;
  const tenants = await listFinancialTenants(normalizedTenantId ? {} : { status: "ativo" });
  const targetTenants = normalizedTenantId
    ? tenants.filter((tenant) => String(tenant.id) === normalizedTenantId)
    : tenants.filter((tenant) => tenant.status === "ativo");

  const results = [];
  let createdPayments = 0;
  let createdHistoricalPayments = 0;
  let skippedTenants = 0;

  for (const tenant of targetTenants) {
    const result = await ensureRecurringPaymentsForTenant({
      tenantId: tenant.id,
      startDate: tenant.startDate,
      organizationId,
      referenceDate,
      timeZone,
    });
    results.push(result);
    createdPayments += result.createdPayments.length;
    createdHistoricalPayments += result.historicalPayments.length;
    if (result.skipped) skippedTenants += 1;
  }

  return {
    tenantsProcessed: targetTenants.length,
    createdPayments,
    createdHistoricalPayments,
    skippedTenants,
    results,
  };
}
