import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import {
  createPaymentProviderConfig,
  listPaymentProviderConfigsByOrganization,
} from "@/features/pagamentos/provider-configs";

function assertAdminAccess(auth = {}) {
  if (!auth?.isOrgAdmin) {
    throw Object.assign(
      new Error("Somente administradores da organizacao podem configurar gateways."),
      { status: 403 }
    );
  }

  if (!auth?.organizationId) {
    throw Object.assign(new Error("Organizacao nao localizada para o usuario autenticado."), {
      status: 403,
    });
  }
}

async function _GET(request) {
  try {
    assertAdminAccess(request.auth);

    const items = await listPaymentProviderConfigsByOrganization(request.auth.organizationId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/admin/payment-provider-configs error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel listar os gateways." },
      { status: error?.status || 500 }
    );
  }
}

async function _POST(request) {
  try {
    assertAdminAccess(request.auth);

    const body = await request.json().catch(() => ({}));
    const config = await createPaymentProviderConfig({
      organizationId: request.auth.organizationId,
      provider: body?.provider,
      isActive: body?.isActive !== false,
      environment: body?.environment || "production",
      apiKey: body?.apiKey,
      webhookSecret: body?.webhookSecret || null,
      webhookPublicKey: body?.webhookPublicKey || null,
      providerAccountName: body?.providerAccountName || null,
      providerAccountId: body?.providerAccountId || null,
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/payment-provider-configs error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel salvar o gateway." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
