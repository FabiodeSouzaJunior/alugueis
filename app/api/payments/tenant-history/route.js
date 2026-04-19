import { NextResponse } from "next/server";

import {
  assertFinancialTenantById,
  listFinancialPayments,
} from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";

async function _GET(request, context) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const openOnly = searchParams.get("openOnly") === "true";

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId e obrigatorio." },
        { status: 400 }
      );
    }

    await assertFinancialTenantById(tenantId, { status: 404, message: "Inquilino financeiro nao encontrado." });
    const payments = await listFinancialPayments({ tenantId, openOnly });
    return NextResponse.json(payments);
  } catch (err) {
    console.error("GET /api/payments/tenant-history", err);
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export const GET = withAuth(_GET);
