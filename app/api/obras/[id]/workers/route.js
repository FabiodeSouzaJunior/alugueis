import { NextResponse } from "next/server";
import { pool, rowToObraWorker } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function resolveParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const [rows] = await pool.query(
      "SELECT * FROM obra_workers WHERE obra_id = ? ORDER BY name",
      [obraId]
    );
    const list = rows.map(rowToObraWorker);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/obras/[id]/workers", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const { id: obraId } = await resolveParams(params);
    const body = await request.json();
    const id = body.id || generateId();
    const name = body.name ?? "";
    const role = body.role ?? null;
    const dailyRate = Number(body.dailyRate) ?? 0;
    const daysWorked = Number(body.daysWorked) ?? 0;
    const totalPaid = dailyRate * daysWorked;
    const telefone = body.phone != null ? String(body.phone).trim() || null : null;
    const observacao = body.observacao != null ? String(body.observacao).trim() || null : null;

    await pool.query(
      `INSERT INTO obra_workers (id, obra_id, name, role, daily_rate, days_worked, total_paid, telefone, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, obraId, name, role, dailyRate, daysWorked, totalPaid, telefone, observacao]
    );

    const costId = generateId();
    const description = role ? `${name} - ${role}` : name;
    const costDate = new Date().toISOString().split("T")[0];
    await pool.query(
      `INSERT INTO obra_costs (id, obra_id, date, category, description, value, responsible, notes, reference_type, reference_id)
       VALUES (?, ?, ?, 'Mão de obra', ?, ?, NULL, NULL, 'worker', ?)`,
      [costId, obraId, costDate, description, totalPaid, id]
    );

    const [rows] = await pool.query("SELECT * FROM obra_workers WHERE id = ?", [id]);
    return NextResponse.json(rowToObraWorker(rows[0]));
  } catch (err) {
    console.error("POST /api/obras/[id]/workers", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
