import { NextResponse } from "next/server";
import { pool, rowToTenantExit } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { createNotification } from "@/lib/notificationService";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    let sql = "SELECT * FROM tenant_exits";
    const values = [];
    if (tenantId) {
      sql += " WHERE tenant_id = ?";
      values.push(tenantId);
    }
    sql += " ORDER BY exit_date DESC";

    const [rows] = await pool.query(sql, values);
    const list = (rows || []).map(rowToTenantExit);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/crm-intelligence/exits", err);
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
    const exitDate = body.exitDate || new Date().toISOString().split("T")[0];
    const reasonCode = body.reasonCode ?? "outro";
    const notes = body.notes ?? null;

    await pool.query(
      `INSERT INTO tenant_exits (id, tenant_id, exit_date, reason_code, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tenantId, exitDate, reasonCode, notes]
    );

    await pool.query("UPDATE tenants SET status = 'inativo' WHERE id = ?", [tenantId]);
    const [tRows] = await pool.query("SELECT kitnet_number FROM tenants WHERE id = ?", [tenantId]);
    const kitnet = tRows[0]?.kitnet_number ? `Kitnet ${tRows[0].kitnet_number}` : "Inquilino";
    createNotification({
      type: "tenant_exit",
      title: "Inquilino saiu da kitnet",
      message: `${kitnet} — Saída registrada.`,
      relatedEntity: "tenant",
      relatedId: tenantId,
      linkHref: "/crm",
    }).catch(() => {});

    const [rows] = await pool.query("SELECT * FROM tenant_exits WHERE id = ?", [id]);
    return NextResponse.json(rowToTenantExit(rows[0]));
  } catch (err) {
    console.error("POST /api/crm-intelligence/exits", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
