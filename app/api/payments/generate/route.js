import { NextResponse } from "next/server";
import {
  assertFinancialTenantById,
  listFinancialPayments,
} from "@/server/modules/financial/payment-responsibility.service";
import { ensurePaidPaymentsUntilCurrentMonth } from "@/server/modules/financial/payment-generation.service";
import { withAuth } from "@/lib/auth";

async function _POST(request, context) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId;
    const tenant = await assertFinancialTenantById(tenantId);
    const startDate = body.startDate;

    if (!tenantId || !startDate) {
      return NextResponse.json(
        { error: "tenantId e startDate sao obrigatorios" },
        { status: 400 }
      );
    }

    await ensurePaidPaymentsUntilCurrentMonth({
      tenantId,
      startDate,
      organizationId: body.organizationId ?? null,
    });

    return NextResponse.json(await listFinancialPayments({ tenantId }));
  } catch (err) {
    console.error("POST /api/payments/generate", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withAuth(_POST);
