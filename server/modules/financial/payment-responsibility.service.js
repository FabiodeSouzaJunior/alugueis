import paymentResponsibilityCore from "./payment-responsibility.core.cjs";
import { getSupabaseClient } from "@/database/supabaseClient";
import { rowToPayment, rowToTenant } from "@/lib/db";
import { buildValidationError } from "@/server/modules/tenants/dto/tenant.dto";
import { syncOpenPaymentExpectedAmount } from "@/server/modules/financial/tenant-billing.service";
import {
  getPeriodRelationToCurrent,
  getBillingTimeZone,
} from "@/server/modules/financial/payment-automation.core";

const {
  buildFinancialResponsibilityIndex,
  filterFinancialPayments,
  filterFinancialTenants,
  hasFinancialResponsibility,
  normalizeTenantId,
} = paymentResponsibilityCore;

const FINANCIAL_RESPONSIBILITY_CACHE_MS = 10 * 1000;

let financialResponsibilityIndexCache = null;
let financialResponsibilityIndexCheckedAt = 0;

function hasFreshFinancialResponsibilityCache() {
  return (
    financialResponsibilityIndexCache &&
    financialResponsibilityIndexCheckedAt > 0 &&
    Date.now() - financialResponsibilityIndexCheckedAt < FINANCIAL_RESPONSIBILITY_CACHE_MS
  );
}

async function readFinancialResponsibilityRows() {
  const supabase = getSupabaseClient();
  const [tenantResult, unitResult, propertyResult] = await Promise.all([
    supabase.from("tenants").select("id,is_payment_responsible,email,property_id"),
    supabase.from("property_units").select("tenant_id"),
    supabase.from("properties").select("id,payment_responsible"),
  ]);

  if (tenantResult.error) throw tenantResult.error;
  if (unitResult.error) throw unitResult.error;

  return {
    tenants: tenantResult.data || [],
    units: unitResult.data || [],
    properties: propertyResult.error ? [] : propertyResult.data || [],
  };
}

export function invalidateFinancialResponsibilityCache() {
  financialResponsibilityIndexCache = null;
  financialResponsibilityIndexCheckedAt = 0;
}

export async function getFinancialResponsibilityIndex() {
  if (hasFreshFinancialResponsibilityCache()) {
    return financialResponsibilityIndexCache;
  }

  financialResponsibilityIndexCache = buildFinancialResponsibilityIndex(
    await readFinancialResponsibilityRows()
  );
  financialResponsibilityIndexCheckedAt = Date.now();

  return financialResponsibilityIndexCache;
}

export async function listFinancialTenants(filters = {}) {
  const supabase = getSupabaseClient();
  let query = supabase.from("tenants").select("*").order("name", { ascending: true });

  if (filters?.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  const index = await getFinancialResponsibilityIndex();
  return filterFinancialTenants((data || []).map(rowToTenant), index);
}

export async function filterFinancialTenantIds(candidateTenantIds = []) {
  const normalizedCandidateTenantIds = Array.from(
    new Set((candidateTenantIds || []).map(normalizeTenantId).filter(Boolean))
  );

  if (normalizedCandidateTenantIds.length === 0) return [];

  const index = await getFinancialResponsibilityIndex();
  return normalizedCandidateTenantIds.filter((tenantId) =>
    hasFinancialResponsibility(index, tenantId)
  );
}

export async function getFinancialTenantById(tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", normalizedTenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const index = await getFinancialResponsibilityIndex();
  if (!hasFinancialResponsibility(index, normalizedTenantId)) return null;

  return rowToTenant(data);
}

export async function assertFinancialTenantById(
  tenantId,
  {
    status = 400,
    message = "Somente o responsavel pelo pagamento pode possuir cobrancas, pagamentos e historico financeiro.",
  } = {}
) {
  const tenant = await getFinancialTenantById(tenantId);
  if (!tenant) {
    throw buildValidationError(message, status);
  }
  return tenant;
}

export async function listFinancialPayments(filters = {}) {
  const supabase = getSupabaseClient();
  const index = await getFinancialResponsibilityIndex();

  let targetTenantIds = index.responsibleTenantIds;
  const normalizedTenantId = normalizeTenantId(filters?.tenantId);
  if (normalizedTenantId) {
    if (!hasFinancialResponsibility(index, normalizedTenantId)) {
      return [];
    }
    targetTenantIds = [normalizedTenantId];
  }

  if (!targetTenantIds.length) return [];

  let query = supabase.from("payments").select("*").in("tenant_id", targetTenantIds);

  if (filters?.month != null && filters.month !== "") {
    query = query.eq("month", Number(filters.month));
  }

  if (filters?.year != null && filters.year !== "") {
    query = query.eq("year", Number(filters.year));
  }

  const { data, error } = await query
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("due_date", { ascending: false });

  if (error) throw error;

  let payments = filterFinancialPayments((data || []).map(rowToPayment), index, {
    tenantId: normalizedTenantId,
  });

  if (payments.length > 0) {
    const paymentTenantIds = Array.from(
      new Set(payments.map((payment) => normalizeTenantId(payment.tenantId)).filter(Boolean))
    );
    let tenantById = {};

    if (paymentTenantIds.length > 0) {
      const { data: tenantRows, error: tenantError } = await supabase
        .from("tenants")
        .select("id,rent_value,property_id")
        .in("id", paymentTenantIds);

      if (tenantError) throw tenantError;

      tenantById = Object.fromEntries(
        (tenantRows || []).map((tenantRow) => [normalizeTenantId(tenantRow.id), tenantRow])
      );
    }

    const billingCache = {
      condominiumByPeriod: new Map(),
      chargeableAdditionsByPeriod: new Map(),
    };

    payments = await Promise.all(
      payments.map(async (payment) => {
        const tenantId = normalizeTenantId(payment.tenantId);
        const periodRelation = getPeriodRelationToCurrent({
          month: payment.month,
          year: payment.year,
          referenceDate: new Date(),
          timeZone: getBillingTimeZone(),
        });

        if (periodRelation !== "past") {
          const synced = await syncOpenPaymentExpectedAmount(payment, {
            tenantRow: tenantById[tenantId] || null,
            cache: billingCache,
          });
          return synced.payment;
        }
        // Períodos passados retornam como estão (sem sincronização)
        return payment;
      })
    );
  }

  if (filters?.openOnly) {
    payments = payments.filter((payment) => {
      const expectedAmount = Number(payment.expectedAmount ?? payment.amount) || 0;
      const paidAmount = Number(payment.amount) || 0;
      return paidAmount < expectedAmount;
    });
  }

  return payments;
}

export async function getFinancialPaymentById(paymentId) {
  const normalizedPaymentId = normalizeTenantId(paymentId);
  if (!normalizedPaymentId) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", normalizedPaymentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const index = await getFinancialResponsibilityIndex();
  if (!hasFinancialResponsibility(index, data.tenant_id)) return null;

  return rowToPayment(data);
}
