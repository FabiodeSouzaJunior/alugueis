import { NextResponse } from "next/server";
import { pool, rowToCondominiumExpense } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function resolveRouteParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

async function _GET(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const [rows] = await pool.query(
      "SELECT * FROM condominium_expenses WHERE id = ?",
      [id]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rowToCondominiumExpense(rows[0]));
  } catch (err) {
    console.error("GET /api/condominium/expenses/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await request.json();
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
        : 1;
    const startYear = Number.isFinite(parsedStartYear)
      ? parsedStartYear
      : new Date().getFullYear();

    const [result] = await pool.query(
      `UPDATE condominium_expenses
       SET name = ?, total_value = ?, expense_date = ?, number_of_units = ?, installments = ?, start_month = ?, start_year = ?
       WHERE id = ?`,
      [name, totalValue, expenseDate, numberOfUnits, installments, startMonth, startYear, id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [rows] = await pool.query(
      "SELECT * FROM condominium_expenses WHERE id = ?",
      [id]
    );
    return NextResponse.json(rowToCondominiumExpense(rows[0]));
  } catch (err) {
    console.error("PUT /api/condominium/expenses/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const [result] = await pool.query(
      "DELETE FROM condominium_expenses WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/condominium/expenses/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
