import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { normalizeOwnerPayoutMethodPayload } from "@/server/modules/financial/owner-wallet.request";
import {
  createOwnerPayoutMethod,
  getOwnerWalletOverview,
} from "@/server/modules/financial/owner-wallet.service";

async function _GET(request) {
  try {
    const wallet = await getOwnerWalletOverview({
      ownerIds: request.auth?.ownerIds || [],
    });

    return NextResponse.json({
      items: wallet?.payoutMethods || [],
    });
  } catch (error) {
    console.error("GET /api/owner/payout-methods error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar os metodos PIX." },
      { status: error?.status || 500 }
    );
  }
}

async function _POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = normalizeOwnerPayoutMethodPayload(body);

    const result = await createOwnerPayoutMethod({
      ownerIds: request.auth?.ownerIds || [],
      ownerId: input.ownerId || null,
      pixKeyType: input.pixKeyType,
      pixKeyValue: input.pixKeyValue,
      holderName: input.holderName,
      holderTaxId: input.holderTaxId,
      makeDefault: input.makeDefault,
      actorUserId: request.auth?.userId || null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/owner/payout-methods error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel cadastrar o metodo PIX." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
