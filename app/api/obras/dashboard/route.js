import { NextResponse } from "next/server";
import { pool, rowToObra, rowToObraCost, rowToObraWorker } from "@/lib/db";
import { withAuth } from "@/lib/auth";

/**
 * GET /api/obras/dashboard
 * Retorna dados agregados de todas as obras para o dashboard da listagem.
 */
async function _GET(request, context) {
  try {
    const [obrasRows] = await pool.query(
      "SELECT id, name, budget, start_date, end_date, area_m2, status, created_at, updated_at FROM obras ORDER BY created_at DESC"
    );
    const [costsRows] = await pool.query(
      "SELECT * FROM obra_costs ORDER BY date DESC"
    );
    const [workersRows] = await pool.query(
      "SELECT * FROM obra_workers ORDER BY name"
    );

    const obras = (obrasRows || []).map(rowToObra);
    const costs = (costsRows || []).map(rowToObraCost);
    const workers = (workersRows || []).map(rowToObraWorker);

    return NextResponse.json({ obras, costs, workers });
  } catch (err) {
    console.error("GET /api/obras/dashboard", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
