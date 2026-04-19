import { getSupabaseClient } from "@/database/supabaseClient";

/** Cache: tenants table has organization_id (multi-tenant Supabase schema). */
let tenantsOrgColumn = { checked: false, hasOrganizationId: false };

/**
 * Detects if `tenants` has a non-null organization_id column (schema evolution).
 */
export async function detectTenantsHasOrganizationId() {
  if (tenantsOrgColumn.checked) return tenantsOrgColumn;

  const supabase = getSupabaseClient();
  const probe = await supabase.from("tenants").select("organization_id").limit(1);

  tenantsOrgColumn = {
    checked: true,
    hasOrganizationId: !probe.error,
  };
  return tenantsOrgColumn;
}

/**
 * Resolves organization_id for a tenant row:
 * 1) explicit body.organizationId
 * 2) from linked property (properties.organization_id)
 */
export async function resolveOrganizationIdForTenant(pool, { propertyId, organizationId }) {
  if (organizationId != null && String(organizationId).trim() !== "") {
    return String(organizationId).trim();
  }

  if (propertyId != null && String(propertyId).trim() !== "") {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("properties")
        .select("organization_id")
        .eq("id", String(propertyId).trim())
        .maybeSingle();
      const oid = (!error && data?.organization_id) ? data.organization_id : null;
      if (oid) return oid;
    } catch (_) {
      /* ignore */
    }
  }

  return null;
}

/** Cache: payments table has organization_id (multi-tenant Supabase schema). */
let paymentsOrgColumn = { checked: false, hasOrganizationId: false };

export async function detectPaymentsHasOrganizationId() {
  if (paymentsOrgColumn.checked) return paymentsOrgColumn;

  const supabase = getSupabaseClient();
  const probe = await supabase.from("payments").select("organization_id").limit(1);

  paymentsOrgColumn = {
    checked: true,
    hasOrganizationId: !probe.error,
  };
  return paymentsOrgColumn;
}

/**
 * Resolves organization_id for a payment row (always tied to a tenant):
 * 1) explicit body.organizationId
 * 2) tenants.organization_id
 * 3) same chain as tenant (property → first org)
 */
export async function resolveOrganizationIdForPayment(pool, { tenantId, organizationId }) {
  if (organizationId != null && String(organizationId).trim() !== "") {
    return String(organizationId).trim();
  }
  if (!tenantId) return null;

  try {
    const [rows] = await pool.query(
      "SELECT organization_id, property_id FROM tenants WHERE id = ? LIMIT 1",
      [String(tenantId).trim()]
    );
    const t = rows?.[0];
    if (t?.organization_id) return t.organization_id;
    return resolveOrganizationIdForTenant(pool, {
      propertyId: t?.property_id ?? null,
      organizationId: null,
    });
  } catch {
    return null;
  }
}

/** Cache: obras table has organization_id (multi-tenant Supabase schema). */
let obrasOrgColumn = { checked: false, hasOrganizationId: false };

export async function detectObrasHasOrganizationId() {
  if (obrasOrgColumn.checked) return obrasOrgColumn;

  const supabase = getSupabaseClient();
  const probe = await supabase.from("obras").select("organization_id").limit(1);

  obrasOrgColumn = {
    checked: true,
    hasOrganizationId: !probe.error,
  };
  return obrasOrgColumn;
}

/**
 * Resolves organization_id for an obra row:
 * 1) explicit body.organizationId
 * 2) from linked property (properties.organization_id)
 */
export async function resolveOrganizationIdForObra(pool, { propertyId, organizationId }) {
  return resolveOrganizationIdForTenant(pool, { propertyId, organizationId });
}
