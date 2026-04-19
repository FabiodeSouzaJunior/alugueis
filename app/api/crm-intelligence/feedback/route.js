import { NextResponse } from "next/server";
import { pool, rowToTenantFeedback } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { createNotification } from "@/lib/notificationService";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const category = searchParams.get("category");

    let sql = "SELECT * FROM tenant_feedback";
    const values = [];
    const where = [];
    if (tenantId) {
      where.push("tenant_id = ?");
      values.push(tenantId);
    }
    if (category) {
      where.push("category = ?");
      values.push(category);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY created_at DESC";

    const [rows] = await pool.query(sql, values);
    const list = (rows || []).map(rowToTenantFeedback);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/crm-intelligence/feedback", err);
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
    const category = body.category ?? null;
    const comment = body.comment ?? null;

    await pool.query(
      `INSERT INTO tenant_feedback (id, tenant_id, category, comment)
       VALUES (?, ?, ?, ?)`,
      [id, tenantId, category, comment]
    );
    const [tRows] = await pool.query("SELECT kitnet_number FROM tenants WHERE id = ?", [tenantId]);
    const kitnet = tRows[0]?.kitnet_number ? `Kitnet ${tRows[0].kitnet_number}` : "Morador";
    createNotification({
      type: "feedback_new",
      title: "Novo comentário de feedback",
      message: category ? `${kitnet} — ${category}` : `${kitnet} — Novo comentário.`,
      relatedEntity: "tenant",
      relatedId: tenantId,
      linkHref: "/crm",
    }).catch(() => {});

    const [rows] = await pool.query("SELECT * FROM tenant_feedback WHERE id = ?", [id]);
    return NextResponse.json(rowToTenantFeedback(rows[0]));
  } catch (err) {
    console.error("POST /api/crm-intelligence/feedback", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
