import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getOwnerWalletOverview } from "@/server/modules/financial/owner-wallet.service";

async function _GET(request) {
  try {
    const wallet = await getOwnerWalletOverview({
      ownerIds: request.auth?.ownerIds || [],
    });

    return NextResponse.json(wallet);
  } catch (error) {
    console.error("GET /api/owner/wallet error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar a carteira do proprietario." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
