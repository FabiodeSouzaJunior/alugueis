import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _DELETE(request, { params }) {
  try {
    const { id: obraId, linkId } = await resolveParams(params);
    const [result] = await pool.query(
      "DELETE FROM obra_stage_workers WHERE id = ? AND obra_id = ?",
      [linkId, obraId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]/stage-workers/[linkId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const DELETE = withAuth(_DELETE);
