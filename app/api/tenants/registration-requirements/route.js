import { NextResponse } from "next/server";

import { withAuthContext } from "@/lib/auth";
import { getActiveGatewayProviderSummaryByOrganization } from "@/features/pagamentos/provider-configs";
import { PAYMENT_PROVIDER_ASAAS } from "@/server/modules/financial/payment-provider-gateway.service";

async function _GET(request) {
  try {
    const organizationId = request.auth?.organizationId || null;
    const activeProvider = organizationId
      ? await getActiveGatewayProviderSummaryByOrganization(organizationId).catch(() => null)
      : null;

    const provider = activeProvider?.provider || null;

    return NextResponse.json({
      activePaymentProvider: provider,
      activePaymentProviderLabel: activeProvider?.providerLabel || null,
      requiresAsaasTenantFields: provider === PAYMENT_PROVIDER_ASAAS,
    });
  } catch (error) {
    console.error("GET /api/tenants/registration-requirements error:", error);
    return NextResponse.json(
      {
        activePaymentProvider: null,
        activePaymentProviderLabel: null,
        requiresAsaasTenantFields: false,
      },
      { status: 200 }
    );
  }
}

export const GET = withAuthContext(_GET);
