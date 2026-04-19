import { NextResponse } from "next/server";
import { pool, rowToObra } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id } = await resolveParams(params);
    const [rows] = await pool.query("SELECT * FROM obras WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToObra(rows[0]));
  } catch (err) {
    console.error("GET /api/obras/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, { params }) {
  try {
    const { id } = await resolveParams(params);
    const body = await request.json();
    const propertyId = body.propertyId != null && String(body.propertyId).trim() ? String(body.propertyId).trim() : null;
    const name = body.name ?? "";
    const budget = Number(body.budget) ?? 0;
    const startDate = body.startDate || null;
    const endDate = body.endDate || null;
    const areaM2 = body.areaM2 != null ? Number(body.areaM2) : null;
    const status = body.status ?? "ativa";

    await pool.query(
      `UPDATE obras SET property_id = ?, name = ?, budget = ?, start_date = ?, end_date = ?, area_m2 = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [propertyId, name, budget, startDate, endDate, areaM2, status, id]
    );

    const [rows] = await pool.query("SELECT * FROM obras WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToObra(rows[0]));
  } catch (err) {
    console.error("PUT /api/obras/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const { id } = await resolveParams(params);
    const [result] = await pool.query("DELETE FROM obras WHERE id = ?", [id]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
