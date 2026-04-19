import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/database/supabaseClient";
import { rowToPropertyUnit } from "@/lib/db";
import {
  assertTenantCanBePaymentResponsible,
  syncTenantUnitAssignments,
} from "@/server/modules/tenants";
import { withAuth } from "@/lib/auth";

let propertyUnitsColumnSupport = null;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function parseLegacyResidentTenantIds(rawValue) {
  if (!rawValue) return [];
  return String(rawValue)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function getPropertyUnitsColumnSupport(supabase) {
  if (propertyUnitsColumnSupport) return propertyUnitsColumnSupport;

  const [maxPeopleProbe, tenantProbe, residentProbe] = await Promise.all([
    supabase.from("property_units").select("max_people").limit(1),
    supabase.from("property_units").select("tenant_id").limit(1),
    supabase.from("property_units").select("resident_tenant_id").limit(1),
  ]);

  propertyUnitsColumnSupport = {
    hasMaxPeople: !maxPeopleProbe.error,
    hasTenantId: !tenantProbe.error,
    hasResidentTenantId: !residentProbe.error,
  };

  return propertyUnitsColumnSupport;
}

async function hasResidentsTable(supabase) {
  const probe = await supabase.from("property_unit_residents").select("unit_id").limit(1);
  return !probe.error;
}

async function getResidentsByUnitId(supabase, unitIds) {
  const ids = (unitIds || []).filter(Boolean);
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from("property_unit_residents")
    .select("unit_id, tenant_id")
    .in("unit_id", ids);

  if (error) return {};

  const map = {};
  (data || []).forEach((row) => {
    const key = String(row.unit_id);
    if (!map[key]) map[key] = [];
    map[key].push(row.tenant_id);
  });

  return map;
}

async function buildUnitResponse(supabase, unitRow) {
  if (!unitRow) return null;

  const tenantId = unitRow.tenant_id ?? null;
  const residentsByUnitId = await getResidentsByUnitId(supabase, [unitRow.id]);
  const residentIds =
    residentsByUnitId[String(unitRow.id)]?.filter(Boolean) ||
    parseLegacyResidentTenantIds(unitRow.resident_tenant_id);
  const linkedTenantIds = [tenantId, ...residentIds].filter(Boolean);
  const { data: tenantRows } = linkedTenantIds.length
    ? await supabase.from("tenants").select("id,name").in("id", linkedTenantIds)
    : { data: [] };

  const tenantById = Object.fromEntries((tenantRows || []).map((row) => [row.id, row.name]));

  return {
    ...rowToPropertyUnit(unitRow),
    tenantName: tenantId ? tenantById[tenantId] ?? null : null,
    residentName: residentIds.length > 0 ? tenantById[residentIds[0]] ?? null : null,
    residentTenantIds: residentIds,
    residentNames: residentIds.map((id) => tenantById[id]).filter(Boolean),
  };
}

function normalizeNullableId(value) {
  return value != null ? String(value).trim() || null : null;
}

function normalizeResidentTenantIds(body, fallbackResidentTenantIds) {
  const hasResidentSelection =
    hasOwn(body, "residentTenantIds") || hasOwn(body, "residentTenantId");

  if (!hasResidentSelection) {
    return {
      hasResidentSelection,
      residentTenantIds: Array.from(new Set((fallbackResidentTenantIds || []).filter(Boolean))),
    };
  }

  const residentTenantId = normalizeNullableId(body.residentTenantId);
  const residentTenantIds = Array.isArray(body.residentTenantIds)
    ? Array.from(
        new Set(
          body.residentTenantIds
            .map((id) => normalizeNullableId(id))
            .filter(Boolean)
        )
      )
    : residentTenantId
      ? [residentTenantId]
      : [];

  return { hasResidentSelection, residentTenantIds };
}

async function _GET(_request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { id: propertyId, unitId } = await params;
    const { data: unitRow, error: unitError } = await supabase
      .from("property_units")
      .select("*")
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (unitError) throw unitError;
    if (!unitRow) {
      return NextResponse.json({ error: "Unidade nao encontrada" }, { status: 404 });
    }

    return NextResponse.json(await buildUnitResponse(supabase, unitRow));
  } catch (error) {
    console.error("GET /api/properties/[id]/units/[unitId]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao carregar unidade." },
      { status: error?.status || 500 }
    );
  }
}

async function _PUT(request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { id: propertyId, unitId } = await params;
    const body = await request.json();
    const support = await getPropertyUnitsColumnSupport(supabase);
    const residentsTableEnabled = await hasResidentsTable(supabase);

    const { data: previousUnitRow, error: previousUnitError } = await supabase
      .from("property_units")
      .select("*")
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (previousUnitError) throw previousUnitError;
    if (!previousUnitRow) {
      return NextResponse.json({ error: "Unidade nao encontrada" }, { status: 404 });
    }

    const previousResidentsByUnitId = await getResidentsByUnitId(supabase, [unitId]);
    const previousResidentTenantIds =
      previousResidentsByUnitId[String(unitId)]?.filter(Boolean) ||
      parseLegacyResidentTenantIds(previousUnitRow.resident_tenant_id);

    const hasRentPrice = hasOwn(body, "rentPrice");
    const hasUnitLabel = hasOwn(body, "unitLabel");
    const hasMaxPeople = hasOwn(body, "maxPeople");
    const hasTenantSelection = hasOwn(body, "tenantId");
    const nextTenantId = hasTenantSelection
      ? normalizeNullableId(body.tenantId)
      : previousUnitRow.tenant_id ?? null;

    if (hasTenantSelection && nextTenantId) {
      await assertTenantCanBePaymentResponsible(nextTenantId);
    }

    const { hasResidentSelection, residentTenantIds } = normalizeResidentTenantIds(
      body,
      previousResidentTenantIds
    );

    const nextUnitLabel = hasUnitLabel
      ? normalizeNullableId(body.unitLabel)
      : previousUnitRow.unit_label ?? null;
    const nextRentPrice = hasRentPrice
      ? body.rentPrice != null && body.rentPrice !== ""
        ? Number(body.rentPrice)
        : null
      : previousUnitRow.rent_price ?? null;
    const nextMaxPeople = hasMaxPeople
      ? body.maxPeople != null && body.maxPeople !== ""
        ? Math.max(0, Number(body.maxPeople))
        : null
      : previousUnitRow.max_people ?? null;

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (hasRentPrice) updateData.rent_price = nextRentPrice;
    if (hasUnitLabel) updateData.unit_label = nextUnitLabel;
    if (support.hasMaxPeople && hasMaxPeople) updateData.max_people = nextMaxPeople;
    if (support.hasTenantId && hasTenantSelection) updateData.tenant_id = nextTenantId;
    if (support.hasResidentTenantId && hasResidentSelection) {
      updateData.resident_tenant_id = residentsTableEnabled
        ? residentTenantIds[0] ?? null
        : residentTenantIds.join(",") || null;
    }

    const { data: updateResult, error: updateError } = await supabase
      .from("property_units")
      .update(updateData)
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .select("id");

    if (updateError) throw updateError;
    if (!updateResult || updateResult.length === 0) {
      return NextResponse.json({ error: "Unidade nao encontrada" }, { status: 404 });
    }

    if (residentsTableEnabled && hasResidentSelection) {
      if (residentTenantIds.length) {
        await supabase
          .from("property_unit_residents")
          .delete()
          .in("tenant_id", residentTenantIds)
          .neq("unit_id", unitId);
      }

      await supabase.from("property_unit_residents").delete().eq("unit_id", unitId);

      if (residentTenantIds.length) {
        await supabase.from("property_unit_residents").insert(
          residentTenantIds.map((residentTenantId) => ({
            unit_id: unitId,
            tenant_id: residentTenantId,
            organization_id: previousUnitRow.organization_id,
          }))
        );
      }
    }

    await syncTenantUnitAssignments({
      propertyId,
      unitId,
      unitLabel: nextUnitLabel,
      payerTenantId: nextTenantId,
      residentTenantIds,
      previousPayerTenantId: previousUnitRow.tenant_id ?? null,
      validatePayerTenant: hasTenantSelection,
    });

    const { data: unitRow, error: unitError } = await supabase
      .from("property_units")
      .select("*")
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (unitError) throw unitError;

    return NextResponse.json(await buildUnitResponse(supabase, unitRow));
  } catch (error) {
    console.error("PUT /api/properties/[id]/units/[unitId]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar unidade." },
      { status: error?.status || 500 }
    );
  }
}

async function _DELETE(_request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { id: propertyId, unitId } = await params;
    const { data, error } = await supabase
      .from("property_units")
      .delete()
      .eq("id", unitId)
      .eq("property_id", propertyId)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Unidade nao encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/properties/[id]/units/[unitId]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir unidade." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
