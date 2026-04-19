import { getSupabaseClient } from "@/database/supabaseClient";
import { pool, rowToTenant } from "@/lib/db";

let tenantColumnSupport = null;
let tenantColumnSupportCheckedAt = 0;
let propertyColumnSupport = null;
let propertyColumnSupportCheckedAt = 0;
let propertyUnitColumnSupport = null;
let propertyUnitColumnSupportCheckedAt = 0;
let residentsTableSupport = null;
let residentsTableSupportCheckedAt = 0;

const SCHEMA_SUPPORT_CACHE_MS = 30 * 1000;

function isFreshSchemaCache(checkedAt) {
  return checkedAt > 0 && Date.now() - checkedAt < SCHEMA_SUPPORT_CACHE_MS;
}

function hasCompleteTenantSupport(support) {
  return !!(
    support?.hasDocumentNumber &&
    support?.hasAddress &&
    support?.hasBirthDate &&
    support?.hasEmail &&
    support?.hasIsPaymentResponsible &&
    support?.hasPaymentDay
  );
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return value === "true" || value === "1";
}

export async function getTenantColumnSupport() {
  if (tenantColumnSupport && (hasCompleteTenantSupport(tenantColumnSupport) || isFreshSchemaCache(tenantColumnSupportCheckedAt))) {
    return tenantColumnSupport;
  }

  const supabase = getSupabaseClient();
  const [
    documentProbe,
    addressProbe,
    birthDateProbe,
    emailProbe,
    paymentResponsibleProbe,
    paymentDayProbe,
    organizationProbe,
    iptuValueProbe,
  ] = await Promise.all([
    supabase.from("tenants").select("document_number").limit(1),
    supabase.from("tenants").select("address").limit(1),
    supabase.from("tenants").select("birth_date").limit(1),
    supabase.from("tenants").select("email").limit(1),
    supabase.from("tenants").select("is_payment_responsible").limit(1),
    supabase.from("tenants").select("payment_day").limit(1),
    supabase.from("tenants").select("organization_id").limit(1),
    supabase.from("tenants").select("iptu_value").limit(1),
  ]);

  tenantColumnSupport = {
    hasDocumentNumber: !documentProbe.error,
    hasAddress: !addressProbe.error,
    hasBirthDate: !birthDateProbe.error,
    hasEmail: !emailProbe.error,
    hasIsPaymentResponsible: !paymentResponsibleProbe.error,
    hasPaymentDay: !paymentDayProbe.error,
    hasOrganizationId: !organizationProbe.error,
    hasIptu: !iptuValueProbe.error,
  };
  tenantColumnSupportCheckedAt = Date.now();

  return tenantColumnSupport;
}

export async function getPropertyColumnSupport() {
  if (propertyColumnSupport && isFreshSchemaCache(propertyColumnSupportCheckedAt)) {
    return propertyColumnSupport;
  }

  const supabase = getSupabaseClient();
  const paymentResponsibleProbe = await supabase
    .from("properties")
    .select("payment_responsible")
    .limit(1);

  propertyColumnSupport = {
    hasPaymentResponsible: !paymentResponsibleProbe.error,
  };
  propertyColumnSupportCheckedAt = Date.now();

  return propertyColumnSupport;
}

export async function getPropertyUnitColumnSupport() {
  if (propertyUnitColumnSupport && isFreshSchemaCache(propertyUnitColumnSupportCheckedAt)) {
    return propertyUnitColumnSupport;
  }

  const supabase = getSupabaseClient();
  const [tenantProbe, residentProbe] = await Promise.all([
    supabase.from("property_units").select("tenant_id").limit(1),
    supabase.from("property_units").select("resident_tenant_id").limit(1),
  ]);

  propertyUnitColumnSupport = {
    hasTenantId: !tenantProbe.error,
    hasResidentTenantId: !residentProbe.error,
  };
  propertyUnitColumnSupportCheckedAt = Date.now();

  return propertyUnitColumnSupport;
}

export async function hasPropertyUnitResidentsTable() {
  if (residentsTableSupport != null && isFreshSchemaCache(residentsTableSupportCheckedAt)) {
    return residentsTableSupport;
  }

  const supabase = getSupabaseClient();
  const probe = await supabase.from("property_unit_residents").select("unit_id").limit(1);
  residentsTableSupport = !probe.error;
  residentsTableSupportCheckedAt = Date.now();
  return residentsTableSupport;
}

async function enrichTenantsWithUnitId(tenants) {
  if (!tenants.length) return tenants;

  try {
    const supabase = getSupabaseClient();
    const tenantIds = tenants.map((t) => t.id).filter(Boolean);
    if (!tenantIds.length) return tenants;

    const support = await getPropertyUnitColumnSupport();

    // Look up payer links (tenant_id on property_units)
    let payerLinks = [];
    if (support.hasTenantId) {
      const { data, error } = await supabase
        .from("property_units")
        .select("id, property_id, tenant_id")
        .in("tenant_id", tenantIds);
      if (!error && data) payerLinks = data;
    }

    // Look up resident links on property_units.resident_tenant_id
    let residentUnitLinks = [];
    if (support.hasResidentTenantId) {
      const { data, error } = await supabase
        .from("property_units")
        .select("id, property_id, resident_tenant_id")
        .in("resident_tenant_id", tenantIds);
      if (!error && data) residentUnitLinks = data;
    }

    // Look up resident links (property_unit_residents junction table)
    let residentJunctionLinks = [];
    if (await hasPropertyUnitResidentsTable()) {
      const { data, error } = await supabase
        .from("property_unit_residents")
        .select("unit_id, tenant_id")
        .in("tenant_id", tenantIds);
      if (!error && data) residentJunctionLinks = data;
    }

    const payerByTenantId = {};
    payerLinks.forEach((link) => {
      if (link.tenant_id) {
        payerByTenantId[link.tenant_id] = {
          unitId: link.id,
          propertyId: link.property_id,
        };
      }
    });

    const residentByTenantId = {};
    residentUnitLinks.forEach((link) => {
      if (link.resident_tenant_id && !residentByTenantId[link.resident_tenant_id]) {
        residentByTenantId[link.resident_tenant_id] = {
          unitId: link.id,
          propertyId: link.property_id,
        };
      }
    });
    residentJunctionLinks.forEach((link) => {
      if (link.tenant_id && !residentByTenantId[link.tenant_id]) {
        residentByTenantId[link.tenant_id] = { unitId: link.unit_id };
      }
    });

    return tenants.map((tenant) => {
      const payerLink = payerByTenantId[tenant.id];
      const residentLink = residentByTenantId[tenant.id];

      const unitId = payerLink?.unitId || residentLink?.unitId || null;
      const propertyId = tenant.propertyId || payerLink?.propertyId || residentLink?.propertyId || null;

      return { ...tenant, unitId, propertyId };
    });
  } catch (err) {
    console.error("enrichTenantsWithUnitId failed, returning tenants without unitId:", err);
    return tenants;
  }
}

export async function listTenants({ propertyId } = {}) {
  let sql = "SELECT * FROM tenants";
  const args = [];

  if (propertyId) {
    sql += " WHERE property_id = ?";
    args.push(propertyId);
  }

  sql += " ORDER BY name";
  const [rows] = args.length ? await pool.query(sql, args) : await pool.query(sql);
  const tenants = (rows || []).map(rowToTenant);
  return enrichTenantsWithUnitId(tenants);
}

export async function findTenantById(id) {
  const [rows] = await pool.query("SELECT * FROM tenants WHERE id = ?", [id]);
  const tenant = rowToTenant(rows?.[0] || null);
  if (!tenant) return null;
  const [enriched] = await enrichTenantsWithUnitId([tenant]);
  return enriched;
}

export async function findTenantByEmail(email, { excludeTenantId = null } = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const [rows] = await pool.query("SELECT * FROM tenants WHERE email = ?", [normalizedEmail]);
  const matchedRow = (rows || []).find((row) => {
    const rowId = row?.id ? String(row.id) : null;
    return !excludeTenantId || rowId !== String(excludeTenantId);
  });
  const tenant = rowToTenant(matchedRow || null);
  if (!tenant) return null;
  const [enriched] = await enrichTenantsWithUnitId([tenant]);
  return enriched;
}

export async function updateTenantHousingLink(tenantId, { propertyId, kitnetNumber }) {
  if (!tenantId) return;

  await pool.query(
    `UPDATE tenants
        SET property_id = ?,
            kitnet_number = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [propertyId || null, kitnetNumber || null, tenantId]
  );
}

export async function updateTenantPaymentResponsibleStatus(tenantId, isPaymentResponsible) {
  if (!tenantId) return;

  const support = await getTenantColumnSupport();
  if (!support.hasIsPaymentResponsible) return;

  await pool.query(
    `UPDATE tenants
        SET is_payment_responsible = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [!!isPaymentResponsible, tenantId]
  );
}

function buildTenantInsertData(payload, support, organizationId) {
  const columns = [
    "id",
    "name",
    "phone",
    "kitnet_number",
    "rent_value",
    "start_date",
    "payment_day",
    "status",
    "observacao",
    "property_id",
  ];
  const values = [
    payload.id,
    payload.name,
    payload.phone,
    payload.kitnetNumber,
    payload.rentValue,
    payload.startDate,
    payload.paymentDay,
    payload.status,
    payload.observacao,
    payload.propertyId,
  ];

  if (support.hasDocumentNumber) {
    columns.push("document_number");
    values.push(payload.documentNumber);
  }
  if (support.hasAddress) {
    columns.push("address");
    values.push(payload.address);
  }
  if (support.hasBirthDate) {
    columns.push("birth_date");
    values.push(payload.birthDate);
  }
  if (support.hasEmail) {
    columns.push("email");
    values.push(payload.email);
  }
  if (support.hasIsPaymentResponsible) {
    columns.push("is_payment_responsible");
    values.push(payload.isPaymentResponsible);
  }
  if (support.hasOrganizationId) {
    columns.push("organization_id");
    values.push(organizationId);
  }
  if (support.hasIptu) {
    columns.push("iptu_value", "iptu_add_to_rent", "iptu_installments");
    values.push(payload.iptuValue ?? 0, !!payload.iptuAddToRent, payload.iptuInstallments ?? 12);
  }

  return { columns, values };
}

function buildTenantUpdateData(payload, support, organizationId) {
  const assignments = [
    "name = ?",
    "phone = ?",
    "kitnet_number = ?",
    "rent_value = ?",
    "start_date = ?",
    "payment_day = ?",
    "status = ?",
    "observacao = ?",
    "property_id = ?",
  ];
  const values = [
    payload.name,
    payload.phone,
    payload.kitnetNumber,
    payload.rentValue,
    payload.startDate,
    payload.paymentDay,
    payload.status,
    payload.observacao,
    payload.propertyId,
  ];

  if (support.hasDocumentNumber) {
    assignments.push("document_number = ?");
    values.push(payload.documentNumber);
  }
  if (support.hasAddress) {
    assignments.push("address = ?");
    values.push(payload.address);
  }
  if (support.hasBirthDate) {
    assignments.push("birth_date = ?");
    values.push(payload.birthDate);
  }
  if (support.hasEmail) {
    assignments.push("email = ?");
    values.push(payload.email);
  }
  if (support.hasIsPaymentResponsible) {
    assignments.push("is_payment_responsible = ?");
    values.push(payload.isPaymentResponsible);
  }
  if (support.hasOrganizationId) {
    assignments.push("organization_id = ?");
    values.push(organizationId);
  }
  if (support.hasIptu) {
    assignments.push("iptu_value = ?", "iptu_add_to_rent = ?", "iptu_installments = ?");
    values.push(payload.iptuValue ?? 0, !!payload.iptuAddToRent, payload.iptuInstallments ?? 12);
  }

  return { assignments, values };
}

export async function insertTenantRecord(payload, organizationId) {
  const support = await getTenantColumnSupport();
  const { columns, values } = buildTenantInsertData(payload, support, organizationId);
  const placeholders = columns.map(() => "?").join(", ");

  await pool.query(
    `INSERT INTO tenants (${columns.join(", ")})
     VALUES (${placeholders})`,
    values
  );
}

export async function updateTenantRecord(id, payload, organizationId) {
  const support = await getTenantColumnSupport();
  const { assignments, values } = buildTenantUpdateData(payload, support, organizationId);

  await pool.query(
    `UPDATE tenants SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, id]
  );
}

export async function deleteTenantRecord(id) {
  const [result] = await pool.query("DELETE FROM tenants WHERE id = ?", [id]);
  return result?.affectedRows || 0;
}

export async function listPayerUnitsByTenantId(tenantId) {
  const support = await getPropertyUnitColumnSupport();
  if (!support.hasTenantId || !tenantId) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("property_units")
    .select("id,property_id")
    .eq("tenant_id", tenantId);

  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function findUnitPayerTenantId({ propertyId, unitId }) {
  const support = await getPropertyUnitColumnSupport();
  if (!support.hasTenantId || !propertyId || !unitId) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("property_units")
    .select("tenant_id")
    .eq("id", unitId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) return null;
  return data?.tenant_id || null;
}

export async function clearTenantPayerLinks(tenantId) {
  const support = await getPropertyUnitColumnSupport();
  if (!support.hasTenantId || !tenantId) return;

  const supabase = getSupabaseClient();
  await supabase
    .from("property_units")
    .update({ tenant_id: null, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);
}

export async function assignTenantPayerLink({ tenantId, propertyId, unitId }) {
  const support = await getPropertyUnitColumnSupport();
  if (!support.hasTenantId || !tenantId || !propertyId || !unitId) return;

  const supabase = getSupabaseClient();
  await supabase
    .from("property_units")
    .update({ tenant_id: tenantId, updated_at: new Date().toISOString() })
    .eq("id", unitId)
    .eq("property_id", propertyId);
}

export async function clearTenantResidentLinks(tenantId) {
  if (!tenantId) return;

  const support = await getPropertyUnitColumnSupport();
  const supabase = getSupabaseClient();

  if (support.hasResidentTenantId) {
    await supabase
      .from("property_units")
      .update({ resident_tenant_id: null, updated_at: new Date().toISOString() })
      .eq("resident_tenant_id", tenantId);
  }

  if (await hasPropertyUnitResidentsTable()) {
    await supabase.from("property_unit_residents").delete().eq("tenant_id", tenantId);
  }
}

export async function assignTenantResidentLink({ tenantId, propertyId, unitId }) {
  if (!tenantId || !propertyId || !unitId) return;

  const support = await getPropertyUnitColumnSupport();
  const supabase = getSupabaseClient();

  if (support.hasResidentTenantId) {
    await supabase
      .from("property_units")
      .update({ resident_tenant_id: tenantId, updated_at: new Date().toISOString() })
      .eq("id", unitId)
      .eq("property_id", propertyId);
  }

  if (await hasPropertyUnitResidentsTable()) {
    // Derive organization_id from the unit
    const { data: unitRow } = await supabase
      .from("property_units")
      .select("organization_id")
      .eq("id", unitId)
      .maybeSingle();
    await supabase.from("property_unit_residents").insert({
      unit_id: unitId,
      tenant_id: tenantId,
      organization_id: unitRow?.organization_id,
    });
  }
}

export async function setPropertyPaymentResponsible(propertyId, email) {
  const support = await getPropertyColumnSupport();
  if (!support.hasPaymentResponsible || !propertyId) return;

  const supabase = getSupabaseClient();
  await supabase
    .from("properties")
    .update({
      payment_responsible: email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId);
}

export async function refreshPropertyPaymentResponsible(propertyId) {
  const propertySupport = await getPropertyColumnSupport();
  const unitSupport = await getPropertyUnitColumnSupport();
  if (!propertySupport.hasPaymentResponsible || !unitSupport.hasTenantId || !propertyId) return;

  const supabase = getSupabaseClient();
  const { data: payerUnits } = await supabase
    .from("property_units")
    .select("tenant_id,created_at")
    .eq("property_id", propertyId)
    .not("tenant_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);

  const payerTenantId = payerUnits?.[0]?.tenant_id || null;
  let email = null;
  if (payerTenantId) {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("email")
      .eq("id", payerTenantId)
      .maybeSingle();
    email = tenantRow?.email || null;
  }

  await setPropertyPaymentResponsible(propertyId, email);
}

export async function getSchemaSupportSummary() {
  const [tenantSupport, propertySupport] = await Promise.all([
    getTenantColumnSupport(),
    getPropertyColumnSupport(),
  ]);

  return {
    hasDocumentNumber: tenantSupport.hasDocumentNumber,
    hasAddress: tenantSupport.hasAddress,
    hasBirthDate: tenantSupport.hasBirthDate,
    hasEmail: tenantSupport.hasEmail,
    hasIsPaymentResponsible: tenantSupport.hasIsPaymentResponsible,
    hasPaymentDay: tenantSupport.hasPaymentDay,
    hasPropertyPaymentResponsible: propertySupport.hasPaymentResponsible,
  };
}

export function normalizePaymentResponsibleFlag(value) {
  return toBoolean(value);
}
