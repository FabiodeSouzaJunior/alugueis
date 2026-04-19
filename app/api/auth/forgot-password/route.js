import { NextResponse } from "next/server";

import { handleForgotPasswordAuth } from "@/server/modules/auth";

export async function POST(request) {
  const response = await handleForgotPasswordAuth(request);
  return NextResponse.json(response.body, { status: response.status });
}
