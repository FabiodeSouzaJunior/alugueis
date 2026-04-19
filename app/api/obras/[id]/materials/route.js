import { NextResponse } from "next/server";
import { pool, rowToObraMaterial } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const [rows] = await pool.query(
      "SELECT * FROM obra_materials WHERE obra_id = ? ORDER BY purchase_date DESC, created_at DESC",
      [obraId]
    );
    const list = rows.map(rowToObraMaterial);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras/[id]/materials", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const body = await request.json();
    const id = body.id || generateId();
    const materialName = body.materialName ?? "";
    const quantity = Number(body.quantity) ?? 0;
    const unit = body.unit ?? "un";
    const unitPrice = Number(body.unitPrice) ?? 0;
    const totalValue = quantity * unitPrice;
    const supplier = body.supplier ?? null;
    const purchaseDate = body.purchaseDate || null;

    await pool.query(
      `INSERT INTO obra_materials (id, obra_id, material_name, quantity, unit, unit_price, total_value, supplier, purchase_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, obraId, materialName, quantity, unit, unitPrice, totalValue, supplier, purchaseDate]
    );

    const costId = generateId();
    const costDate = purchaseDate || new Date().toISOString().split("T")[0];
    await pool.query(
      `INSERT INTO obra_costs (id, obra_id, date, category, description, value, responsible, notes, reference_type, reference_id)
       VALUES (?, ?, ?, 'Material', ?, ?, NULL, NULL, 'material', ?)`,
      [costId, obraId, costDate, materialName, totalValue, id]
    );

    const [rows] = await pool.query("SELECT * FROM obra_materials WHERE id = ?", [id]);
    return NextResponse.json(rowToObraMaterial(rows[0]));
  } catch (err) {
    console.error("POST /api/obras/[id]/materials", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
