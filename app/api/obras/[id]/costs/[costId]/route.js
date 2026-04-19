import { NextResponse } from "next/server";
import { pool, rowToObraCost } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _PUT(request, { params }) {
  try {
    const { id: obraId, costId } = await resolveParams(params);
    const [existing] = await pool.query("SELECT reference_type FROM obra_costs WHERE id = ? AND obra_id = ?", [costId, obraId]);
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const refType = existing[0].reference_type;
    if (refType === "material" || refType === "worker") {
      return NextResponse.json(
        { error: "Este custo é gerado automaticamente. Edite pelo cadastro de Material ou Trabalhador." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const date = body.date ?? null;
    const category = body.category ?? "Outros";
    const description = body.description ?? null;
    const value = Number(body.value) ?? 0;
    const responsible = body.responsible ?? null;
    const notes = body.notes ?? null;

    const [result] = await pool.query(
      `UPDATE obra_costs SET date = ?, category = ?, description = ?, value = ?, responsible = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND obra_id = ?`,
      [date, category, description, value, responsible, notes, costId, obraId]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [rows] = await pool.query("SELECT * FROM obra_costs WHERE id = ?", [costId]);
    return NextResponse.json(rowToObraCost(rows[0]));
  } catch (err) {
    console.error("PUT /api/obras/[id]/costs/[costId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const { id: obraId, costId } = await resolveParams(params);
    const [existing] = await pool.query("SELECT reference_type FROM obra_costs WHERE id = ? AND obra_id = ?", [costId, obraId]);
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const refType = existing[0].reference_type;
    if (refType === "material" || refType === "worker") {
      return NextResponse.json(
        { error: "Este custo é gerado automaticamente. Exclua pelo cadastro de Material ou Trabalhador." },
        { status: 403 }
      );
    }

    const [result] = await pool.query("DELETE FROM obra_costs WHERE id = ? AND obra_id = ?", [costId, obraId]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]/costs/[costId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
