import { NextResponse } from "next/server";
import { pool, rowToPayment } from "@/lib/db";
import { createNotification } from "@/lib/notificationService";
import {
  assertFinancialTenantById,
  getFinancialPaymentById,
} from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";
import {
  resolveCalculatedPaymentStatus,
  resolveStoredPaymentDate,
} from "@/server/modules/financial/payment-automation.core";

function resolvePaymentStatus({ statusFromBody, paymentDate, dueDate, amount, expectedAmount }) {
  const normalizedStatus = (statusFromBody || "").toString().toLowerCase();
  const computedStatus = resolveCalculatedPaymentStatus({
    paymentDate,
    dueDate,
    amount,
    expectedAmount,
  });

  if (computedStatus !== "pendente") return computedStatus;
  return normalizedStatus || computedStatus;
}

function normalizeExpectedAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function _GET(request, { params }) {
  try {
    const resolvedParams = typeof params.then === "function" ? await params : params;
    const id = resolvedParams.id;
    const payment = await getFinancialPaymentById(id);
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(payment);
  } catch (err) {
    console.error("GET /api/payments/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PUT(request, context) {
  try {
    const params = context.params && typeof context.params.then === "function" ? await context.params : context.params || {};
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "ID do pagamento não informado." }, { status: 400 });
    }
    const body = await request.json();
    const dueDate = body.dueDate && String(body.dueDate).trim() ? body.dueDate : null;
    const amountRaw = body.amount;
    const amountParsed = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
    let amount = amountRaw != null && !isNaN(amountParsed) ? amountParsed : undefined;
    const [currentRows] = await pool.query("SELECT * FROM payments WHERE id = ?", [id]);
    if (currentRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = currentRows[0];
    const tenant = await assertFinancialTenantById(row.tenant_id, {
      status: 404,
      message: "Not found",
    });
    const currentAmount = Number(row.amount) || 0;
    if (amount === undefined) amount = currentAmount;
    const newExpectedAmount = normalizeExpectedAmount(row.expected_amount);
    if (newExpectedAmount != null && amount > newExpectedAmount) amount = newExpectedAmount;
    const statusFromBody = (body.status || "").toString().toLowerCase();
    const status = resolvePaymentStatus({
      statusFromBody,
      paymentDate: null,
      dueDate,
      amount,
      expectedAmount: newExpectedAmount,
    });
    const paymentDate = resolveStoredPaymentDate({ status, dueDate });

    await pool.query(
      `UPDATE payments
          SET due_date = ?,
              payment_date = ?,
              amount = ?,
              expected_amount = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [dueDate, paymentDate, amount, newExpectedAmount, status, id]
    );

    const [rows] = await pool.query("SELECT * FROM payments WHERE id = ?", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = rowToPayment(rows[0]);
    if (paymentDate && amount >= (newExpectedAmount || 0) && row.tenant_id) {
      const tenantName = tenant?.name || "Inquilino";
      const kitnet = tenant?.kitnetNumber ? `Kitnet ${tenant.kitnetNumber}` : "";
      createNotification({
        type: amount >= 2000 ? "payment_high_value" : "payment_received",
        title: "Pagamento recebido",
        message: `${tenantName} — ${kitnet} — R$ ${Number(amount).toFixed(2).replace(".", ",")}`,
        relatedEntity: "payment",
        relatedId: id,
        linkHref: "/pagamentos",
      }).catch(() => {});
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/payments/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const resolvedParams = typeof params.then === "function" ? await params : params;
    const id = resolvedParams.id;
    const payment = await getFinancialPaymentById(id);
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [result] = await pool.query("DELETE FROM payments WHERE id = ?", [id]);
    if (result.affectedRows === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/payments/[id]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PUT = withAuth(_PUT);
export const DELETE = withAuth(_DELETE);
