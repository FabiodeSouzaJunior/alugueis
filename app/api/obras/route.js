import { NextResponse } from "next/server";
import { pool, rowToObra } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import {
  detectObrasHasOrganizationId,
  resolveOrganizationIdForObra,
} from "@/lib/organizationScope";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const [rows] = await pool.query(
      "SELECT id, property_id, name, budget, start_date, end_date, area_m2, status, created_at, updated_at FROM obras ORDER BY created_at DESC"
    );
    const list = (rows || []).map(rowToObra);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const propertyId = body.propertyId != null && String(body.propertyId).trim() ? String(body.propertyId).trim() : null;
    const name = body.name ?? "Nova Obra";
    const budget = Number(body.budget) ?? 0;
    const startDate = body.startDate || null;
    const endDate = body.endDate || null;
    const areaM2 = body.areaM2 != null ? Number(body.areaM2) : null;
    const status = body.status ?? "ativa";

    const columnSupport = await detectObrasHasOrganizationId();
    let organizationId = null;
    if (columnSupport.hasOrganizationId) {
      organizationId = await resolveOrganizationIdForObra(pool, {
        propertyId,
        organizationId: body.organizationId,
      });
      if (!organizationId) {
        return NextResponse.json(
          {
            error:
              "Não foi possível definir organization_id da obra. Vincule a obra a um imóvel com organização ou cadastre uma organização.",
          },
          { status: 400 }
        );
      }
    }

    const columns = [
      "id",
      "property_id",
      "name",
      "budget",
      "start_date",
      "end_date",
      "area_m2",
      "status",
    ];
    const values = [id, propertyId, name, budget, startDate, endDate, areaM2, status];
    if (columnSupport.hasOrganizationId) {
      columns.push("organization_id");
      values.push(organizationId);
    }

    const placeholders = columns.map(() => "?").join(", ");
    await pool.query(
      `INSERT INTO obras (${columns.join(", ")})
       VALUES (${placeholders})`,
      values
    );

    const [rows] = await pool.query("SELECT * FROM obras WHERE id = ?", [id]);
    return NextResponse.json(rowToObra(rows[0]));
  } catch (err) {
    console.error("POST /api/obras", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
