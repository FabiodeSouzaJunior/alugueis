import { NextResponse } from "next/server";
import { pool, rowToNotification } from "@/lib/db";
import { withAuth } from "@/lib/auth";

async function _PATCH(request, { params }) {
  try {
    const id = params.id;
    const body = await request.json().catch(() => ({}));
    if (body.read !== true && body.read !== "true") {
      return NextResponse.json({ error: "read deve ser true" }, { status: 400 });
    }
    const [result] = await pool.query(
      "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND read_at IS NULL",
      [id]
    );
    if (result.affectedRows === 0) {
      const [rows] = await pool.query("SELECT * FROM notifications WHERE id = ?", [id]);
      return NextResponse.json(rowToNotification(rows[0]) || { id });
    }
    const [rows] = await pool.query("SELECT * FROM notifications WHERE id = ?", [id]);
    return NextResponse.json(rowToNotification(rows[0]));
  } catch (err) {
    console.error("PATCH /api/notifications/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const PATCH = withAuth(_PATCH);
