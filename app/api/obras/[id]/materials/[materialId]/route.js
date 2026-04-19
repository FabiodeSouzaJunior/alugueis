import { NextResponse } from "next/server";
import { pool, rowToObraMaterial } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _PUT(request, { params }) {
  try {
    const { id: obraId, materialId } = await resolveParams(params);
    const body = await request.json();
    const materialName = body.materialName ?? "";
    const quantity = Number(body.quantity) ?? 0;
    const unit = body.unit ?? "un";
    const unitPrice = Number(body.unitPrice) ?? 0;
    const totalValue = quantity * unitPrice;
    const supplier = body.supplier ?? null;
    const purchaseDate = body.purchaseDate || null;

    const [result] = await pool.query(
      `UPDATE obra_materials SET material_name = ?, quantity = ?, unit = ?, unit_price = ?, total_value = ?, supplier = ?, purchase_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND obra_id = ?`,
      [materialName, quantity, unit, unitPrice, totalValue, supplier, purchaseDate, materialId, obraId]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const costDate = purchaseDate || null;
    await pool.query(
      `UPDATE obra_costs SET date = COALESCE(?, date), description = ?, value = ?, updated_at = CURRENT_TIMESTAMP WHERE obra_id = ? AND reference_type = 'material' AND reference_id = ?`,
      [costDate, materialName, totalValue, obraId, materialId]
    );

    const [rows] = await pool.query("SELECT * FROM obra_materials WHERE id = ?", [materialId]);
    return NextResponse.json(rowToObraMaterial(rows[0]));
  } catch (err) {
    console.error("PUT /api/obras/[id]/materials/[materialId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const { id: obraId, materialId } = await resolveParams(params);
    await pool.query(
      "DELETE FROM obra_costs WHERE obra_id = ? AND reference_type = 'material' AND reference_id = ?",
      [obraId, materialId]
    );
    const [result] = await pool.query("DELETE FROM obra_materials WHERE id = ? AND obra_id = ?", [materialId, obraId]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]/materials/[materialId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
