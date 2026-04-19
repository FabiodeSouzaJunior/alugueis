import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { normalizeOwnerWithdrawalResolutionPayload } from "@/server/modules/financial/owner-wallet.request";
import { resolveOwnerWithdrawalManually } from "@/server/modules/financial/owner-wallet.service";

async function _POST(request, context) {
  try {
    if (!request.auth?.isOrgAdmin) {
      return NextResponse.json(
        { error: "Somente administradores da organizacao podem resolver saques." },
        { status: 403 }
      );
    }

    const withdrawalId = context?.params?.id ? String(context.params.id).trim() : "";
    if (!withdrawalId) {
      return NextResponse.json({ error: "Informe o saque que sera resolvido." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const input = normalizeOwnerWithdrawalResolutionPayload(body);

    const withdrawal = await resolveOwnerWithdrawalManually({
      withdrawalId,
      resolution: input.resolution,
      failureReason: input.failureReason,
      providerResponse: input.providerResponse,
    });

    return NextResponse.json(withdrawal);
  } catch (error) {
    console.error("POST /api/admin/owner/withdrawals/[id]/resolve error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel resolver o saque." },
      { status: error?.status || 500 }
    );
  }
}

export const POST = withAuth(_POST);
