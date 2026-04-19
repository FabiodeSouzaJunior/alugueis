import { NextResponse } from "next/server";
import { pool, rowToObraStageWorker } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const [rows] = await pool.query(
      "SELECT * FROM obra_stage_workers WHERE obra_id = ? ORDER BY stage_id, worker_id",
      [obraId]
    );
    const list = rows.map(rowToObraStageWorker);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras/[id]/stage-workers", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const body = await request.json();
    const stageId = body.stageId ?? null;
    const workerId = body.workerId ?? null;
    if (!stageId || !workerId) {
      return NextResponse.json({ error: "stageId e workerId são obrigatórios." }, { status: 400 });
    }

    const [stageRows] = await pool.query(
      "SELECT id FROM obra_stages WHERE id = ? AND obra_id = ?",
      [stageId, obraId]
    );
    const [workerRows] = await pool.query(
      "SELECT id FROM obra_workers WHERE id = ? AND obra_id = ?",
      [workerId, obraId]
    );
    if (!stageRows?.length || !workerRows?.length) {
      return NextResponse.json({ error: "Etapa ou trabalhador não encontrado nesta obra." }, { status: 404 });
    }

    const [existing] = await pool.query(
      "SELECT id FROM obra_stage_workers WHERE stage_id = ? AND worker_id = ?",
      [stageId, workerId]
    );
    if (existing?.length > 0) {
      return NextResponse.json({ error: "Este trabalhador já está vinculado à etapa." }, { status: 409 });
    }

    const id = body.id || generateId();
    await pool.query(
      `INSERT INTO obra_stage_workers (id, obra_id, stage_id, worker_id)
       VALUES (?, ?, ?, ?)`,
      [id, obraId, stageId, workerId]
    );

    const [rows] = await pool.query("SELECT * FROM obra_stage_workers WHERE id = ?", [id]);
    return NextResponse.json(rowToObraStageWorker(rows[0]));
  } catch (err) {
    console.error("POST /api/obras/[id]/stage-workers", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
