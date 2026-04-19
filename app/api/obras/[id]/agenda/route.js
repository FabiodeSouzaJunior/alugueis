import { NextResponse } from "next/server";
import { pool, rowToObraAgenda } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const [rows] = await pool.query(
      "SELECT * FROM obra_agenda WHERE obra_id = ? ORDER BY date ASC, id ASC",
      [obraId]
    );
    const list = rows.map(rowToObraAgenda);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras/[id]/agenda", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const body = await request.json();
    const id = body.id || generateId();
    const date = body.date ?? new Date().toISOString().split("T")[0];
    const activity = body.activity ?? "";
    const responsible = body.responsible ?? null;
    const notes = body.notes ?? null;

    await pool.query(
      `INSERT INTO obra_agenda (id, obra_id, date, activity, responsible, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, obraId, date, activity, responsible, notes]
    );

    const [rows] = await pool.query("SELECT * FROM obra_agenda WHERE id = ?", [id]);
    return NextResponse.json(rowToObraAgenda(rows[0]));
  } catch (err) {
    console.error("POST /api/obras/[id]/agenda", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
