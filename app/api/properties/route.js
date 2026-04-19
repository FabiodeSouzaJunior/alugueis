import { NextResponse } from "next/server";
import { pool, rowToProperty, rowToPropertyUnit } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { getSupabaseClient } from "@/database/supabaseClient";
import { withAuth } from "@/lib/auth";

function parseLegacyResidentTenantIds(rawValue) {
  if (!rawValue) return [];
  return String(rawValue)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function _GET(request, context) {
  try {
    const supabase = getSupabaseClient();
    const [rows] = await pool.query(
      `SELECT *
       FROM properties
       ORDER BY name`
    );
    const list = (rows || []).map(rowToProperty);
    let unitsByProperty = {};

    const unitRes = await supabase
      .from("property_units")
      .select("*")
      .order("property_id", { ascending: true })
      .order("created_at", { ascending: true });
    const unitRows = unitRes.data || [];
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

    const tenantIds = Array.from(new Set(unitRows.map((u) => u.tenant_id).filter(Boolean)));
    const legacyResidentIds = Array.from(
      new Set(unitRows.map((u) => u.resident_tenant_id).filter(Boolean))
    );
    const residentIds = Array.from(
      new Set(
        Object.values(residentLinksByUnitId).flat().filter(Boolean).concat(legacyResidentIds)
      )
    );
    const allLinkedTenantIds = Array.from(new Set([...tenantIds, ...residentIds]));
    const { data: tenantRows } = allLinkedTenantIds.length
      ? await supabase.from("tenants").select("id,name").in("id", allLinkedTenantIds)
      : { data: [] };
    const tenantById = {};
    (tenantRows || []).forEach((t) => {
      tenantById[t.id] = t;
    });

    (unitRows || []).forEach((r) => {
      const pid = String(r.property_id ?? "");
      if (!unitsByProperty[pid]) unitsByProperty[pid] = [];
      const residentTenantIds =
        residentLinksByUnitId[String(r.id)]?.filter(Boolean) ||
        parseLegacyResidentTenantIds(r.resident_tenant_id);
      unitsByProperty[pid].push({
        ...rowToPropertyUnit(r),
        tenantName: tenantById[r.tenant_id]?.name ?? null,
        residentName:
          residentTenantIds.length > 0
            ? tenantById[residentTenantIds[0]]?.name ?? null
            : null,
        residentTenantIds,
        residentNames: residentTenantIds
          .map((id) => tenantById[id]?.name)
          .filter(Boolean),
      });
    });

    list.forEach((p) => {
      p.units = unitsByProperty[String(p.id ?? "")] || [];
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/properties", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const name = String(body.name ?? "").trim() || "Sem nome";
    const unitCount = Math.max(0, Number(body.unitCount) ?? 0);
    const observacoes = body.observacoes != null ? String(body.observacoes) : null;
    const estimatedValue = body.estimatedValue != null && body.estimatedValue !== "" ? Number(body.estimatedValue) : null;

    await pool.query(
      `INSERT INTO properties (id, name, unit_count, max_people, current_people, observacoes, estimated_value)
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
      [id, name, unitCount, observacoes, estimatedValue]
    );

    const [rows] = await pool.query("SELECT * FROM properties WHERE id = ?", [id]);
    const property = rowToProperty(rows[0]);
    return NextResponse.json(property);
  } catch (err) {
    console.error("POST /api/properties", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
