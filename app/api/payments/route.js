import { NextResponse } from "next/server";
import { pool, rowToPayment } from "@/lib/db";
import { generateId } from "@/lib/generateId";
import { createNotification } from "@/lib/notificationService";
import {
  assertFinancialTenantById,
  listFinancialPayments,
} from "@/server/modules/financial/payment-responsibility.service";
import {
  getPaymentExpectedAmountForPeriod,
  resolveTenantPaymentOrganizationId,
} from "@/server/modules/financial/tenant-billing.service";
import { withAuth } from "@/lib/auth";
import { getDueDateForPeriod } from "@/lib/payment-dates";
import {
  resolveCalculatedPaymentStatus,
  resolveStoredPaymentDate,
} from "@/server/modules/financial/payment-automation.core";

function isUniquePaymentConstraintError(error) {
  const message = String(error?.message || "");
  return error?.code === "23505" || /unique_payment|duplicate key/i.test(message);
}

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
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function findPaymentByTenantPeriod(tenantId, month, year) {
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE tenant_id = ? AND month = ? AND year = ?",
    [tenantId, month, year]
  );
  return rows?.[0] || null;
}

async function updatePaymentRecord(paymentId, { dueDate, paymentDate, amount, expectedAmount, status }) {
  await pool.query(
    `UPDATE payments
        SET due_date = ?,
            payment_date = ?,
            amount = ?,
            expected_amount = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [dueDate, paymentDate, amount, expectedAmount, status, paymentId]
  );

  const [rows] = await pool.query("SELECT * FROM payments WHERE id = ?", [paymentId]);
  return rowToPayment(rows?.[0] || null);
}

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const tenantId = searchParams.get("tenantId");
    const openOnly = searchParams.get("openOnly") === "true";

    const payments = await listFinancialPayments({ month, year, tenantId, openOnly });
    return NextResponse.json(payments);
  } catch (err) {
    console.error("GET /api/payments", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(request, context) {
  try {
    const body = await request.json();
    const id = body.id || generateId();
    const tenantId = body.tenantId != null && body.tenantId !== "" ? String(body.tenantId).trim() : null;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Informe o inquilino para registrar o pagamento." },
        { status: 400 }
      );
    }
    const tenant = await assertFinancialTenantById(tenantId);
    const parsedMonth = Number(body.month);
    const parsedYear = Number(body.year);
    const month = Number.isFinite(parsedMonth) ? parsedMonth : 1;
    const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
    const dueDate =
      body.dueDate ||
      getDueDateForPeriod(month, year, tenant?.paymentDay ?? tenant?.payment_day);
    const statusFromBody = (body.status || "").toString().toLowerCase();
    const parsedAmount = Number(body.amount);
    let amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const existingPayment = await findPaymentByTenantPeriod(tenantId, month, year);
    let expectedAmount = normalizeExpectedAmount(existingPayment?.expected_amount);
    if (expectedAmount == null) {
      expectedAmount = await getPaymentExpectedAmountForPeriod({
        tenantId,
        month,
        year,
        tenantRow: {
          id: tenant?.id,
          rent_value: tenant?.rentValue,
          property_id: tenant?.propertyId,
        },
      });
    }
    
    // Validação: não permitir valor pago maior que o valor devido
    if (expectedAmount > 0 && amount > expectedAmount) {
      return NextResponse.json(
        { error: `Valor pago não pode ser maior que o valor devido (R$ ${expectedAmount.toFixed(2).replace(".", ",")})` },
        { status: 400 }
      );
    }
    
    const status = resolvePaymentStatus({
      statusFromBody,
      paymentDate: null,
      dueDate,
      amount,
      expectedAmount,
    });
    const paymentDate = resolveStoredPaymentDate({ status, dueDate });

    const organizationId = await resolveTenantPaymentOrganizationId({
      tenantId,
      organizationId: body.organizationId,
    });

    let payment = null;

    if (existingPayment?.id) {
      payment = await updatePaymentRecord(existingPayment.id, {
        dueDate,
        paymentDate,
        amount,
        expectedAmount,
        status,
      });
    } else {
      const columns = [
        "id",
        "tenant_id",
        "month",
        "year",
        "due_date",
        "payment_date",
        "amount",
        "expected_amount",
        "status",
      ];
      const values = [id, tenantId, month, year, dueDate, paymentDate, amount, expectedAmount, status];
      if (organizationId) {
        columns.push("organization_id");
        values.push(organizationId);
      }

      const placeholders = columns.map(() => "?").join(", ");
      try {
        await pool.query(
          `INSERT INTO payments (${columns.join(", ")}) VALUES (${placeholders})`,
          values
        );
      } catch (error) {
        if (!isUniquePaymentConstraintError(error)) {
          throw error;
        }

        const conflictedPayment = await findPaymentByTenantPeriod(tenantId, month, year);
        if (!conflictedPayment?.id) throw error;
        const conflictedExpectedAmount =
          normalizeExpectedAmount(conflictedPayment.expected_amount) ?? expectedAmount;
        if (conflictedExpectedAmount > 0 && amount > conflictedExpectedAmount) {
          return NextResponse.json(
            {
              error: `Valor pago não pode ser maior que o valor devido (R$ ${conflictedExpectedAmount
                .toFixed(2)
                .replace(".", ",")})`,
            },
            { status: 400 }
          );
        }
        const conflictedStatus = resolvePaymentStatus({
          statusFromBody,
          paymentDate: null,
          dueDate,
          amount,
          expectedAmount: conflictedExpectedAmount,
        });
        const conflictedPaymentDate = resolveStoredPaymentDate({
          status: conflictedStatus,
          dueDate,
        });

        payment = await updatePaymentRecord(conflictedPayment.id, {
          dueDate,
          paymentDate: conflictedPaymentDate,
          amount,
          expectedAmount: conflictedExpectedAmount,
          status: conflictedStatus,
        });
      }

      if (!payment) {
        const [rows] = await pool.query("SELECT * FROM payments WHERE id = ?", [id]);
        payment = rowToPayment(rows[0]);
      }
    }
    if (paymentDate && amount >= (expectedAmount || 0) && tenantId) {
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
    return NextResponse.json(payment);
  } catch (err) {
    console.error("POST /api/payments", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
