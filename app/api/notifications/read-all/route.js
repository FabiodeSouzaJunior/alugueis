import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function _PATCH(request, context) {
  try {
    await pool.query("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/notifications/read-all", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PATCH = withAuth(_PATCH);
