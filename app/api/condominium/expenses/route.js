import { NextResponse } from "next/server";
import { pool, rowToCondominiumExpense } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    let rows;
    if (propertyId) {
      [rows] = await pool.query(
        "SELECT * FROM condominium_expenses WHERE property_id = ? ORDER BY start_year DESC, start_month DESC",
        [propertyId]
      );
    } else {
      [rows] = await pool.query(
        "SELECT * FROM condominium_expenses ORDER BY start_year DESC, start_month DESC"
      );
    }
    const list = (rows || []).map(rowToCondominiumExpense);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/condominium/expenses", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const name = body.name ?? "";
    const parsedTotalValue = Number(body.totalValue);
    const totalValue = Number.isFinite(parsedTotalValue) ? parsedTotalValue : 0;
    const expenseDate = body.expenseDate || null;
    const parsedUnits = Number(body.numberOfUnits);
    const parsedInstallments = Number(body.installments);
    const parsedStartMonth = Number(body.startMonth);
    const parsedStartYear = Number(body.startYear);
    const numberOfUnits = Number.isFinite(parsedUnits) && parsedUnits > 0 ? parsedUnits : 10;
    const installments = Number.isFinite(parsedInstallments) && parsedInstallments > 0 ? parsedInstallments : 1;
    const startMonth =
      Number.isFinite(parsedStartMonth) && parsedStartMonth >= 1 && parsedStartMonth <= 12
        ? parsedStartMonth
        : new Date().getMonth() + 1;
    const startYear = Number.isFinite(parsedStartYear)
      ? parsedStartYear
      : new Date().getFullYear();
    const propertyId = body.propertyId || null;

    await pool.query(
      `INSERT INTO condominium_expenses (id, name, total_value, expense_date, number_of_units, installments, start_month, start_year, property_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, totalValue, expenseDate, numberOfUnits, installments, startMonth, startYear, propertyId]
    );

    const [rows] = await pool.query(
      "SELECT * FROM condominium_expenses WHERE id = ?",
      [id]
    );
    return NextResponse.json(rowToCondominiumExpense(rows[0]));
  } catch (err) {
    console.error("POST /api/condominium/expenses", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
