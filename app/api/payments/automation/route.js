import { NextResponse } from "next/server";

import { syncRecurringPaymentsForFinancialTenants } from "@/server/modules/financial/payment-generation.service";
import { withAuth } from "@/lib/auth";

async function _POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId).trim() : null;
    const summary = await syncRecurringPaymentsForFinancialTenants({
      tenantId,
      organizationId: body?.organizationId ?? null,
    });

    if (tenantId && summary.tenantsProcessed === 0) {
      return NextResponse.json(
        { error: "Inquilino financeiro nao encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...summary,
    });
  } catch (err) {
    console.error("POST /api/payments/automation", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withAuth(_POST);
