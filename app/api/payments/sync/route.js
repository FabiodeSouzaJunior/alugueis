import { NextResponse } from "next/server";

import { ensurePaidPaymentsUntilCurrentMonth } from "@/server/modules/financial/payment-generation.service";
import { listFinancialTenants } from "@/server/modules/financial/payment-responsibility.service";
import { withAuth } from "@/lib/auth";

async function _POST(request, context) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId).trim() : null;
    const tenants = await listFinancialTenants(tenantId ? {} : { status: "ativo" });
    const targetTenants = tenantId
      ? tenants.filter((tenant) => String(tenant.id) === tenantId)
      : tenants.filter((tenant) => tenant.status === "ativo");

    if (tenantId && targetTenants.length === 0) {
      return NextResponse.json({ error: "Inquilino financeiro nao encontrado." }, { status: 404 });
    }

    let syncedPayments = 0;
    for (const tenant of targetTenants) {
      if (!tenant?.startDate) continue;
      const created = await ensurePaidPaymentsUntilCurrentMonth({
        tenantId: tenant.id,
        startDate: tenant.startDate,
        organizationId: body?.organizationId ?? null,
      });
      syncedPayments += created.length;
    }

    return NextResponse.json({
      ok: true,
      tenantsProcessed: targetTenants.length,
      syncedPayments,
    });
  } catch (err) {
    console.error("POST /api/payments/sync", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const POST = withAuth(_POST);
