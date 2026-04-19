import { NextResponse } from "next/server";

import {
  uploadTenantContract,
  deleteTenantContract,
  getTenantContractDownloadUrl,
} from "@/server/modules/tenants/service/tenant-contract.service";
import { withAuth } from "@/lib/auth";

async function resolveTenantId(params) {
  const resolvedParams = typeof params?.then === "function" ? await params : params;
  return resolvedParams?.id;
}

async function _GET(_request, { params }) {
  try {
    const tenantId = await resolveTenantId(params);
    if (!tenantId) {
      return NextResponse.json({ error: "ID do inquilino e obrigatorio." }, { status: 400 });
    }

    const result = await getTenantContractDownloadUrl(tenantId);
    if (!result) {
      return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar contrato." },
      { status: error?.status || 500 }
    );
  }
}

async function _POST(request, { params }) {
  try {
    const tenantId = await resolveTenantId(params);
    if (!tenantId) {
      return NextResponse.json({ error: "ID do inquilino e obrigatorio." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 });
    }

    const result = await uploadTenantContract(tenantId, file, file.name);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao enviar contrato." },
      { status: error?.status || 500 }
    );
  }
}

async function _DELETE(_request, { params }) {
  try {
    const tenantId = await resolveTenantId(params);
    if (!tenantId) {
      return NextResponse.json({ error: "ID do inquilino e obrigatorio." }, { status: 400 });
    }

    const result = await deleteTenantContract(tenantId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao remover contrato." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
export const DELETE = withAuth(_DELETE);
