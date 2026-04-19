import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getOwnerWithdrawalById } from "@/server/modules/financial/owner-wallet.service";

async function _GET(request, context) {
  try {
    const withdrawalId = context?.params?.id ? String(context.params.id).trim() : "";
    if (!withdrawalId) {
      return NextResponse.json({ error: "Informe o saque desejado." }, { status: 400 });
    }

    const withdrawal = await getOwnerWithdrawalById({
      ownerIds: request.auth?.ownerIds || [],
      withdrawalId,
    });

    if (!withdrawal) {
      return NextResponse.json({ error: "Saque nao encontrado." }, { status: 404 });
    }

    return NextResponse.json(withdrawal);
  } catch (error) {
    console.error("GET /api/owner/withdrawals/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar o saque." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
