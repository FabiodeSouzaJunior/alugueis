import { NextResponse } from "next/server";
import { pool, rowToWaterEnergyConsumption } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { generateId } from "@/lib/generateId";
import {
  detectPaymentsHasOrganizationId,
  resolveOrganizationIdForPayment,
} from "@/lib/organizationScope";
import { getPaymentExpectedAmountForPeriod } from "@/server/modules/financial/tenant-billing.service";
import { getDueDateForPeriod } from "@/lib/payment-dates";
import {
  getBillingTimeZone,
  getPeriodRelationToCurrent,
} from "@/server/modules/financial/payment-automation.core";

async function resolveRouteParams(params) {
  return typeof params?.then === "function" ? await params : params;
}

function canUpdateHistoricalExpectedAmount(month, year) {
  return (
    getPeriodRelationToCurrent({
      month,
      year,
      referenceDate: new Date(),
      timeZone: getBillingTimeZone(),
    }) !== "past"
  );
}

async function _GET(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    const [rows] = await pool.query("SELECT * FROM water_energy_consumption WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToWaterEnergyConsumption(rows[0]));
  } catch (err) {
    console.error("GET /api/water-energy/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function upsertExpectedAmountForPayment(tenantId, month, year) {
  if (!canUpdateHistoricalExpectedAmount(month, year)) return;
  const expectedAmount = await getPaymentExpectedAmountForPeriod({ tenantId, month, year });
  const [existing] = await pool.query(
    "SELECT id, amount FROM payments WHERE tenant_id = ? AND month = ? AND year = ?",
    [tenantId, month, year]
  );

  if (existing?.length > 0) {
    const payment = existing[0];
    const paidAmount = Number(payment.amount) || 0;
    const status = paidAmount >= expectedAmount ? "pago" : "pendente";
    await pool.query(
      `UPDATE payments SET expected_amount = ?, status = ? WHERE id = ?`,
      [expectedAmount, status, payment.id]
    );
    return;
  }

  const paymentId = generateId();
  const [tenantRows] = await pool.query(
    "SELECT payment_day FROM tenants WHERE id = ?",
    [tenantId]
  );
  const dueDate = getDueDateForPeriod(
    month,
    year,
    tenantRows?.[0]?.payment_day
  );
  const columnSupport = await detectPaymentsHasOrganizationId();

  if (columnSupport.hasOrganizationId) {
    const organizationId = await resolveOrganizationIdForPayment(pool, { tenantId });
    await pool.query(
      `INSERT INTO payments (id, tenant_id, month, year, due_date, amount, expected_amount, status, organization_id)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'pendente', ?)`,
      [paymentId, tenantId, month, year, dueDate, expectedAmount, organizationId]
    );
  } else {
    await pool.query(
      `INSERT INTO payments (id, tenant_id, month, year, due_date, amount, expected_amount, status)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'pendente')`,
      [paymentId, tenantId, month, year, dueDate, expectedAmount]
    );
  }
}

async function _PUT(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    const body = await request.json();
    const waterUsage = Number(body.waterUsage) ?? 0;
    const electricityUsage = Number(body.electricityUsage) ?? 0;
    const addToRent = body.addToRent === true;
    const notes = body.notes ?? null;

    const [prev] = await pool.query("SELECT * FROM water_energy_consumption WHERE id = ?", [id]);
    if (prev.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const prevRecord = prev[0];
    const prevAddToRent = prevRecord.add_to_rent === 1 || prevRecord.add_to_rent === true;

    await pool.query(
      `UPDATE water_energy_consumption
       SET water_usage = ?, electricity_usage = ?, add_to_rent = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [waterUsage, electricityUsage, addToRent, notes, id]
    );

    const tenantId = prevRecord.tenant_id;
    const month = prevRecord.month;
    const year = prevRecord.year;

    if (addToRent || prevAddToRent) {
      await upsertExpectedAmountForPayment(tenantId, month, year);
    }

    const [rows] = await pool.query("SELECT * FROM water_energy_consumption WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rowToWaterEnergyConsumption(rows[0]));
  } catch (err) {
    console.error("PUT /api/water-energy/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const resolvedParams = await resolveRouteParams(params);
    const id = resolvedParams?.id;
    const [currentRows] = await pool.query(
      "SELECT tenant_id, month, year, add_to_rent FROM water_energy_consumption WHERE id = ?",
      [id]
    );
    const current = currentRows?.[0] || null;
    const [result] = await pool.query("DELETE FROM water_energy_consumption WHERE id = ?", [id]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const addToRent =
      current?.add_to_rent === true ||
      current?.add_to_rent === 1 ||
      current?.add_to_rent === "1" ||
      current?.add_to_rent === "true";
    if (current?.tenant_id && current?.month && current?.year && addToRent) {
      await upsertExpectedAmountForPayment(current.tenant_id, current.month, current.year);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/water-energy/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
