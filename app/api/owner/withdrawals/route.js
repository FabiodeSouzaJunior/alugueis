import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import {
  normalizeOwnerWithdrawalPayload,
  readPaginationFromRequest,
} from "@/server/modules/financial/owner-wallet.request";
import {
  listOwnerWithdrawals,
  requestOwnerWithdrawal,
} from "@/server/modules/financial/owner-wallet.service";

async function _GET(request) {
  try {
    const { limit, offset } = readPaginationFromRequest(request, {
      limit: 20,
      offset: 0,
    });

    const result = await listOwnerWithdrawals({
      ownerIds: request.auth?.ownerIds || [],
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/owner/withdrawals error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar os saques." },
      { status: error?.status || 500 }
    );
  }
}

async function _POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = normalizeOwnerWithdrawalPayload(body);

    const result = await requestOwnerWithdrawal({
      ownerIds: request.auth?.ownerIds || [],
      payoutMethodId: input.payoutMethodId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/owner/withdrawals error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel solicitar o saque." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
