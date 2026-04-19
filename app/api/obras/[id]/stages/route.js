import { NextResponse } from "next/server";
import { pool, rowToObraStage } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const [rows] = await pool.query(
      "SELECT * FROM obra_stages WHERE obra_id = ? ORDER BY due_date ASC, id ASC",
      [obraId]
    );
    const list = rows.map(rowToObraStage);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras/[id]/stages", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const body = await request.json();
    const id = body.id || generateId();
    const name = body.name ?? "";
    const status = body.status ?? "Pendente";
    const startDate = body.startDate || null;
    const dueDate = body.dueDate || null;
    const responsible = body.responsible ?? null;

    await pool.query(
      `INSERT INTO obra_stages (id, obra_id, name, status, start_date, due_date, responsible)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, obraId, name, status, startDate, dueDate, responsible]
    );

    const [rows] = await pool.query("SELECT * FROM obra_stages WHERE id = ?", [id]);
    return NextResponse.json(rowToObraStage(rows[0]));
  } catch (err) {
    console.error("POST /api/obras/[id]/stages", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
