import { NextResponse } from "next/server";
import { pool, rowToMaintenance } from "@/lib/db";
import { withAuth } from "@/lib/auth";

const ALLOWED_PRIORITIES = new Set(["alta", "media", "baixa"]);
const ALLOWED_STATUS = new Set(["pendente", "em_andamento", "concluido"]);

async function _GET(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: "ID da manutencao nao informado." }, { status: 400 });
    const [rows] = await pool.query("SELECT * FROM maintenance WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToMaintenance(rows[0]));
  } catch (err) {
    console.error("GET /api/maintenance/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: "ID da manutencao nao informado." }, { status: 400 });
    const body = await request.json();
    const type = body.type ?? "";
    const location = body.location ?? null;
    const description = body.description ?? null;
    const rawPriority = String(body.priority ?? "").trim().toLowerCase();
    const priority = ALLOWED_PRIORITIES.has(rawPriority) ? rawPriority : "media";
    const rawStatus = String(body.status ?? "").trim().toLowerCase();
    const status = ALLOWED_STATUS.has(rawStatus) ? rawStatus : "pendente";
    const spentNum = Number(body.spentValue);
    const spentValue = Number.isFinite(spentNum) ? spentNum : NaN;
    if (!Number.isFinite(spentValue) || spentValue < 0) {
      return NextResponse.json({ error: "Valor gasto invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE maintenance SET type = ?, location = ?, description = ?, priority = ?, status = ?, spent_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [type, location, description, priority, status, spentValue, id]
    );

    const [rows] = await pool.query("SELECT * FROM maintenance WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToMaintenance(rows[0]));
  } catch (err) {
    console.error("PUT /api/maintenance/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: "ID da manutencao nao informado." }, { status: 400 });
    const [result] = await pool.query("DELETE FROM maintenance WHERE id = ?", [id]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/maintenance/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
