import { NextResponse } from "next/server";
import { pool, rowToCondominiumSettings } from "@/lib/db";
import { withAuth } from "@/lib/auth";
async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const settingsId = propertyId || "default";
    const [rows] = await pool.query(
      "SELECT * FROM condominium_settings WHERE id = ?",
      [settingsId]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({
        id: settingsId,
        chargeWithRent: true,
        updatedAt: null,
      });
    }
    return NextResponse.json(rowToCondominiumSettings(rows[0]));
  } catch (err) {
    console.error("GET /api/condominium/settings", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, context) {
  try {
    const body = await request.json();
    const chargeWithRent = body.chargeWithRent !== false;
    const propertyId = body.propertyId || null;
    const settingsId = propertyId || "default";

    const [rows] = await pool.query(
      "SELECT id FROM condominium_settings WHERE id = ?",
      [settingsId]
    );
    if (!rows || rows.length === 0) {
      await pool.query(
        `INSERT INTO condominium_settings (id, charge_with_rent, property_id) VALUES (?, ?, ?)`,
        [settingsId, chargeWithRent, propertyId]
      );
    } else {
      await pool.query(
        `UPDATE condominium_settings SET charge_with_rent = ? WHERE id = ?`,
        [chargeWithRent, settingsId]
      );
    }

    const [out] = await pool.query(
      "SELECT * FROM condominium_settings WHERE id = ?",
      [settingsId]
    );
    return NextResponse.json(rowToCondominiumSettings(out[0]));
  } catch (err) {
    console.error("PUT /api/condominium/settings", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
