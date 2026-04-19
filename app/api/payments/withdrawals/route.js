import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

async function respondGone() {
  return NextResponse.json(
    {
      error:
        "A rota legado /api/payments/withdrawals foi desativada. Use /api/owner/withdrawals e /api/owner/wallet.",
    },
    { status: 410 }
  );
}

export const GET = withAuth(respondGone);
export const POST = withAuth(respondGone);
