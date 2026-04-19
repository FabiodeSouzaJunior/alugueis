import { NextResponse } from "next/server";
import { pool, rowToPropertyUnit } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { getSupabaseClient } from "@/database/supabaseClient";
import { withAuth } from "@/lib/auth";

let propertyUnitsColumnSupport = {
  checked: false,
  hasMaxPeople: false,
  hasOrganizationId: false,
};

function parseLegacyResidentTenantIds(rawValue) {
  if (!rawValue) return [];
  return String(rawValue)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function detectPropertyUnitsColumns(supabase) {
  if (propertyUnitsColumnSupport.checked) return propertyUnitsColumnSupport;

  const [maxPeopleProbe, organizationProbe] = await Promise.all([
    supabase.from("property_units").select("max_people").limit(1),
    supabase.from("property_units").select("organization_id").limit(1),
  ]);

  propertyUnitsColumnSupport = {
    checked: true,
    hasMaxPeople: !maxPeopleProbe.error,
    hasOrganizationId: !organizationProbe.error,
  };

  return propertyUnitsColumnSupport;
}

async function _GET(_request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { id: propertyId } = await params;
    const { data: unitRows, error: unitErr } = await supabase
      .from("property_units")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });
    if (unitErr) throw unitErr;

    const unitIds = (unitRows || []).map((u) => u.id).filter(Boolean);
    let residentLinksByUnitId = {};
    const residentLinksRes = unitIds.length
      ? await supabase
          .from("property_unit_residents")
          .select("unit_id, tenant_id")
          .in("unit_id", unitIds)
      : { data: [], error: null };
    if (!residentLinksRes.error) {
      (residentLinksRes.data || []).forEach((link) => {
        const key = String(link.unit_id);
        if (!residentLinksByUnitId[key]) residentLinksByUnitId[key] = [];
        residentLinksByUnitId[key].push(link.tenant_id);
      });
    }

    const tenantIds = Array.from(new Set((unitRows || []).map((u) => u.tenant_id).filter(Boolean)));
    const residentIds = Array.from(
      new Set(
        Object.values(residentLinksByUnitId)
          .flat()
          .filter(Boolean)
          .concat(
            (unitRows || [])
              .flatMap((u) => parseLegacyResidentTenantIds(u.resident_tenant_id))
              .filter(Boolean)
          )
      )
    );
    const allTenantIds = Array.from(new Set([...tenantIds, ...residentIds]));
    const { data: tenantRows } = allTenantIds.length
      ? await supabase.from("tenants").select("id,name").in("id", allTenantIds)
      : { data: [] };
    const tenantById = {};
    (tenantRows || []).forEach((t) => {
      tenantById[t.id] = t;
    });

    const units = (unitRows || []).map((r) => ({
      ...rowToPropertyUnit(r),
      tenantName: tenantById[r.tenant_id]?.name ?? null,
      residentTenantIds:
        residentLinksByUnitId[String(r.id)]?.filter(Boolean) ||
        parseLegacyResidentTenantIds(r.resident_tenant_id),
      residentNames: (
        residentLinksByUnitId[String(r.id)]?.filter(Boolean) ||
        parseLegacyResidentTenantIds(r.resident_tenant_id)
      )
        .map((id) => tenantById[id]?.name)
        .filter(Boolean),
      residentName: (() => {
        const firstResidentId =
          residentLinksByUnitId[String(r.id)]?.[0] ??
          parseLegacyResidentTenantIds(r.resident_tenant_id)[0] ??
          null;
        return firstResidentId ? tenantById[firstResidentId]?.name ?? null : null;
      })(),
    }));
    return NextResponse.json(units);
  } catch (err) {
    console.error("GET /api/properties/[id]/units", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { id: propertyId } = await params;
    const body = await request.json();
    const id = body.id || generateId();
    const rentPrice = body.rentPrice != null && body.rentPrice !== "" ? Number(body.rentPrice) : null;
    const unitLabel = body.unitLabel != null ? String(body.unitLabel).trim() || null : null;
    const maxPeople = body.maxPeople != null && body.maxPeople !== "" ? Math.max(0, Number(body.maxPeople)) : null;
    const columnSupport = await detectPropertyUnitsColumns(supabase);

    // In multi-tenant schemas that require organization_id, inherit from property row.
    let organizationId = null;
    if (columnSupport.hasOrganizationId) {
      try {
        const [propertyRows] = await pool.query(
          "SELECT organization_id FROM properties WHERE id = ? LIMIT 1",
          [propertyId]
        );
        organizationId = propertyRows?.[0]?.organization_id ?? null;
      } catch (_) {
        organizationId = null;
      }

      if (!organizationId) {
        return NextResponse.json(
          { error: "Não foi possível identificar organization_id do imóvel selecionado." },
          { status: 400 }
        );
      }
    }

    const columns = ["id", "property_id", "rent_price", "unit_label"];
    const values = [id, propertyId, rentPrice, unitLabel];

    if (columnSupport.hasOrganizationId) {
      columns.push("organization_id");
      values.push(organizationId);
    }

    if (columnSupport.hasMaxPeople) {
      columns.push("max_people");
      values.push(maxPeople);
    }

    const placeholders = columns.map(() => "?").join(", ");
    await pool.query(
      `INSERT INTO property_units (${columns.join(", ")})
       VALUES (${placeholders})`,
      values
    );

    // Read from same SQL source used for insert to avoid schema-cache mismatches in Supabase.
    const [unitRows] = await pool.query("SELECT * FROM property_units WHERE id = ?", [id]);
    const unitRow = unitRows?.[0] || null;

    const tenantId = unitRow?.tenant_id ?? null;
    let tenantRow = null;
    if (tenantId) {
      const [tenantRows] = await pool.query("SELECT name FROM tenants WHERE id = ? LIMIT 1", [tenantId]);
      tenantRow = tenantRows?.[0] || null;
    }

    const unit = unitRow
      ? {
          ...rowToPropertyUnit(unitRow),
          tenantName: tenantRow?.name ?? null,
          residentName: null,
        }
      : null;
    return NextResponse.json(unit);
  } catch (err) {
    console.error("POST /api/properties/[id]/units", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
