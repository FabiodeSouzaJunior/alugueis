import { NextResponse } from "next/server";
import { pool, rowToExpense } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { createNotification } from "@/lib/notificationService";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const [rows] = await pool.query(
      "SELECT id, type, value, date, description, created_at, updated_at FROM expenses ORDER BY date DESC"
    );
    const list = rows.map(rowToExpense);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/expenses", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const type = body.type ?? "Outros";
    const valueNum = Number(body.value);
    const value = Number.isFinite(valueNum) ? valueNum : NaN;
    const date = body.date ?? new Date().toISOString().split("T")[0];
    const description = body.description ?? null;
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: "Valor da despesa invalido." }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO expenses (id, type, value, date, description)
       VALUES (?, ?, ?, ?, ?)`,
      [id, type, value, date, description]
    );
    createNotification({
      type: "expense_added",
      title: "Nova despesa registrada",
      message: `${type} — R$ ${Number(value).toFixed(2).replace(".", ",")}`,
      relatedEntity: "expense",
      relatedId: id,
      linkHref: "/despesas",
    }).catch(() => {});

    const [rows] = await pool.query("SELECT * FROM expenses WHERE id = ?", [id]);
    return NextResponse.json(rowToExpense(rows[0]));
  } catch (err) {
    console.error("POST /api/expenses", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
