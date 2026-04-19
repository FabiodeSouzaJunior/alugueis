import { NextResponse } from "next/server";

import { handleResetPasswordAuth } from "@/server/modules/auth";

export async function POST(request) {
  const response = await handleResetPasswordAuth(request);
  return NextResponse.json(response.body, { status: response.status });
}
