import { NextResponse } from "next/server";
import { pool, rowToProperty } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function _GET(_request, { params }) {
  try {
    const { id } = await params;
    const [rows] = await pool.query(
      `SELECT id, name, unit_count, max_people, current_people, observacoes, estimated_value, created_at, updated_at
       FROM properties WHERE id = ?`,
      [id]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    return NextResponse.json(rowToProperty(rows[0]));
  } catch (err) {
    console.error("GET /api/properties/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = String(body.name ?? "").trim() || "Sem nome";
    const unitCount = Math.max(0, Number(body.unitCount) ?? 0);
    const observacoes = body.observacoes != null ? String(body.observacoes) : null;
    const estimatedValue = body.estimatedValue != null && body.estimatedValue !== "" ? Number(body.estimatedValue) : null;

    const [result] = await pool.query(
      `UPDATE properties
       SET name = ?, unit_count = ?, observacoes = ?, estimated_value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, unitCount, observacoes, estimatedValue, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }

    const [rows] = await pool.query("SELECT * FROM properties WHERE id = ?", [id]);
    return NextResponse.json(rowToProperty(rows[0]));
  } catch (err) {
    console.error("PUT /api/properties/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const [result] = await pool.query("DELETE FROM properties WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/properties/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
