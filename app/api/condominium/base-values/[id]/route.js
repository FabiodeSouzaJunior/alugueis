import { NextResponse } from "next/server";
import { pool, rowToCondominiumBaseValue } from "@/lib/db";
import { syncTenantPaymentsExpectedAmountsForProperty } from "@/server/modules/financial/tenant-billing.service";
import { withAuth } from "@/lib/auth";

async function resolveRouteParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const [rows] = await pool.query(
      "SELECT * FROM condominium_base_values WHERE id = ?",
      [id]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rowToCondominiumBaseValue(rows[0]));
  } catch (err) {
    console.error("GET /api/condominium/base-values/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const [currentRows] = await pool.query(
      "SELECT property_id FROM condominium_base_values WHERE id = ?",
      [id]
    );
    const propertyId = currentRows?.[0]?.property_id || null;
    const [result] = await pool.query(
      "DELETE FROM condominium_base_values WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (propertyId) {
      await syncTenantPaymentsExpectedAmountsForProperty(propertyId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/condominium/base-values/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const DELETE = withAuth(_DELETE);
