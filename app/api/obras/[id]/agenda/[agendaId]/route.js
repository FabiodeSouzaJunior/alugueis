import { NextResponse } from "next/server";
import { pool, rowToObraAgenda } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _PUT(request, { params }) {
  try {
    const { id: obraId, agendaId } = await resolveParams(params);
    const body = await request.json();
    const date = body.date ?? null;
    const activity = body.activity ?? "";
    const responsible = body.responsible ?? null;
    const notes = body.notes ?? null;

    const [result] = await pool.query(
      `UPDATE obra_agenda SET date = ?, activity = ?, responsible = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND obra_id = ?`,
      [date, activity, responsible, notes, agendaId, obraId]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [rows] = await pool.query("SELECT * FROM obra_agenda WHERE id = ?", [agendaId]);
    return NextResponse.json(rowToObraAgenda(rows[0]));
  } catch (err) {
    console.error("PUT /api/obras/[id]/agenda/[agendaId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const { id: obraId, agendaId } = await resolveParams(params);
    const [result] = await pool.query("DELETE FROM obra_agenda WHERE id = ? AND obra_id = ?", [agendaId, obraId]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]/agenda/[agendaId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
