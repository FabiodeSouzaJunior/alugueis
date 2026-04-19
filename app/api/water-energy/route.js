import { NextResponse } from "next/server";
import { pool, rowToWaterEnergyConsumption } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { withAuth } from "@/lib/auth";
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

async function addConsumptionToPayment(tenantId, month, year, waterUsage, electricityUsage) {
  if (!canUpdateHistoricalExpectedAmount(month, year)) return;
  const newExpected = await getPaymentExpectedAmountForPeriod({ tenantId, month, year });

  const [existing] = await pool.query(
    "SELECT id, amount FROM payments WHERE tenant_id = ? AND month = ? AND year = ?",
    [tenantId, month, year]
  );

  if (existing?.length > 0) {
    const payment = existing[0];
    const paidAmount = Number(payment.amount) || 0;
    const status = paidAmount >= newExpected ? "pago" : "pendente";
    await pool.query(
      `UPDATE payments SET expected_amount = ?, status = ? WHERE id = ?`,
      [newExpected, status, payment.id]
    );
  } else {
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
        [paymentId, tenantId, month, year, dueDate, newExpected, organizationId]
      );
    } else {
      await pool.query(
        `INSERT INTO payments (id, tenant_id, month, year, due_date, amount, expected_amount, status)
         VALUES (?, ?, ?, ?, ?, 0, ?, 'pendente')`,
        [paymentId, tenantId, month, year, dueDate, newExpected]
      );
    }
  }
}

async function removeConsumptionFromPayment(tenantId, month, year) {
  if (!canUpdateHistoricalExpectedAmount(month, year)) return;
  const baseExpected = await getPaymentExpectedAmountForPeriod({ tenantId, month, year });

  const [existing] = await pool.query(
    "SELECT id, amount FROM payments WHERE tenant_id = ? AND month = ? AND year = ?",
    [tenantId, month, year]
  );

  if (existing?.length > 0) {
    const payment = existing[0];
    const paidAmount = Number(payment.amount) || 0;
    const status = paidAmount >= baseExpected ? "pago" : "pendente";
    await pool.query(
      `UPDATE payments SET expected_amount = ?, status = ? WHERE id = ?`,
      [baseExpected, status, payment.id]
    );
  }
}

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const conditions = [];
    const params = [];
    if (month != null && month !== "") {
      conditions.push("month = ?");
      params.push(Number(month));
    }
    if (year != null && year !== "") {
      conditions.push("year = ?");
      params.push(Number(year));
    }

    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const [rows] = await pool.query(
      `SELECT id, tenant_id, month, year, water_usage, electricity_usage, add_to_rent, notes, created_at, updated_at
       FROM water_energy_consumption${where}
       ORDER BY year DESC, month DESC`,
      params
    );
    const list = (rows || []).map(rowToWaterEnergyConsumption);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/water-energy", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId ?? null;
    const month = body.month != null ? Number(body.month) : null;
    const year = body.year != null ? Number(body.year) : null;
    const waterUsage = Number(body.waterUsage) ?? 0;
    const electricityUsage = Number(body.electricityUsage) ?? 0;
    const addToRent = body.addToRent === true;
    const notes = body.notes ?? null;

    if (!tenantId || month == null || year == null) {
      return NextResponse.json(
        { error: "tenantId, month and year are required" },
        { status: 400 }
      );
    }

    const id = generateId();
    await pool.query(
      `INSERT INTO water_energy_consumption (id, tenant_id, month, year, water_usage, electricity_usage, add_to_rent, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         water_usage = VALUES(water_usage),
         electricity_usage = VALUES(electricity_usage),
         add_to_rent = VALUES(add_to_rent),
         notes = VALUES(notes),
         updated_at = CURRENT_TIMESTAMP`,
      [id, tenantId, month, year, waterUsage, electricityUsage, addToRent, notes]
    );

    if (addToRent) {
      await addConsumptionToPayment(tenantId, month, year, waterUsage, electricityUsage);
    }

    const [rows] = await pool.query(
      "SELECT * FROM water_energy_consumption WHERE tenant_id = ? AND month = ? AND year = ?",
      [tenantId, month, year]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    return NextResponse.json(rowToWaterEnergyConsumption(rows[0]));
  } catch (err) {
    console.error("POST /api/water-energy", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
