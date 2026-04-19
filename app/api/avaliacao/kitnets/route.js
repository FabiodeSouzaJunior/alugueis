import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

const TOTAL_KITNETS = 12;

export async function GET() {
  try {
    const [rows] = await pool.query(
      "SELECT DISTINCT kitnet_number FROM tenants WHERE status = 'ativo' AND kitnet_number IS NOT NULL AND kitnet_number != '' ORDER BY kitnet_number"
    );
    const fromTenants = (rows || []).map((r) => r.kitnet_number);
    const all = Array.from({ length: TOTAL_KITNETS }, (_, i) => String(i + 1));
    const combined = [...new Set([...fromTenants, ...all])].sort(
      (a, b) => Number(a) - Number(b)
    );
    return NextResponse.json(combined);
  } catch (err) {
    console.error("GET /api/avaliacao/kitnets", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
