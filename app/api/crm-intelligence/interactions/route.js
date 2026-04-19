import { NextResponse } from "next/server";
import { pool, rowToTenantInteraction } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    let sql = "SELECT * FROM tenant_interactions";
    const values = [];
    if (tenantId) {
      sql += " WHERE tenant_id = ?";
      values.push(tenantId);
    }
    sql += " ORDER BY occurred_at DESC";

    const [rows] = await pool.query(sql, values);
    const list = (rows || []).map(rowToTenantInteraction);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/crm-intelligence/interactions", err);
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
    const type = body.type ?? "outro";
    const description = body.description ?? null;
    const occurredAt = body.occurredAt || new Date().toISOString();

    await pool.query(
      `INSERT INTO tenant_interactions (id, tenant_id, type, description, occurred_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tenantId, type, description, occurredAt]
    );

    const [rows] = await pool.query("SELECT * FROM tenant_interactions WHERE id = ?", [id]);
    return NextResponse.json(rowToTenantInteraction(rows[0]));
  } catch (err) {
    console.error("POST /api/crm-intelligence/interactions", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
