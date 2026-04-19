import { NextResponse } from "next/server";
import { pool, rowToExpense } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function _GET(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const id = resolvedParams?.id;
    const [rows] = await pool.query("SELECT * FROM expenses WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToExpense(rows[0]));
  } catch (err) {
    console.error("GET /api/expenses/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const id = resolvedParams?.id;
    const body = await request.json();
    const type = body.type ?? "Outros";
    const valueNum = Number(body.value);
    const value = Number.isFinite(valueNum) ? valueNum : NaN;
    const date = body.date ?? new Date().toISOString().split("T")[0];
    const description = body.description ?? null;
    if (!id) return NextResponse.json({ error: "ID da despesa nao informado." }, { status: 400 });
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "Valor da despesa invalido." }, { status: 400 });
    }

    await pool.query(
      `UPDATE expenses SET type = ?, value = ?, date = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [type, value, date, description, id]
    );

    const [rows] = await pool.query("SELECT * FROM expenses WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToExpense(rows[0]));
  } catch (err) {
    console.error("PUT /api/expenses/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const resolvedParams = typeof params?.then === "function" ? await params : params;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: "ID da despesa nao informado." }, { status: 400 });
    const [result] = await pool.query("DELETE FROM expenses WHERE id = ?", [id]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/expenses/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
