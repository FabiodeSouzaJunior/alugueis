import { NextResponse } from "next/server";
import { pool, rowToObraCost } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const [rows] = await pool.query(
      "SELECT * FROM obra_costs WHERE obra_id = ? ORDER BY date DESC, created_at DESC",
      [obraId]
    );
    const list = rows.map(rowToObraCost);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras/[id]/costs", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const body = await request.json();
    const category = body.category ?? "Outros";
    const referenceType = body.referenceType ?? null;
    const referenceId = body.referenceId ?? null;

    if (category === "Material" || category === "Mão de obra") {
      if (!referenceType || !referenceId) {
        return NextResponse.json(
          { error: "Custos de Material e Mão de obra são gerados automaticamente. Registre na página de Materiais ou de Trabalhadores." },
          { status: 400 }
        );
      }
    }

    const id = body.id || generateId();
    const date = body.date ?? new Date().toISOString().split("T")[0];
    const description = body.description ?? null;
    const value = Number(body.value) ?? 0;
    const responsible = body.responsible ?? null;
    const notes = body.notes ?? null;

    await pool.query(
      `INSERT INTO obra_costs (id, obra_id, date, category, description, value, responsible, notes, reference_type, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, obraId, date, category, description, value, responsible, notes, referenceType, referenceId]
    );

    const [rows] = await pool.query("SELECT * FROM obra_costs WHERE id = ?", [id]);
    return NextResponse.json(rowToObraCost(rows[0]));
  } catch (err) {
    console.error("POST /api/obras/[id]/costs", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
