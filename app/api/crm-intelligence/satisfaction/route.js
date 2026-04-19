import { NextResponse } from "next/server";
import { pool, rowToTenantSatisfaction } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { createNotification } from "@/lib/notificationService";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    let sql = "SELECT * FROM tenant_satisfaction";
    const values = [];
    if (tenantId) {
      sql += " WHERE tenant_id = ?";
      values.push(tenantId);
    }
    sql += " ORDER BY created_at DESC";

    const [rows] = await pool.query(sql, values);
    const list = (rows || []).map(rowToTenantSatisfaction);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/crm-intelligence/satisfaction", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const tenantId = body.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId é obrigatório" }, { status: 400 });
    }
    const comfort = body.comfort != null ? Number(body.comfort) : null;
    const cleanliness = body.cleanliness != null ? Number(body.cleanliness) : null;
    const infrastructure = body.infrastructure != null ? Number(body.infrastructure) : null;
    const location = body.location != null ? Number(body.location) : null;
    const costBenefit = body.costBenefit != null ? Number(body.costBenefit) : null;
    const overall = body.overall != null ? Number(body.overall) : null;

    await pool.query(
      `INSERT INTO tenant_satisfaction (id, tenant_id, comfort, cleanliness, infrastructure, location, cost_benefit, overall)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, comfort, cleanliness, infrastructure, location, costBenefit, overall]
    );
    const [tRows] = await pool.query("SELECT kitnet_number FROM tenants WHERE id = ?", [tenantId]);
    const kitnet = tRows[0]?.kitnet_number ? `Kitnet ${tRows[0].kitnet_number}` : "Morador";
    const isLow = overall != null && overall <= 2;
    createNotification({
      type: isLow ? "satisfaction_low" : "satisfaction_new",
      title: isLow ? "Avaliação baixa registrada" : "Nova avaliação de satisfação",
      message: isLow
        ? `Morador da ${kitnet} registrou avaliação de ${overall} estrela(s).`
        : `Nova avaliação registrada na ${kitnet}.`,
      relatedEntity: "tenant",
      relatedId: tenantId,
      linkHref: "/crm",
    }).catch(() => {});

    const [rows] = await pool.query("SELECT * FROM tenant_satisfaction WHERE id = ?", [id]);
    return NextResponse.json(rowToTenantSatisfaction(rows[0]));
  } catch (err) {
    console.error("POST /api/crm-intelligence/satisfaction", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
