import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BILLING_TIME_ZONE = Deno.env.get("BILLING_TIME_ZONE") || "America/Sao_Paulo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function normalizeTenantId(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeEmail(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

function appendMapEntry(map: Map<string, string[]>, key: string | null, value: string | null) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key)?.push(value);
}

function addTenantIdsToSet(targetSet: Set<string>, tenantIds: string[] = []) {
  for (const tenantId of tenantIds) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (normalizedTenantId) targetSet.add(normalizedTenantId);
  }
}

function buildFinancialResponsibilityIndex({
  tenants = [],
  units = [],
  properties = [],
}: {
  tenants?: Array<Record<string, unknown>>;
  units?: Array<Record<string, unknown>>;
  properties?: Array<Record<string, unknown>>;
}) {
  const responsibleTenantIdSet = new Set<string>();
  const tenantIdsByEmail = new Map<string, string[]>();
  const tenantIdsByPropertyEmail = new Map<string, string[]>();

  for (const tenant of tenants) {
    const tenantId = normalizeTenantId(tenant.id ?? tenant.tenant_id);
    if (!tenantId) continue;

    const normalizedEmail = normalizeEmail(tenant.email);
    const propertyId = normalizeTenantId(tenant.property_id);
    appendMapEntry(tenantIdsByEmail, normalizedEmail, tenantId);
    appendMapEntry(
      tenantIdsByPropertyEmail,
      normalizedEmail && propertyId ? `${propertyId}::${normalizedEmail}` : null,
      tenantId
    );

    if (normalizeBoolean(tenant.is_payment_responsible)) {
      responsibleTenantIdSet.add(tenantId);
    }
  }

  for (const unit of units) {
    const tenantId = normalizeTenantId(unit.tenant_id);
    if (tenantId) responsibleTenantIdSet.add(tenantId);
  }

  for (const property of properties) {
    const propertyId = normalizeTenantId(property.id ?? property.property_id);
    const normalizedEmail = normalizeEmail(property.payment_responsible);
    if (!normalizedEmail) continue;

    const propertyScopedMatches =
      propertyId ? tenantIdsByPropertyEmail.get(`${propertyId}::${normalizedEmail}`) : null;
    if (propertyScopedMatches?.length) {
      addTenantIdsToSet(responsibleTenantIdSet, propertyScopedMatches);
      continue;
    }

    const globalMatches = tenantIdsByEmail.get(normalizedEmail) || [];
    if (globalMatches.length === 1) {
      addTenantIdsToSet(responsibleTenantIdSet, globalMatches);
    }
  }

  return responsibleTenantIdSet;
}

function normalizePaymentDay(value: unknown, fallback = 10) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 31) {
    return parsed;
  }
  return fallback;
}

function getDueDateForPeriod(month: number, year: number, paymentDay = 10) {
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const resolvedPaymentDay = Math.min(normalizePaymentDay(paymentDay), lastDayOfMonth);

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    resolvedPaymentDay
  ).padStart(2, "0")}`;
}

function getPeriodKey(month: number, year: number) {
  return year * 12 + (month - 1);
}

function periodFromKey(periodKey: number) {
  return {
    year: Math.floor(periodKey / 12),
    month: (periodKey % 12) + 1,
  };
}

function parseDateOnly(value: unknown) {
  const normalized = String(value ?? "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    isoDate: `${match[1]}-${match[2]}-${match[3]}`,
  };
}

function getBusinessDateParts(referenceDate = new Date(), timeZone = BILLING_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(referenceDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    year,
    month,
    day,
    isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`,
  };
}

function getNextPeriod(month: number, year: number) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

function resolveRecurringAutomationWindow(paymentDay: unknown, referenceDate = new Date()) {
  const today = getBusinessDateParts(referenceDate);
  const currentDueDate = getDueDateForPeriod(today.month, today.year, normalizePaymentDay(paymentDay));
  const shouldHaveNextMonth = today.isoDate >= currentDueDate;
  const currentPeriod = { month: today.month, year: today.year };

  return {
    todayIsoDate: today.isoDate,
    currentPeriod,
    targetPeriod: shouldHaveNextMonth
      ? getNextPeriod(today.month, today.year)
      : currentPeriod,
  };
}

function buildPeriodsFromStartDate(startDate: unknown, endPeriod: { month: number; year: number }) {
  const parsedStartDate = parseDateOnly(startDate);
  if (!parsedStartDate) return [];

  const periods = [];
  const startKey = getPeriodKey(parsedStartDate.month, parsedStartDate.year);
  const endKey = getPeriodKey(endPeriod.month, endPeriod.year);

  for (let periodKey = startKey; periodKey <= endKey; periodKey += 1) {
    periods.push(periodFromKey(periodKey));
  }

  return periods;
}

function buildRecurringPeriodsToEnsure({
  startDate,
  paymentDay,
  existingPeriods = [],
  referenceDate = new Date(),
}: {
  startDate: unknown;
  paymentDay: unknown;
  existingPeriods?: Array<{ month: number; year: number }>;
  referenceDate?: Date;
}) {
  const automationWindow = resolveRecurringAutomationWindow(paymentDay, referenceDate);
  const parsedStartDate = parseDateOnly(startDate);
  if (!parsedStartDate) {
    return {
      ...automationWindow,
      periods: [],
    };
  }

  const startKey = getPeriodKey(parsedStartDate.month, parsedStartDate.year);
  const currentKey = getPeriodKey(
    automationWindow.currentPeriod.month,
    automationWindow.currentPeriod.year
  );
  const targetKey = getPeriodKey(
    automationWindow.targetPeriod.month,
    automationWindow.targetPeriod.year
  );
  if (startKey > targetKey) {
    return {
      ...automationWindow,
      periods: [],
    };
  }

  const existingKeys = new Set(existingPeriods.map((period) => getPeriodKey(period.month, period.year)));
  const sortedExistingKeys = Array.from(existingKeys).sort((a, b) => a - b);
  const latestExistingKey = sortedExistingKeys.length
    ? sortedExistingKeys[sortedExistingKeys.length - 1]
    : null;
  const missingKeys = new Set<number>();

  if (latestExistingKey != null) {
    const recoveryStartKey = Math.max(startKey, latestExistingKey + 1);
    for (let periodKey = recoveryStartKey; periodKey <= targetKey; periodKey += 1) {
      if (!existingKeys.has(periodKey)) missingKeys.add(periodKey);
    }
  }

  const criticalStartKey = Math.max(startKey, currentKey);
  for (let periodKey = criticalStartKey; periodKey <= targetKey; periodKey += 1) {
    if (!existingKeys.has(periodKey)) missingKeys.add(periodKey);
  }

  return {
    ...automationWindow,
    periods: Array.from(missingKeys)
      .sort((a, b) => a - b)
      .map((periodKey) => periodFromKey(periodKey)),
  };
}

function resolveCalculatedPaymentStatus({
  paymentDate = null,
  dueDate,
  amount,
  expectedAmount,
  todayIsoDate,
}: {
  paymentDate?: string | null;
  dueDate: string;
  amount: number;
  expectedAmount: number;
  todayIsoDate: string;
}) {
  if (amount > 0 && expectedAmount > 0 && amount >= expectedAmount) return "pago";
  if (amount > 0) return "pendente";
  if (paymentDate) return "pago";
  if (dueDate < todayIsoDate) return "atrasado";
  return "pendente";
}

function getBaseValueForMonth(
  baseValues: Array<{ startDate: string; value: number }>,
  month: number,
  year: number
) {
  const targetKey = getPeriodKey(month, year);
  const validValues = baseValues.filter((baseValue) => {
    const parsedStartDate = parseDateOnly(baseValue.startDate);
    if (!parsedStartDate) return false;
    return getPeriodKey(parsedStartDate.month, parsedStartDate.year) <= targetKey;
  });

  validValues.sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  return validValues.length ? normalizeNumber(validValues[0].value) : 0;
}

function calculateTenantAmountDue({
  rentValue,
  condominiumValue = 0,
  extraCharges = 0,
}: {
  rentValue: unknown;
  condominiumValue?: unknown;
  extraCharges?: unknown;
}) {
  return normalizeNumber(rentValue) + normalizeNumber(condominiumValue) + normalizeNumber(extraCharges);
}

function decodeJwtRole(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalizedPayload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(paddedPayload));
    return payload?.role ? String(payload.role) : null;
  } catch {
    return null;
  }
}

function isUniquePaymentError(error: { code?: string; message?: string } | null) {
  const message = String(error?.message || "");
  return error?.code === "23505" || /unique_payment|duplicate key/i.test(message);
}

async function createAutomationRun(body: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("payment_automation_runs")
    .insert({
      source: String(body.source || "edge_function"),
      trigger_type: String(body.triggerType || "manual"),
      status: "running",
      tenant_id: body.tenantId ? String(body.tenantId) : null,
      details: body,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function finishAutomationRun(
  runId: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase
    .from("payment_automation_runs")
    .update({
      ...payload,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) throw error;
}

async function fetchAutomationContext(targetTenantId: string | null) {
  const [tenantsResult, unitsResult, propertiesResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("id,name,start_date,payment_day,status,rent_value,property_id,organization_id,email,is_payment_responsible")
      .order("name", { ascending: true }),
    supabase.from("property_units").select("tenant_id"),
    supabase.from("properties").select("id,payment_responsible,organization_id"),
  ]);

  if (tenantsResult.error) throw tenantsResult.error;
  if (unitsResult.error) throw unitsResult.error;
  if (propertiesResult.error) throw propertiesResult.error;

  const responsibilityIndex = buildFinancialResponsibilityIndex({
    tenants: tenantsResult.data || [],
    units: unitsResult.data || [],
    properties: propertiesResult.data || [],
  });
  const propertyById = new Map(
    (propertiesResult.data || []).map((property) => [String(property.id), property])
  );

  let tenants = (tenantsResult.data || []).filter((tenant) => {
    const tenantId = normalizeTenantId(tenant.id);
    return tenantId ? responsibilityIndex.has(tenantId) : false;
  });

  if (targetTenantId) {
    tenants = tenants.filter((tenant) => String(tenant.id) === targetTenantId);
  }

  const tenantIds = tenants.map((tenant) => String(tenant.id));
  const [paymentsResult, baseValuesResult, consumptionResult] = await Promise.all([
    tenantIds.length
      ? supabase
          .from("payments")
          .select("id,tenant_id,month,year,due_date,payment_date,amount,expected_amount,status")
          .in("tenant_id", tenantIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("condominium_base_values")
      .select("property_id,value,start_date"),
    tenantIds.length
      ? supabase
          .from("water_energy_consumption")
          .select("tenant_id,month,year,water_usage,electricity_usage,add_to_rent")
          .in("tenant_id", tenantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (paymentsResult.error) throw paymentsResult.error;
  if (baseValuesResult.error) throw baseValuesResult.error;
  if (consumptionResult.error) throw consumptionResult.error;

  const paymentsByTenantId = new Map<string, Array<Record<string, unknown>>>();
  for (const payment of paymentsResult.data || []) {
    const tenantId = String(payment.tenant_id);
    if (!paymentsByTenantId.has(tenantId)) paymentsByTenantId.set(tenantId, []);
    paymentsByTenantId.get(tenantId)?.push(payment);
  }

  const consumptionByPeriodKey = new Map<string, Record<string, unknown>>();
  for (const row of consumptionResult.data || []) {
    consumptionByPeriodKey.set(
      `${row.tenant_id}:${row.year}-${row.month}`,
      row
    );
  }

  return {
    tenants,
    propertyById,
    paymentsByTenantId,
    baseValues: baseValuesResult.data || [],
    consumptionByPeriodKey,
  };
}

function getExpectedAmountForPeriod({
  tenant,
  month,
  year,
  baseValues,
  consumptionByPeriodKey,
}: {
  tenant: Record<string, unknown>;
  month: number;
  year: number;
  baseValues: Array<Record<string, unknown>>;
  consumptionByPeriodKey: Map<string, Record<string, unknown>>;
}) {
  const propertyId = tenant.property_id ? String(tenant.property_id) : null;
  const scopedBaseValues = (baseValues || [])
    .filter((row) => {
      if (!propertyId) return true;
      return String(row.property_id || "") === propertyId;
    })
    .map((row) => ({
      value: normalizeNumber(row.value),
      startDate: String(row.start_date || ""),
    }));

  const condominiumValue = getBaseValueForMonth(scopedBaseValues, month, year);
  const consumption = consumptionByPeriodKey.get(`${tenant.id}:${year}-${month}`);
  const extraCharges = normalizeBoolean(consumption?.add_to_rent)
    ? normalizeNumber(consumption?.water_usage) + normalizeNumber(consumption?.electricity_usage)
    : 0;

  return calculateTenantAmountDue({
    rentValue: tenant.rent_value,
    condominiumValue,
    extraCharges,
  });
}

async function insertPaymentRow(row: Record<string, unknown>) {
  const { error } = await supabase.from("payments").insert(row);
  if (error) {
    if (isUniquePaymentError(error)) return false;
    throw error;
  }
  return true;
}

async function ensureTenantPayments({
  tenant,
  propertyById,
  paymentsByTenantId,
  baseValues,
  consumptionByPeriodKey,
  referenceDate,
}: {
  tenant: Record<string, unknown>;
  propertyById: Map<string, Record<string, unknown>>;
  paymentsByTenantId: Map<string, Array<Record<string, unknown>>>;
  baseValues: Array<Record<string, unknown>>;
  consumptionByPeriodKey: Map<string, Record<string, unknown>>;
  referenceDate: Date;
}) {
  const tenantId = String(tenant.id);
  const paymentDay = normalizePaymentDay(tenant.payment_day);
  const existingPayments = paymentsByTenantId.get(tenantId) || [];
  const existingKeys = new Set(
    existingPayments.map((payment) => getPeriodKey(Number(payment.month), Number(payment.year)))
  );
  const createdHistoricalPayments: Array<Record<string, unknown>> = [];
  const createdPayments: Array<Record<string, unknown>> = [];
  const organizationId =
    (tenant.organization_id ? String(tenant.organization_id) : null) ||
    (tenant.property_id
      ? String(propertyById.get(String(tenant.property_id))?.organization_id || "")
      : null) ||
    null;

  if (!existingPayments.length) {
    for (const period of buildPeriodsFromStartDate(
      tenant.start_date,
      resolveRecurringAutomationWindow(paymentDay, referenceDate).currentPeriod
    )) {
      const periodKey = getPeriodKey(period.month, period.year);
      if (existingKeys.has(periodKey)) continue;

      const expectedAmount = getExpectedAmountForPeriod({
        tenant,
        month: period.month,
        year: period.year,
        baseValues,
        consumptionByPeriodKey,
      });
      const dueDate = getDueDateForPeriod(period.month, period.year, paymentDay);
      const row = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        month: period.month,
        year: period.year,
        due_date: dueDate,
        payment_date: dueDate,
        amount: expectedAmount,
        expected_amount: expectedAmount,
        status: "pago",
        organization_id: organizationId,
      };

      if (await insertPaymentRow(row)) {
        existingKeys.add(periodKey);
        createdHistoricalPayments.push(row);
      }
    }
  }

  const recurringWindow = buildRecurringPeriodsToEnsure({
    startDate: tenant.start_date,
    paymentDay,
    existingPeriods: Array.from(existingKeys).map((periodKey) => periodFromKey(periodKey)),
    referenceDate,
  });

  for (const period of recurringWindow.periods) {
    const periodKey = getPeriodKey(period.month, period.year);
    if (existingKeys.has(periodKey)) continue;

    const expectedAmount = getExpectedAmountForPeriod({
      tenant,
      month: period.month,
      year: period.year,
      baseValues,
      consumptionByPeriodKey,
    });
    const dueDate = getDueDateForPeriod(period.month, period.year, paymentDay);
    const row = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      month: period.month,
      year: period.year,
      due_date: dueDate,
      payment_date: null,
      amount: 0,
      expected_amount: expectedAmount,
      status: resolveCalculatedPaymentStatus({
        paymentDate: null,
        dueDate,
        amount: 0,
        expectedAmount,
        todayIsoDate: recurringWindow.todayIsoDate,
      }),
      organization_id: organizationId,
    };

    if (await insertPaymentRow(row)) {
      existingKeys.add(periodKey);
      createdPayments.push(row);
    }
  }

  return {
    tenantId,
    createdPayments: createdPayments.length,
    createdHistoricalPayments: createdHistoricalPayments.length,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Supabase Edge Function secrets are not configured." }, 500);
  }

  const jwtRole = decodeJwtRole(request);
  if (jwtRole !== "service_role") {
    return json({ error: "Forbidden" }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tenantId = body?.tenantId ? String(body.tenantId).trim() : null;
  const runId = await createAutomationRun(body);

  try {
    const referenceDate = new Date();
    const context = await fetchAutomationContext(tenantId);
    const eligibleTenants = context.tenants.filter((tenant) => {
      return (
        String(tenant.status || "").toLowerCase() === "ativo" &&
        Boolean(tenant.start_date)
      );
    });

    let createdPayments = 0;
    let createdHistoricalPayments = 0;
    let skippedTenants = 0;
    const perTenant = [];

    for (const tenant of eligibleTenants) {
      const result = await ensureTenantPayments({
        tenant,
        propertyById: context.propertyById,
        paymentsByTenantId: context.paymentsByTenantId,
        baseValues: context.baseValues,
        consumptionByPeriodKey: context.consumptionByPeriodKey,
        referenceDate,
      });
      createdPayments += result.createdPayments;
      createdHistoricalPayments += result.createdHistoricalPayments;
      perTenant.push(result);
    }

    skippedTenants = context.tenants.length - eligibleTenants.length;

    const responseBody = {
      ok: true,
      runId,
      tenantsProcessed: eligibleTenants.length,
      createdPayments,
      createdHistoricalPayments,
      skippedTenants,
      timeZone: BILLING_TIME_ZONE,
      results: perTenant,
    };

    await finishAutomationRun(runId, {
      status: "succeeded",
      processed_tenants: eligibleTenants.length,
      created_payments: createdPayments,
      created_historical_payments: createdHistoricalPayments,
      skipped_tenants: skippedTenants,
      details: responseBody,
    });

    return json(responseBody, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("payments-recurring-automation failed", error);

    await finishAutomationRun(runId, {
      status: "failed",
      error_message: errorMessage,
      details: {
        source: body?.source || "edge_function",
        tenantId,
      },
    }).catch((finishError) => {
      console.error("failed to persist automation failure", finishError);
    });

    return json(
      {
        ok: false,
        runId,
        error: errorMessage,
      },
      500
    );
  }
});
