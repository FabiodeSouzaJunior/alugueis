import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { readPaginationFromRequest } from "@/server/modules/financial/owner-wallet.request";
import { listOwnerWalletLedger } from "@/server/modules/financial/owner-wallet.service";

async function _GET(request) {
  try {
    const { limit, offset } = readPaginationFromRequest(request, {
      limit: 20,
      offset: 0,
    });

    const result = await listOwnerWalletLedger({
      ownerIds: request.auth?.ownerIds || [],
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/owner/wallet/ledger error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar o razao financeiro." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
