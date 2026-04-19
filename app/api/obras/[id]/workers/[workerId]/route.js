import { NextResponse } from "next/server";
import { pool, rowToObraWorker } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _PUT(request, { params }) {
  try {
    const { id: obraId, workerId } = await resolveParams(params);
    const body = await request.json();
    const name = body.name ?? "";
    const role = body.role ?? null;
    const dailyRate = Number(body.dailyRate) ?? 0;
    const daysWorked = Number(body.daysWorked) ?? 0;
    const totalPaid = dailyRate * daysWorked;
    const telefone = body.phone != null ? String(body.phone).trim() || null : null;
    const observacao = body.observacao != null ? String(body.observacao).trim() || null : null;

    const [result] = await pool.query(
      `UPDATE obra_workers SET name = ?, role = ?, daily_rate = ?, days_worked = ?, total_paid = ?, telefone = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND obra_id = ?`,
      [name, role, dailyRate, daysWorked, totalPaid, telefone, observacao, workerId, obraId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const description = role ? `${name} - ${role}` : name;
    const costDate = new Date().toISOString().split("T")[0];
    const [existing] = await pool.query(
      "SELECT id FROM obra_costs WHERE obra_id = ? AND reference_type = 'worker' AND reference_id = ?",
      [obraId, workerId]
    );
    if (existing.length > 0) {
      await pool.query(
        `UPDATE obra_costs SET description = ?, value = ?, date = ?, updated_at = CURRENT_TIMESTAMP WHERE obra_id = ? AND reference_type = 'worker' AND reference_id = ?`,
        [description, totalPaid, costDate, obraId, workerId]
      );
    } else {
      const costId = generateId();
      await pool.query(
        `INSERT INTO obra_costs (id, obra_id, date, category, description, value, responsible, notes, reference_type, reference_id)
         VALUES (?, ?, ?, 'Mão de obra', ?, ?, NULL, NULL, 'worker', ?)`,
        [costId, obraId, costDate, description, totalPaid, workerId]
      );
    }

    const [rows] = await pool.query("SELECT * FROM obra_workers WHERE id = ?", [workerId]);
    return NextResponse.json(rowToObraWorker(rows[0]));
  } catch (err) {
    console.error("PUT /api/obras/[id]/workers/[workerId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const { id: obraId, workerId } = await resolveParams(params);
    await pool.query(
      "DELETE FROM obra_costs WHERE obra_id = ? AND reference_type = 'worker' AND reference_id = ?",
      [obraId, workerId]
    );
    const [result] = await pool.query("DELETE FROM obra_workers WHERE id = ? AND obra_id = ?", [workerId, obraId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/obras/[id]/workers/[workerId]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
