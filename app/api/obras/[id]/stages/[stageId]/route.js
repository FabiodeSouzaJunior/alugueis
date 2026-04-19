import { NextResponse } from "next/server";
import { pool, rowToObraStage } from "@/lib/db";
import { createNotification } from "@/lib/notificationService";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _PUT(request, { params }) {
  try {
    const { id: obraId, stageId } = await resolveParams(params);
    const body = await request.json();
    const name = body.name ?? "";
    const status = body.status ?? "Pendente";
    const startDate = body.startDate || null;
    const dueDate = body.dueDate || null;
    const responsible = body.responsible ?? null;

    const [currentRows] = await pool.query("SELECT name, status FROM obra_stages WHERE id = ? AND obra_id = ?", [stageId, obraId]);
    const [result] = await pool.query(
      `UPDATE obra_stages SET name = ?, status = ?, start_date = ?, due_date = ?, responsible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND obra_id = ?`,
      [name, status, startDate, dueDate, responsible, stageId, obraId]
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const stageName = name || currentRows[0]?.name || "Etapa";
    if (String(status).toLowerCase() === "concluída" || status === "Concluida") {
      createNotification({
        type: "obra_stage_completed",
        title: "Etapa da obra concluída",
        message: `Etapa "${stageName}" foi concluída.`,
        relatedEntity: "obra",
        relatedId: obraId,
        linkHref: `/obras/${obraId}`,
      }).catch(() => {});
    }

    const [rows] = await pool.query("SELECT * FROM obra_stages WHERE id = ?", [stageId]);
    return NextResponse.json(rowToObraStage(rows[0]));
  } catch (err) {
    console.error("PUT /api/obras/[id]/stages/[stageId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const { id: obraId, stageId } = await resolveParams(params);
    const [result] = await pool.query("DELETE FROM obra_stages WHERE id = ? AND obra_id = ?", [stageId, obraId]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]/stages/[stageId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
