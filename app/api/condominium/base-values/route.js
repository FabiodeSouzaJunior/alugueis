import { NextResponse } from "next/server";
import { pool, rowToCondominiumBaseValue } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { syncTenantPaymentsExpectedAmountsForProperty } from "@/server/modules/financial/tenant-billing.service";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    let rows;
    if (propertyId) {
      [rows] = await pool.query(
        "SELECT * FROM condominium_base_values WHERE property_id = ? ORDER BY start_date DESC",
        [propertyId]
      );
    } else {
      [rows] = await pool.query(
        "SELECT * FROM condominium_base_values ORDER BY start_date DESC"
      );
    }
    const list = (rows || []).map(rowToCondominiumBaseValue);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/condominium/base-values", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const parsedValue = Number(body.value);
    const value = Number.isFinite(parsedValue) ? parsedValue : 0;
    const startDate = body.startDate || new Date().toISOString().split("T")[0];
    const propertyId =
      body.propertyId != null && String(body.propertyId).trim() !== ""
        ? String(body.propertyId).trim()
        : null;

    if (!propertyId) {
      return NextResponse.json(
        { error: "Selecione um imovel antes de adicionar o valor base do condominio." },
        { status: 400 }
      );
    }

    if (value < 0) {
      return NextResponse.json(
        { error: "O valor base do condominio nao pode ser negativo." },
        { status: 400 }
      );
    }

    await pool.query(
      `INSERT INTO condominium_base_values (id, value, start_date, property_id)
       VALUES (?, ?, ?, ?)`,
      [id, value, startDate, propertyId]
    );

    await syncTenantPaymentsExpectedAmountsForProperty(propertyId);

    const [rows] = await pool.query(
      "SELECT * FROM condominium_base_values WHERE id = ?",
      [id]
    );
    return NextResponse.json(rowToCondominiumBaseValue(rows[0]));
  } catch (err) {
    console.error("POST /api/condominium/base-values", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
