import { NextResponse } from "next/server";
import { pool, rowToResidentEvaluation } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const kitnetNumber = searchParams.get("kitnetNumber");
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 500, 1), 1000);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    let sql = "SELECT * FROM resident_evaluations WHERE 1=1";
    const values = [];
    if (kitnetNumber != null && kitnetNumber !== "") {
      sql += " AND kitnet_number = ?";
      values.push(kitnetNumber);
    }
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    values.push(limit, offset);

    const [rows] = await pool.query(sql, values);
    const list = (rows || []).map(rowToResidentEvaluation);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/resident-evaluations", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
